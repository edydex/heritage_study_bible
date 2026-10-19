#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

usage() {
  cat <<'EOF'
Check the Heritage Community deployment, database, endpoints, and backups.

Usage:
  status.sh [options]

Options:
  --install-dir PATH    Deployment directory (default: script parent)
  --backup-dir PATH     Backup root (default: /var/backups/heritage-community)
  --recording-coverage-backup PATH
                        Compare live recording inventory with this verified
                        restore target instead of the latest backup
  --wait SECONDS        Wait up to SECONDS for the local endpoint (default: 0)
  --verify-backup       Verify every checksum in the latest backup
  --quiet               Suppress the Docker Compose service table
  -h, --help            Show this help

Exit status is nonzero when Docker, PostgreSQL, the app/tunnel, the local
discovery endpoint, or an installed backup timer is unhealthy. A public
endpoint or stale backup is a warning because external networking and planned
maintenance may be outside this command's control. Private recording storage is
measured by file metadata only; status never hashes the full recording library.
EOF
}

wait_seconds=0
verify_backup=0
quiet=0
recording_coverage_backup=""

while (($#)); do
  case "$1" in
    --install-dir)
      (($# >= 2)) || heritage_die "--install-dir requires a path."
      HERITAGE_INSTALL_DIR="$2"
      shift 2
      ;;
    --backup-dir)
      (($# >= 2)) || heritage_die "--backup-dir requires a path."
      HERITAGE_BACKUP_DIR="$2"
      shift 2
      ;;
    --recording-coverage-backup)
      (($# >= 2)) || heritage_die "--recording-coverage-backup requires a path."
      recording_coverage_backup="$2"
      shift 2
      ;;
    --wait)
      (($# >= 2)) || heritage_die "--wait requires a number of seconds."
      wait_seconds="$2"
      shift 2
      ;;
    --verify-backup)
      verify_backup=1
      shift
      ;;
    --quiet)
      quiet=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      heritage_die "Unknown option: $1 (try --help)"
      ;;
  esac
done

heritage_is_nonnegative_integer "${wait_seconds}" || heritage_die "Wait time must be a non-negative whole number."

heritage_init_context
heritage_init_docker
heritage_require_command curl
heritage_compose config --quiet || heritage_die "Production Compose configuration is invalid."
if [[ -n "${recording_coverage_backup}" ]]; then
  recording_coverage_backup="$(
    cd -- "${recording_coverage_backup}" 2>/dev/null && pwd -P
  )" || heritage_die "Recording coverage backup does not exist."
  [[ -f "${recording_coverage_backup}/manifest.env" ]] \
    || heritage_die "Recording coverage backup manifest is missing."
fi

local_port="$(heritage_env_value COMMUNITY_LOCAL_PORT)"
local_port="${local_port:-3000}"
heritage_is_nonnegative_integer "${local_port}" || heritage_die "COMMUNITY_LOCAL_PORT is not a valid port."
local_url="http://127.0.0.1:${local_port}/.well-known/heritage-community.json"
database_url="http://127.0.0.1:${local_port}/catalogs/readingPlans"
public_base="$(heritage_env_value COMMUNITY_PUBLIC_URL)"
public_url=""
if [[ -n "${public_base}" ]]; then
  public_url="${public_base%/}/.well-known/heritage-community.json"
fi

if (( ! quiet )); then
  printf '\nHeritage Community services\n'
  heritage_compose ps
fi

failures=0
warnings=0
printf '\nHealth checks\n'

if heritage_service_running postgres; then
  printf '  [ok] PostgreSQL container is running\n'
else
  printf '  [FAIL] PostgreSQL container is not running\n' >&2
  failures=$((failures + 1))
fi

if heritage_wait_for_postgres 2; then
  printf '  [ok] PostgreSQL accepts connections\n'
else
  printf '  [FAIL] PostgreSQL is not ready\n' >&2
  failures=$((failures + 1))
fi

if heritage_service_running community; then
  printf '  [ok] Community app container is running\n'
else
  printf '  [FAIL] Community app container is not running\n' >&2
  failures=$((failures + 1))
fi

if heritage_compose config --services | grep -qx cloudflared; then
  if heritage_service_running cloudflared; then
    printf '  [ok] Cloudflare tunnel container is running\n'
  else
    printf '  [FAIL] Cloudflare tunnel container is not running\n' >&2
    failures=$((failures + 1))
  fi
fi

if command -v systemctl >/dev/null 2>&1 \
  && systemctl list-unit-files heritage-community-tunnel.service --no-legend 2>/dev/null | grep -q '^heritage-community-tunnel.service'; then
  if systemctl is-active --quiet heritage-community-tunnel.service; then
    printf '  [ok] Host Cloudflare tunnel service is running\n'
  else
    printf '  [FAIL] Host Cloudflare tunnel service is not running\n' >&2
    failures=$((failures + 1))
  fi
fi

if command -v systemctl >/dev/null 2>&1 && [[ -f /etc/default/heritage-community ]]; then
  if ! systemctl list-unit-files heritage-community-backup.timer --no-legend 2>/dev/null \
    | grep -q '^heritage-community-backup.timer'; then
    printf '  [FAIL] Nightly backup timer is not installed\n' >&2
    failures=$((failures + 1))
  elif ! systemctl is-enabled --quiet heritage-community-backup.timer; then
    printf '  [FAIL] Nightly backup timer is not enabled\n' >&2
    failures=$((failures + 1))
  elif ! systemctl is-active --quiet heritage-community-backup.timer; then
    printf '  [FAIL] Nightly backup timer is not active\n' >&2
    failures=$((failures + 1))
  else
    printf '  [ok] Nightly backup timer is enabled and active\n'
  fi
fi

elapsed=0
while ! curl --silent --show-error --fail --max-time 5 "${local_url}" >/dev/null 2>&1; do
  if (( elapsed >= wait_seconds )); then
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done
if curl --silent --show-error --fail --max-time 5 "${local_url}" >/dev/null 2>&1; then
  printf '  [ok] Local discovery endpoint: %s\n' "${local_url}"
else
  printf '  [FAIL] Local discovery endpoint: %s\n' "${local_url}" >&2
  failures=$((failures + 1))
fi

if curl --silent --show-error --fail --max-time 10 "${database_url}" >/dev/null 2>&1; then
  printf '  [ok] Database-backed catalog endpoint: %s\n' "${database_url}"
else
  printf '  [FAIL] Database-backed catalog endpoint: %s\n' "${database_url}" >&2
  failures=$((failures + 1))
fi

if [[ -n "${public_url}" && "${public_base}" != http://localhost* && "${public_base}" != http://127.0.0.1* ]]; then
  if curl --silent --show-error --fail --max-time 10 "${public_url}" >/dev/null 2>&1; then
    printf '  [ok] Public discovery endpoint: %s\n' "${public_url}"
  else
    printf '  [WARN] Public discovery endpoint is not reachable: %s\n' "${public_url}" >&2
    warnings=$((warnings + 1))
  fi
fi

sermon_media_volume="$(heritage_sermon_media_volume_name)"
sermon_stats_available=0
sermon_completed_bytes=0
sermon_completed_files=0
sermon_staging_bytes=0
sermon_staging_files=0
sermon_staging_nonempty=0
sermon_capacity_kib=0
sermon_free_kib=0
sermon_used_percent="unknown"
sermon_inventory_digest=""
sermon_database_inventory_matches=0
if heritage_docker volume inspect "${sermon_media_volume}" >/dev/null 2>&1; then
  sermon_inventory_file="$(mktemp \
    "${TMPDIR:-/tmp}/heritage-status-sermon-inventory.XXXXXX")"
  sermon_database_inventory_file="$(mktemp \
    "${TMPDIR:-/tmp}/heritage-status-sermon-database.XXXXXX")"
  if (heritage_capture_sermon_inventory \
    "${sermon_inventory_file}" 0 "${sermon_media_volume}"); then
    if sermon_inventory_summary="$(
      heritage_sermon_inventory_summary "${sermon_inventory_file}" 2>/dev/null
    )"; then
      read -r sermon_inventory_digest sermon_completed_files sermon_completed_bytes \
        <<<"${sermon_inventory_summary}"
      sermon_stats_available=1
    fi
  fi
  if (( sermon_stats_available )) \
    && (heritage_capture_sermon_database_inventory \
      "${sermon_database_inventory_file}"); then
    if cmp -s -- "${sermon_inventory_file}" "${sermon_database_inventory_file}"; then
      sermon_database_inventory_matches=1
    else
      printf '  [FAIL] Managed sermon-media database rows do not exactly match live finalized objects\n' >&2
      failures=$((failures + 1))
    fi
  elif (( sermon_stats_available )); then
    printf '  [FAIL] Managed sermon-media database inventory could not be read\n' >&2
    failures=$((failures + 1))
  fi

  sermon_stats_command='
    base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
    [ -d "${base}" ] || exit 61
    work="/tmp/heritage-status.$$"
    mkdir "${work}"
    if [ -d "${base}/objects" ]; then
      find "${base}/objects" -type f -exec stat -c "%s" {} + \
        >"${work}/completed.sizes"
    else
      : >"${work}/completed.sizes"
    fi
    if [ -d "${base}/staging" ]; then
      find "${base}/staging" -type f -exec stat -c "%s" {} + \
        >"${work}/staging.sizes"
      first_staging_entry="$(find "${base}/staging" -mindepth 1 -print -quit)"
    else
      : >"${work}/staging.sizes"
      first_staging_entry=""
    fi
    completed="$(awk "{ total += \$1 } END { printf \"%.0f\\n\", total + 0 }" \
      "${work}/completed.sizes")"
    staging="$(awk "{ total += \$1 } END { printf \"%.0f\\n\", total + 0 }" \
      "${work}/staging.sizes")"
    completed_files="$(wc -l <"${work}/completed.sizes" | tr -d " ")"
    staging_files="$(wc -l <"${work}/staging.sizes" | tr -d " ")"
    staging_nonempty=0
    [ -z "${first_staging_entry}" ] || staging_nonempty=1
    set -- $(df -Pk "${base}" | awk "NR == 2 { print \$2, \$4, \$5 }")
    [ "$#" = "3" ] || exit 62
    printf "completed_bytes=%s\ncompleted_files=%s\nstaging_bytes=%s\nstaging_files=%s\nstaging_nonempty=%s\ncapacity_kib=%s\nfree_kib=%s\nused_percent=%s\n" \
      "${completed}" "${completed_files}" "${staging}" "${staging_files}" \
      "${staging_nonempty}" "$1" "$2" "$3"
    rm -rf -- "${work}"
  '
  if heritage_service_running community; then
    sermon_stats="$(heritage_compose exec -T community sh -ec "${sermon_stats_command}" 2>/dev/null)" \
      || sermon_stats=""
  else
    status_container="$(
      heritage_compose ps --all --quiet community 2>/dev/null | head -n 1
    )"
    status_image=""
    if [[ -n "${status_container}" ]]; then
      status_image="$(
        heritage_docker inspect --format '{{.Image}}' \
          "${status_container}" 2>/dev/null || true
      )"
    fi
    if [[ -n "${status_image}" ]]; then
      sermon_stats="$(
        heritage_docker run --rm \
          --network none \
          --read-only \
          --user 1001:1001 \
          --volume "${sermon_media_volume}:/app/private/sermon-media:ro" \
          --tmpfs /tmp:rw,noexec,nosuid,size=32m \
          --entrypoint sh \
          "${status_image}" \
          -ec "${sermon_stats_command}" 2>/dev/null
      )" || sermon_stats=""
    else
      sermon_stats=""
    fi
  fi
  sermon_raw_stats_valid=0
  if [[ -n "${sermon_stats}" ]]; then
    measured_completed_bytes="$(awk -F= '$1 == "completed_bytes" { print $2 }' <<<"${sermon_stats}")"
    measured_completed_files="$(awk -F= '$1 == "completed_files" { print $2 }' <<<"${sermon_stats}")"
    sermon_staging_bytes="$(awk -F= '$1 == "staging_bytes" { print $2 }' <<<"${sermon_stats}")"
    sermon_staging_files="$(awk -F= '$1 == "staging_files" { print $2 }' <<<"${sermon_stats}")"
    sermon_staging_nonempty="$(awk -F= '$1 == "staging_nonempty" { print $2 }' <<<"${sermon_stats}")"
    sermon_capacity_kib="$(awk -F= '$1 == "capacity_kib" { print $2 }' <<<"${sermon_stats}")"
    sermon_free_kib="$(awk -F= '$1 == "free_kib" { print $2 }' <<<"${sermon_stats}")"
    sermon_used_percent="$(awk -F= '$1 == "used_percent" { print $2 }' <<<"${sermon_stats}")"
    if heritage_is_nonnegative_integer "${measured_completed_bytes}" \
      && heritage_is_nonnegative_integer "${measured_completed_files}" \
      && heritage_is_nonnegative_integer "${sermon_staging_bytes}" \
      && heritage_is_nonnegative_integer "${sermon_staging_files}" \
      && [[ "${sermon_staging_nonempty}" == "0" || "${sermon_staging_nonempty}" == "1" ]] \
      && heritage_is_nonnegative_integer "${sermon_capacity_kib}" \
      && heritage_is_nonnegative_integer "${sermon_free_kib}"; then
      if (( sermon_stats_available )) \
        && [[ "${measured_completed_bytes}" == "${sermon_completed_bytes}" \
          && "${measured_completed_files}" == "${sermon_completed_files}" ]]; then
        sermon_raw_stats_valid=1
      fi
    fi
  fi
  (( sermon_raw_stats_valid )) || sermon_stats_available=0
  rm -f -- "${sermon_database_inventory_file}"
fi

printf '\nBackups\n'
latest=""
if [[ -d "${HERITAGE_BACKUP_DIR}" ]]; then
  latest="$(heritage_latest_backup || true)"
  if [[ -n "${latest}" && -d "${latest}" ]]; then
    printf '  Latest: %s\n' "${latest}"
    if find "${latest}" -maxdepth 0 -mmin +2880 -print -quit | grep -q .; then
      printf '  [WARN] Latest backup is more than 48 hours old\n' >&2
      warnings=$((warnings + 1))
    else
      printf '  [ok] Latest backup is less than 48 hours old\n'
    fi
    if (( verify_backup )); then
      if heritage_verify_backup "${latest}"; then
        printf '  [ok] Latest backup checksums are valid\n'
      else
        printf '  [FAIL] Latest backup verification failed\n' >&2
        failures=$((failures + 1))
      fi
    fi
  else
    printf '  [WARN] No completed backup found in %s\n' "${HERITAGE_BACKUP_DIR}" >&2
    warnings=$((warnings + 1))
  fi
else
  printf '  [WARN] Backup directory does not exist yet: %s\n' "${HERITAGE_BACKUP_DIR}" >&2
  warnings=$((warnings + 1))
fi

coverage_backup="${recording_coverage_backup:-${latest}}"
coverage_label="Latest"
if [[ -n "${recording_coverage_backup}" ]]; then
  coverage_label="Selected"
  printf '  Recording coverage target: %s\n' "${coverage_backup}"
fi
coverage_backup_format=""
if [[ -n "${coverage_backup}" && -f "${coverage_backup}/manifest.env" ]]; then
  coverage_backup_format="$(heritage_manifest_value HERITAGE_BACKUP_FORMAT \
    "${coverage_backup}/manifest.env")"
fi
coverage_inventory_matches=0
if [[ "${coverage_backup_format}" == "2" \
  && -f "${coverage_backup}/sermon-media.tar.gz" \
  && -f "${coverage_backup}/sermon-media.inventory" \
  && -f "${coverage_backup}/SHA256SUMS" \
  && "$(heritage_manifest_value SERMON_MEDIA_LAYOUT "${coverage_backup}/manifest.env")" \
    == "tenant-objects-sha256-v1" ]]; then
  if coverage_inventory_summary="$(
    heritage_sermon_inventory_summary \
      "${coverage_backup}/sermon-media.inventory" 2>/dev/null
  )"; then
    read -r coverage_inventory_digest coverage_inventory_count coverage_inventory_bytes \
      <<<"${coverage_inventory_summary}"
    checksum_inventory_digest="$(awk '
      $2 == "sermon-media.inventory" { print $1; found++ }
      END { if (found != 1) exit 1 }
    ' "${coverage_backup}/SHA256SUMS" 2>/dev/null || true)"
    if (( sermon_stats_available )) \
      && [[ "${coverage_inventory_digest}" == "${sermon_inventory_digest}" \
        && "${coverage_inventory_digest}" \
          == "$(heritage_manifest_value SERMON_MEDIA_INVENTORY_SHA256 "${coverage_backup}/manifest.env")" \
        && "${coverage_inventory_digest}" == "${checksum_inventory_digest}" \
        && "${coverage_inventory_count}" == "${sermon_completed_files}" \
        && "${coverage_inventory_count}" \
          == "$(heritage_manifest_value SERMON_MEDIA_OBJECT_COUNT "${coverage_backup}/manifest.env")" \
        && "${coverage_inventory_bytes}" == "${sermon_completed_bytes}" \
        && "${coverage_inventory_bytes}" \
          == "$(heritage_manifest_value SERMON_MEDIA_OBJECT_BYTES "${coverage_backup}/manifest.env")" ]] \
      && cmp -s -- "${coverage_backup}/sermon-media.inventory" \
        "${sermon_inventory_file}"; then
      coverage_inventory_matches=1
    fi
  fi
fi
if (( coverage_inventory_matches )); then
  printf '  [ok] %s format 2 backup inventory exactly covers %s finalized private recording object(s), %s bytes\n' \
    "${coverage_label}" "${sermon_completed_files}" "${sermon_completed_bytes}"
elif (( sermon_stats_available )) && (( sermon_completed_files > 0 )); then
  printf '  [FAIL] %s backup inventory does not exactly cover %s finalized private recording object(s), %s bytes\n' \
    "${coverage_label}" "${sermon_completed_files}" "${sermon_completed_bytes}" >&2
  failures=$((failures + 1))
elif [[ "${coverage_backup_format}" == "1" \
  && "${sermon_completed_files}" == "0" ]]; then
  printf '  [ok] %s legacy format 1 backup is acceptable because no finalized private recordings exist\n' \
    "${coverage_label}"
elif [[ "${coverage_backup_format}" == "2" ]]; then
  printf '  [FAIL] %s format 2 private-recording inventory is invalid or does not match the current empty store\n' \
    "${coverage_label}" >&2
  failures=$((failures + 1))
else
  printf '  [WARN] %s backup private-recording inventory coverage could not be established\n' \
    "${coverage_label}" >&2
  warnings=$((warnings + 1))
  if (( sermon_stats_available )) && (( sermon_completed_files > 0 )); then
    printf '  [FAIL] Finalized private recordings have no matching backup inventory\n' >&2
    failures=$((failures + 1))
  fi
fi

if [[ -n "${sermon_inventory_file:-}" ]]; then
  rm -f -- "${sermon_inventory_file}"
fi

printf '\nStorage\n'
df -h -- "${HERITAGE_INSTALL_DIR}" "$(dirname -- "${HERITAGE_BACKUP_DIR}")" 2>/dev/null | awk 'NR == 1 || !seen[$1]++ { print "  " $0 }' || true
if (( sermon_stats_available )); then
  printf '  Private sermon volume: %s\n' "${sermon_media_volume}"
  printf '  Finalized private recording bytes: %s (%s object(s))\n' \
    "${sermon_completed_bytes}" "${sermon_completed_files}"
  printf '  Private recording staging bytes: %s (%s file(s))\n' \
    "${sermon_staging_bytes}" "${sermon_staging_files}"
  printf '  Private recording filesystem headroom: %s KiB free of %s KiB (%s used)\n' \
    "${sermon_free_kib}" "${sermon_capacity_kib}" "${sermon_used_percent}"
  if (( sermon_staging_nonempty )); then
    printf '  [WARN] Recording staging is nonempty; backups will fail closed until uploads finish or residue is reviewed\n' >&2
    warnings=$((warnings + 1))
  else
    printf '  [ok] Private recording staging is empty\n'
  fi
else
  printf '  [FAIL] Private sermon volume is missing or unreadable: %s\n' \
    "${sermon_media_volume}" >&2
  failures=$((failures + 1))
fi

env_mode="$(stat -Lc '%a' "${HERITAGE_ENV_FILE}" 2>/dev/null || true)"
if [[ -n "${env_mode}" && "${env_mode}" != "600" && "${env_mode}" != "400" ]]; then
  heritage_warn "${HERITAGE_ENV_FILE} permissions are ${env_mode}; use chmod 600 to protect secrets."
fi

if (( failures > 0 )); then
  heritage_die "${failures} critical health check(s) failed."
fi

if (( warnings > 0 )); then
  heritage_warn "All local critical checks passed with ${warnings} warning(s) shown above."
else
  heritage_info "All local and public checks passed."
fi
