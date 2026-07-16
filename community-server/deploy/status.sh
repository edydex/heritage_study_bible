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
  --wait SECONDS        Wait up to SECONDS for the local endpoint (default: 0)
  --verify-backup       Verify every checksum in the latest backup
  --quiet               Suppress the Docker Compose service table
  -h, --help            Show this help

Exit status is nonzero when Docker, PostgreSQL, the app/tunnel, the local
discovery endpoint, or an installed backup timer is unhealthy. A public
endpoint or stale backup is a warning because external networking and planned
maintenance may be outside this command's control.
EOF
}

wait_seconds=0
verify_backup=0
quiet=0

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

printf '\nBackups\n'
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

printf '\nStorage\n'
df -h -- "${HERITAGE_INSTALL_DIR}" "$(dirname -- "${HERITAGE_BACKUP_DIR}")" 2>/dev/null | awk 'NR == 1 || !seen[$1]++ { print "  " $0 }' || true

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
