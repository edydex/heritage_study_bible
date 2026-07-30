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
  --online                Keep the app running; database is still consistent,
                          but concurrent media changes may not match the dump
  --scheduled             Mark invocation as unattended; no behavior change
  -h, --help              Show this help

Environment overrides:
  HERITAGE_INSTALL_DIR, HERITAGE_BACKUP_DIR,
  HERITAGE_BACKUP_RETENTION_DAYS, HERITAGE_BACKUP_QUIESCE

The result contains database.dump, media.tar.gz, a non-secret manifest, and
SHA-256 checksums. Existing backups are never overwritten.
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

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e

  if (( app_was_stopped )); then
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

git_commit="unknown"
if command -v git >/dev/null 2>&1 && git -C "${HERITAGE_INSTALL_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_commit="$(git -C "${HERITAGE_INSTALL_DIR}" rev-parse HEAD 2>/dev/null || printf 'unknown')"
fi

cat >"${partial}/manifest.env" <<EOF
HERITAGE_BACKUP_FORMAT=1
CREATED_AT=${timestamp}
PROJECT_NAME=${HERITAGE_PROJECT_NAME}
SOURCE_GIT_COMMIT=${git_commit}
DATABASE_FILE=database.dump
MEDIA_FILE=media.tar.gz
RECOVERY_FILE=recovery.tar.gz
QUIESCED=${quiesce}
EOF

(
  cd -- "${partial}"
  sha256sum database.dump media.tar.gz recovery.tar.gz manifest.env >SHA256SUMS
)

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
