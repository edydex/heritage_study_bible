#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

usage() {
  cat <<'EOF'
Create a consistent PostgreSQL and media backup for Heritage Community.

Usage:
  backup.sh [options]

Options:
  --install-dir PATH      Deployment directory (default: script parent)
  --output-dir PATH       Backup root (default: /var/backups/heritage-community)
  --retention-days DAYS   Prune marked backups older than DAYS (default: 30)
                          Use 0 to disable automatic pruning
  --label LABEL           Add a short label to the backup directory name
  --quiesce               Briefly stop the app while capturing data (default)
  --online                Keep the app running. Refused when managed recording
                          upload is enabled or its database/store is nonempty
  --scheduled             Mark invocation as unattended; no behavior change
  -h, --help              Show this help

Environment overrides:
  HERITAGE_INSTALL_DIR, HERITAGE_BACKUP_DIR,
  HERITAGE_BACKUP_RETENTION_DAYS, HERITAGE_BACKUP_QUIESCE

Format 2 backups contain a tenant-scoped sermon-media archive and a canonical
object inventory. Quiesced backup runs supported maintenance after stopping the
app, then hashes every finalized object before PostgreSQL export. Nonexpired
active staging refuses backup. Online backup is allowed only while managed
recording upload is disabled and both its database and private store stay empty.

Existing backups are never overwritten.
EOF
}

retention_days="${HERITAGE_BACKUP_RETENTION_DAYS:-30}"
quiesce="${HERITAGE_BACKUP_QUIESCE:-1}"
label=""

while (($#)); do
  case "$1" in
    --install-dir)
      (($# >= 2)) || heritage_die "--install-dir requires a path."
      HERITAGE_INSTALL_DIR="$2"
      shift 2
      ;;
    --output-dir)
      (($# >= 2)) || heritage_die "--output-dir requires a path."
      HERITAGE_BACKUP_DIR="$2"
      shift 2
      ;;
    --retention-days)
      (($# >= 2)) || heritage_die "--retention-days requires a number."
      retention_days="$2"
      shift 2
      ;;
    --label)
      (($# >= 2)) || heritage_die "--label requires text."
      label="$2"
      shift 2
      ;;
    --quiesce)
      quiesce=1
      shift
      ;;
    --online)
      quiesce=0
      shift
      ;;
    --scheduled)
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

heritage_is_nonnegative_integer "${retention_days}" || \
  heritage_die "Retention days must be a non-negative whole number."
[[ "${quiesce}" == "0" || "${quiesce}" == "1" ]] || \
  heritage_die "HERITAGE_BACKUP_QUIESCE must be 0 or 1."

if [[ -n "${label}" ]]; then
  label="$(printf '%s' "${label}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-')"
  label="${label#-}"
  label="${label%-}"
  [[ -n "${label}" ]] || heritage_die "The backup label must contain a letter or number."
  ((${#label} <= 48)) || heritage_die "The backup label must be 48 characters or fewer."
fi

heritage_init_context
heritage_init_docker
heritage_require_command sha256sum
heritage_require_command find
heritage_require_command tar
heritage_acquire_operations_lock
heritage_prepare_backup_root

heritage_compose config --quiet || heritage_die "Production Compose configuration is invalid."
heritage_service_running postgres || heritage_die "PostgreSQL is not running; no backup was created."
heritage_wait_for_postgres 30 || heritage_die "PostgreSQL did not become ready; no backup was created."

timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
name="backup-${timestamp}"
[[ -z "${label}" ]] || name="${name}-${label}"
destination="${HERITAGE_BACKUP_DIR}/${name}"
if [[ -e "${destination}" ]]; then
  destination="${destination}-$$"
fi
partial="${HERITAGE_BACKUP_DIR}/.partial-${name}-$$"
app_was_stopped=0
backup_complete=0
leave_app_stopped=0

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e

  if (( app_was_stopped && leave_app_stopped )); then
    heritage_warn "The Community app remains stopped because sermon-media maintenance did not complete safely."
    heritage_warn "The Cloudflare connector remains running for recovery access."
  elif (( app_was_stopped )); then
    heritage_info "Starting the community app again."
    heritage_compose start community >/dev/null
    if [[ $? -ne 0 && ${status} -eq 0 ]]; then
      status=1
      heritage_warn "The backup succeeded, but the community app could not be restarted."
    fi
  fi

  if (( ! backup_complete )) && [[ -n "${partial:-}" && "${partial}" == "${HERITAGE_BACKUP_DIR}/.partial-"* ]]; then
    rm -rf -- "${partial}"
  fi

  exit "${status}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -- "${partial}"

if [[ "${quiesce}" == "1" ]] && heritage_service_running community; then
  heritage_info "Pausing the community app for a consistent database/media snapshot."
  app_was_stopped=1
  heritage_compose stop --timeout 60 community >/dev/null
fi

sermon_media_volume="$(heritage_sermon_media_volume_name)"
ensure_private_sermon_layout_quiesced() {
  heritage_compose run --rm --no-deps -T \
    --user 0 \
    --cap-add CHOWN \
    --cap-add DAC_OVERRIDE \
    --cap-add FOWNER \
    --entrypoint sh community -ec '
    base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
    umask 077
    [ -d "${base}" ] && [ ! -L "${base}" ] || exit 70
    for child in staging objects; do
      target="${base}/${child}"
      if [ -L "${target}" ] \
        || { [ -e "${target}" ] && [ ! -d "${target}" ]; }; then
        exit 71
      fi
    done
    for child in staging objects; do
      target="${base}/${child}"
      if [ ! -e "${target}" ]; then
        mkdir -m 0700 "${target}" || exit 72
      fi
      [ -d "${target}" ] && [ ! -L "${target}" ] || exit 73
    done
    chown 1001:1001 "${base}" "${base}/staging" "${base}/objects"
    chmod 0700 "${base}" "${base}/staging" "${base}/objects"
    for target in "${base}" "${base}/staging" "${base}/objects"; do
      [ -d "${target}" ] && [ ! -L "${target}" ] || exit 74
      [ "$(stat -c "%u:%g:%a" "${target}")" = "1001:1001:700" ] \
        || exit 75
    done
  ' || heritage_die "Private sermon-media layout could not be prepared."
}

ensure_private_sermon_layout_online() {
  heritage_compose run --rm --no-deps -T \
    --entrypoint sh community -ec '
    base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
    umask 077
    expected="$(id -u):$(id -g):700"
    [ -d "${base}" ] && [ ! -L "${base}" ] || exit 70
    for child in staging objects; do
      target="${base}/${child}"
      if [ -L "${target}" ] \
        || { [ -e "${target}" ] && [ ! -d "${target}" ]; }; then
        exit 71
      fi
    done
    for child in staging objects; do
      target="${base}/${child}"
      if [ ! -e "${target}" ]; then
        mkdir -m 0700 "${target}" || exit 72
      fi
      [ -d "${target}" ] && [ ! -L "${target}" ] || exit 73
    done
    for target in "${base}" "${base}/staging" "${base}/objects"; do
      [ -d "${target}" ] && [ ! -L "${target}" ] || exit 74
      [ "$(stat -c "%u:%g:%a" "${target}")" = "${expected}" ] || exit 75
    done
  ' || heritage_die \
    "Online backup requires an intact service-owned private sermon-media layout. Re-run with --quiesce to repair it."
}

assert_online_sermon_store_empty() {
  local state
  local store_command

  if ! heritage_docker volume inspect "${sermon_media_volume}" >/dev/null 2>&1; then
    printf 'empty\n'
    return 0
  fi
  store_command='
    base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
    [ -d "${base}" ] && [ ! -L "${base}" ] || exit 75
    for entry in "${base}"/* "${base}"/.[!.]* "${base}"/..?*; do
      [ -e "${entry}" ] || [ -L "${entry}" ] || continue
      case "${entry}" in
        "${base}/objects"|"${base}/staging")
          [ -d "${entry}" ] && [ ! -L "${entry}" ] || exit 76
          if find "${entry}" -mindepth 1 -print -quit | grep -q .; then
            exit 77
          fi
          ;;
        *)
          exit 78
          ;;
      esac
    done
    printf "empty\n"
  '
  if heritage_service_running community; then
    state="$(heritage_compose exec -T community sh -ec "${store_command}")" \
      || heritage_die "Online backup requires an empty, stable private sermon-media store."
  else
    state="$(heritage_compose run --rm --no-deps -T --entrypoint sh community \
      -ec "${store_command}")" \
      || heritage_die "Online backup requires an empty, stable private sermon-media store."
  fi
  state="${state//$'\r'/}"
  state="${state//$'\n'/}"
  [[ "${state}" == "empty" ]] \
    || heritage_die "Online private sermon-media state could not be validated."
  printf '%s\n' "${state}"
}

maintenance_report=""
sermon_inventory_digest=""
sermon_inventory_count=0
sermon_inventory_bytes=0
online_store_before=""
if [[ "${quiesce}" == "1" ]]; then
  ensure_private_sermon_layout_quiesced
  if heritage_sermon_media_schema_present; then
    leave_app_stopped=1
    maintenance_report="$("${SCRIPT_DIR}/sermon-media-maintenance.sh" \
      --install-dir "${HERITAGE_INSTALL_DIR}" \
      --already-quiesced \
      --require-backup-ready)" \
      || heritage_die "Quiesced sermon-media maintenance failed; no backup was published."
    leave_app_stopped=0
  else
    schema_status=$?
    (( schema_status == 1 )) \
      || heritage_die "Could not determine whether managed sermon-media tables exist."
    heritage_info "Managed sermon-media tables are not installed yet; treating their store as legacy-empty."
  fi
  heritage_capture_sermon_inventory "${partial}/sermon-media.inventory" 1
  heritage_capture_sermon_database_inventory \
    "${partial}/sermon-media.database.inventory"
  cmp -- "${partial}/sermon-media.database.inventory" \
    "${partial}/sermon-media.inventory" \
    || heritage_die "Managed sermon-media database rows do not exactly match finalized objects."
  rm -f -- "${partial}/sermon-media.database.inventory"
else
  [[ "$(heritage_config_value HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED false)" != "true" ]] \
    || heritage_die "Online backup is disabled while managed sermon recording upload is enabled. Re-run with --quiesce."
  if heritage_service_running community; then
    heritage_compose exec -T community sh -ec \
      '[ "${HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED:-false}" != "true" ]' \
      || heritage_die "Online backup is disabled because the running Community app has managed recording upload enabled."
  fi
  read -r database_object_count database_object_bytes \
    < <(heritage_sermon_media_database_summary) \
    || heritage_die "Could not inspect the managed sermon-media database."
  (( database_object_count == 0 && database_object_bytes == 0 )) \
    || heritage_die "Online backup is unsafe while managed sermon-media database objects exist. Re-run with --quiesce."
  online_store_before="$(assert_online_sermon_store_empty)"
fi

if [[ "${quiesce}" == "1" ]]; then
  read -r sermon_inventory_digest sermon_inventory_count sermon_inventory_bytes \
    < <(heritage_sermon_inventory_summary "${partial}/sermon-media.inventory")
  read -r database_object_count database_object_bytes \
    < <(heritage_sermon_media_database_summary) \
    || heritage_die "Could not inspect the managed sermon-media database."
  (( sermon_inventory_count == database_object_count \
    && sermon_inventory_bytes == database_object_bytes )) \
    || heritage_die "Managed sermon-media database/object totals disagree; no backup was published."
  if [[ -n "${maintenance_report}" ]]; then
    [[ "$(jq -r '.retained.objects' <<<"${maintenance_report}")" == "${sermon_inventory_count}" \
      && "$(jq -r '.retained.bytes' <<<"${maintenance_report}")" == "${sermon_inventory_bytes}" ]] \
      || heritage_die "Maintenance and the locked sermon-media inventory disagree."
  fi
fi

heritage_info "Exporting PostgreSQL."
heritage_compose exec -T postgres sh -ec \
  'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --compress=9 --no-owner --no-privileges' \
  >"${partial}/database.dump"
[[ -s "${partial}/database.dump" ]] || heritage_die "PostgreSQL produced an empty dump."
heritage_info "Validating the PostgreSQL dump catalog."
heritage_compose exec -T postgres sh -ec \
  'exec pg_restore --list' \
  <"${partial}/database.dump" >/dev/null \
  || heritage_die "PostgreSQL produced an unreadable dump."

heritage_info "Archiving uploaded media."
heritage_compose run --rm --no-deps -T --entrypoint tar community \
  -czf - -C /app/media . >"${partial}/media.tar.gz"
[[ -s "${partial}/media.tar.gz" ]] || heritage_die "Media archive is empty or missing."
heritage_validate_tar_archive "${partial}/media.tar.gz" generic \
  || heritage_die "Uploaded-media archive validation failed; no backup was published."

if [[ "${quiesce}" == "0" ]]; then
  online_store_after="$(assert_online_sermon_store_empty)"
  [[ "${online_store_after}" == "${online_store_before}" ]] \
    || heritage_die "Private sermon-media store changed during online backup; no backup was published."
  read -r database_object_count database_object_bytes \
    < <(heritage_sermon_media_database_summary) \
    || heritage_die "Could not recheck the managed sermon-media database."
  (( database_object_count == 0 && database_object_bytes == 0 )) \
    || heritage_die "Managed sermon-media database changed during online backup; no backup was published."
  ensure_private_sermon_layout_online
  : >"${partial}/sermon-media.inventory"
  read -r sermon_inventory_digest sermon_inventory_count sermon_inventory_bytes \
    < <(heritage_sermon_inventory_summary "${partial}/sermon-media.inventory")
fi

heritage_info "Archiving finalized private sermon recordings."
heritage_compose run --rm --no-deps -T --entrypoint tar community \
  -czf - -C /app/private/sermon-media objects \
  >"${partial}/sermon-media.tar.gz"
[[ -s "${partial}/sermon-media.tar.gz" ]] \
  || heritage_die "Private sermon-media archive is empty or missing."
heritage_validate_tar_archive "${partial}/sermon-media.tar.gz" sermon-media \
  || heritage_die "Private sermon-media archive validation failed."
if [[ "${quiesce}" == "0" ]]; then
  if tar -tzf "${partial}/sermon-media.tar.gz" 2>/dev/null | awk '
    {
      path = $0
      sub(/^\.\//, "", path)
      sub(/\/$/, "", path)
      if (path != "" && path != "objects") unexpected = 1
    }
    END { exit unexpected ? 0 : 1 }
  '; then
    heritage_die "Private sermon-media content appeared in the online archive; no backup was published."
  fi
  [[ "$(assert_online_sermon_store_empty)" == "empty" ]] \
    || heritage_die "Private sermon-media store changed while the online archive was created."
  read -r database_object_count database_object_bytes \
    < <(heritage_sermon_media_database_summary) \
    || heritage_die "Could not complete the online managed sermon-media database recheck."
  (( database_object_count == 0 && database_object_bytes == 0 )) \
    || heritage_die "Managed sermon-media database changed while the online archive was created."
fi

heritage_info "Packaging root-only recovery configuration."
recovery_source="${partial}/recovery"
mkdir -- "${recovery_source}"
install -m 0600 "${HERITAGE_ENV_FILE}" "${recovery_source}/community.env"
resolved_env="$(readlink -f "${HERITAGE_ENV_FILE}" 2>/dev/null || printf '%s' "${HERITAGE_ENV_FILE}")"
config_dir="$(dirname -- "${resolved_env}")"
deployment_root="$(dirname -- "${config_dir}")"
for recovery_file in \
  "${config_dir}"/cloudflared*.json \
  "${config_dir}"/cloudflared.yml \
  "${deployment_root}"/state/install.env \
  "${deployment_root}"/state/admin-email \
  "${deployment_root}"/state/bootstrap-complete; do
  [[ -f "${recovery_file}" ]] || continue
  install -m 0600 "${recovery_file}" "${recovery_source}/$(basename -- "${recovery_file}")"
done
tar -czf "${partial}/recovery.tar.gz" -C "${recovery_source}" .
rm -rf -- "${recovery_source}"
[[ -s "${partial}/recovery.tar.gz" ]] || heritage_die "Recovery configuration archive is empty or missing."
heritage_validate_tar_archive "${partial}/recovery.tar.gz" generic \
  || heritage_die "Recovery archive validation failed; no backup was published."

git_commit="unknown"
if command -v git >/dev/null 2>&1 && git -C "${HERITAGE_INSTALL_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_commit="$(git -C "${HERITAGE_INSTALL_DIR}" rev-parse HEAD 2>/dev/null || printf 'unknown')"
fi

backup_format=2

cat >"${partial}/manifest.env" <<EOF
HERITAGE_BACKUP_FORMAT=${backup_format}
CREATED_AT=${timestamp}
PROJECT_NAME=${HERITAGE_PROJECT_NAME}
SOURCE_GIT_COMMIT=${git_commit}
DATABASE_FILE=database.dump
MEDIA_FILE=media.tar.gz
RECOVERY_FILE=recovery.tar.gz
QUIESCED=${quiesce}
EOF
cat >>"${partial}/manifest.env" <<EOF
SERMON_MEDIA_FILE=sermon-media.tar.gz
SERMON_MEDIA_LAYOUT=tenant-objects-sha256-v1
SERMON_MEDIA_INVENTORY_FILE=sermon-media.inventory
SERMON_MEDIA_INVENTORY_SHA256=${sermon_inventory_digest}
SERMON_MEDIA_OBJECT_COUNT=${sermon_inventory_count}
SERMON_MEDIA_OBJECT_BYTES=${sermon_inventory_bytes}
EOF

(
  cd -- "${partial}"
  sha256sum database.dump media.tar.gz recovery.tar.gz sermon-media.tar.gz \
    sermon-media.inventory manifest.env >SHA256SUMS
)

heritage_info "Verifying the complete backup set before publication."
heritage_verify_backup "${partial}" >/dev/null

mv -- "${partial}" "${destination}"
ln -sfn -- "$(basename -- "${destination}")" "${HERITAGE_BACKUP_DIR}/latest"
backup_complete=1

if (( retention_days > 0 )); then
  heritage_info "Pruning verified backup directories older than ${retention_days} days."
  while IFS= read -r -d '' candidate; do
    [[ -f "${candidate}/manifest.env" && -f "${candidate}/SHA256SUMS" ]] || continue
    if find "${candidate}" -maxdepth 0 -mtime "+${retention_days}" -print -quit | grep -q .; then
      rm -rf -- "${candidate}"
    fi
  done < <(find "${HERITAGE_BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -name 'backup-20*' -print0)
fi

heritage_info "Backup complete: ${destination}"
