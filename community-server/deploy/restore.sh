#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

usage() {
  cat <<'EOF'
Restore Heritage Community from a verified backup.

Usage:
  restore.sh [options] BACKUP_DIRECTORY
  restore.sh [options] --latest

Options:
  --install-dir PATH       Deployment directory (default: script parent)
  --backup-dir PATH        Backup root used by --latest and safety backups
  --latest                 Restore the backup selected by the latest symlink
  --database-only          Restore PostgreSQL, leave uploaded media unchanged
  --media-only             Restore uploaded media, leave PostgreSQL unchanged
  --skip-safety-backup     Do not capture the current state first (dangerous)
  --no-start               Leave the community app stopped after restore;
                           preserve the Cloudflare recovery transport
  --yes                    Skip the exact typed confirmation
  -h, --help               Show this help

Safety behavior:
  * SHA-256 checksums and the archive structure are verified before changes.
  * Format 2 is an atomic database + public media + private recording set;
    database-only and media-only restores are rejected.
  * Format 2 private recordings are extracted and validated in a distinct
    temporary Docker volume and compared exactly with their inventory.
  * Legacy format 1 means no private recordings and restores an empty private
    objects tree when media restore is selected. A partial legacy restore is
    allowed only while the current database and live private store are empty.
  * A full pre-restore backup is created by default.
  * The app is stopped before replacing the database or media.
  * The Cloudflare connector stays running because it may carry SSH recovery.
  * Current forward database migrations run after a database restore.

Restore is intentionally not automatic rollback. If it fails before live data
changes, the script restarts only services that were running. If it fails after
replacement starts, it prints the safety backup and keeps the app stopped for
deliberate recovery while leaving the Cloudflare connector running. Public app
requests can be unavailable while the app is deliberately stopped.
EOF
}

backup_path=""
use_latest=0
restore_database=1
restore_media=1
skip_safety_backup=0
start_after=1
assume_yes=0

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
    --latest)
      use_latest=1
      shift
      ;;
    --database-only)
      restore_database=1
      restore_media=0
      shift
      ;;
    --media-only)
      restore_database=0
      restore_media=1
      shift
      ;;
    --skip-safety-backup)
      skip_safety_backup=1
      shift
      ;;
    --no-start)
      start_after=0
      shift
      ;;
    --yes)
      assume_yes=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      (($# <= 1)) || heritage_die "Only one backup directory may be supplied."
      if (($# == 1)); then
        backup_path="$1"
        shift
      fi
      ;;
    -*)
      heritage_die "Unknown option: $1 (try --help)"
      ;;
    *)
      [[ -z "${backup_path}" ]] || heritage_die "Only one backup directory may be supplied."
      backup_path="$1"
      shift
      ;;
  esac
done

(( use_latest == 0 || ${#backup_path} == 0 )) || \
  heritage_die "Choose either --latest or an explicit backup directory, not both."
(( use_latest == 1 || ${#backup_path} > 0 )) || heritage_die "Choose a backup directory or use --latest."

heritage_init_context
heritage_init_docker
heritage_require_command sha256sum
heritage_require_command tar
heritage_acquire_operations_lock
heritage_prepare_backup_root
heritage_compose config --quiet || heritage_die "Production Compose configuration is invalid."

if (( use_latest )); then
  backup_path="$(heritage_latest_backup)"
  [[ -n "${backup_path}" ]] || heritage_die "No backup was found in ${HERITAGE_BACKUP_DIR}."
elif [[ "${backup_path}" != /* ]]; then
  backup_parent="$(cd -- "$(dirname -- "${backup_path}")" 2>/dev/null && pwd -P)" || \
    heritage_die "Backup path does not exist: ${backup_path}"
  backup_path="${backup_parent}/$(basename -- "${backup_path}")"
fi
backup_path="$(cd -- "${backup_path}" 2>/dev/null && pwd -P)" || heritage_die "Backup path does not exist."

heritage_info "Verifying backup checksums."
heritage_verify_backup "${backup_path}"
backup_format="$(heritage_backup_format "${backup_path}")" \
  || heritage_die "Backup format validation failed."
heritage_info "Validating the PostgreSQL dump catalog."
heritage_compose run --rm --no-deps -T --entrypoint pg_restore postgres --list \
  <"${backup_path}/database.dump" >/dev/null \
  || heritage_die "The PostgreSQL dump is unreadable; live data was not changed."

heritage_validate_tar_archive "${backup_path}/media.tar.gz" generic \
  || heritage_die "Media archive validation failed; live data was not changed."
if [[ "${backup_format}" == "2" ]]; then
  heritage_validate_tar_archive "${backup_path}/sermon-media.tar.gz" sermon-media \
    || heritage_die "Private sermon-media archive validation failed; live data was not changed."
fi

if [[ "${backup_format}" == "2" \
  && ( "${restore_database}" != "1" || "${restore_media}" != "1" ) ]]; then
  heritage_die "Format 2 backup is one atomic database/media set; partial restore is refused."
fi

assert_legacy_partial_restore_safe() {
  local legacy_live_inventory
  local legacy_live_digest
  local legacy_live_count
  local legacy_live_bytes
  local legacy_database_count
  local legacy_database_bytes

  legacy_live_inventory="$(mktemp "${TMPDIR:-/tmp}/heritage-legacy-live.XXXXXX")"
  if heritage_docker volume inspect "$(heritage_sermon_media_volume_name)" >/dev/null 2>&1; then
    heritage_capture_sermon_inventory "${legacy_live_inventory}" 0
  else
    : >"${legacy_live_inventory}"
  fi
  read -r legacy_live_digest legacy_live_count legacy_live_bytes \
    < <(heritage_sermon_inventory_summary "${legacy_live_inventory}")
  rm -f -- "${legacy_live_inventory}"
  read -r legacy_database_count legacy_database_bytes \
    < <(heritage_sermon_media_database_summary) \
    || heritage_die "Could not inspect current managed sermon-media database rows."
  (( legacy_live_count == 0 \
    && legacy_live_bytes == 0 \
    && legacy_database_count == 0 \
    && legacy_database_bytes == 0 )) \
    || heritage_die "Legacy format 1 partial restore is allowed only when current managed recording database rows and live objects are both empty."
}

if [[ "${backup_format}" == "1" \
  && ( "${restore_database}" != "1" || "${restore_media}" != "1" ) ]]; then
  assert_legacy_partial_restore_safe
fi

confirmation="RESTORE $(basename -- "${backup_path}")"
if (( ! assume_yes )); then
  heritage_confirm_exact "${confirmation}" \
    "This replaces live Heritage Community data with ${backup_path}."
fi

safety_backup="not-created"
community_was_running=0
destructive_started=0
leave_app_stopped_on_failure=0
sermon_restore_volume=""
sermon_service_uid=""
sermon_service_gid=""
sermon_restore_inventory=""

prepare_sermon_restore_volume() {
  local identity
  local restore_token

  identity="$(heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
    'printf "%s:%s\n" "$(id -u)" "$(id -g)"')" \
    || heritage_die "Could not resolve the Community service identity."
  [[ "${identity}" =~ ^[0-9]+:[0-9]+$ ]] \
    || heritage_die "Community service identity is invalid: ${identity}"
  sermon_service_uid="${identity%%:*}"
  sermon_service_gid="${identity##*:}"

  restore_token="$(date -u '+%Y%m%d%H%M%S')-$$"
  sermon_restore_volume="${HERITAGE_PROJECT_NAME}-sermon-media-restore-${restore_token}"
  [[ "${sermon_restore_volume}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] \
    || heritage_die "Temporary sermon-media volume name is unsafe."
  if heritage_docker volume inspect "${sermon_restore_volume}" >/dev/null 2>&1; then
    heritage_die "Temporary sermon-media volume already exists: ${sermon_restore_volume}"
  fi
  heritage_docker volume create \
    --label heritage.community.restore-temporary=true \
    --label "heritage.community.project=${HERITAGE_PROJECT_NAME}" \
    "${sermon_restore_volume}" >/dev/null \
    || heritage_die "Could not create a distinct temporary sermon-media volume."

  heritage_compose run --rm --no-deps -T \
    --user 0 \
    --cap-add CHOWN \
    --cap-add DAC_OVERRIDE \
    --cap-add FOWNER \
    --volume "${sermon_restore_volume}:/restore" \
    --entrypoint sh community -ec \
    'chown "$1:$2" /restore && chmod 0700 /restore' \
    sh "${sermon_service_uid}" "${sermon_service_gid}" \
    || heritage_die "Could not initialize the temporary sermon-media volume."

  if [[ "${backup_format}" == "2" ]]; then
    heritage_info "Extracting private recordings into a distinct temporary volume."
    heritage_compose run --rm --no-deps -T \
      --volume "${sermon_restore_volume}:/restore" \
      --entrypoint sh community -ec '
        umask 077
        tar -xzf - -C /restore
      ' <"${backup_path}/sermon-media.tar.gz" \
      || heritage_die "Private recordings could not be extracted into the temporary volume."
  else
    heritage_info "Preparing the empty private objects tree represented by legacy backup format 1."
    heritage_compose run --rm --no-deps -T \
      --volume "${sermon_restore_volume}:/restore" \
      --entrypoint sh community -ec \
      'umask 077; mkdir -p /restore/objects' \
      || heritage_die "Could not prepare the legacy empty private objects tree."
  fi

  sermon_restore_inventory="$(mktemp \
    "${TMPDIR:-/tmp}/heritage-sermon-restore-inventory.XXXXXX")"
  heritage_compose run --rm --no-deps -T \
    --volume "${sermon_restore_volume}:/restore" \
    --entrypoint sh community -ec '
      expected_uid="$1"
      expected_gid="$2"
      [ -d /restore/objects ] && [ ! -L /restore/objects ]
      if find /restore/objects -mindepth 1 ! -type f ! -type d \
        -print -quit | grep -q .; then
        printf "Unsupported entry in restored private objects tree.\n" >&2
        exit 80
      fi
      find /restore/objects -type d -exec chmod 0700 {} +
      find /restore/objects -type f -exec chmod 0600 {} +
      work="/tmp/heritage-sermon-restore.$$"
      mkdir "${work}"
      LC_ALL=C find /restore/objects -type d -print \
        | LC_ALL=C sort >"${work}/directories"
      LC_ALL=C find /restore/objects -type f -print \
        | LC_ALL=C sort >"${work}/files"

      while IFS= read -r path; do
        [ "$(stat -c "%u:%g:%a" "${path}")" \
          = "${expected_uid}:${expected_gid}:700" ] || exit 81
        [ "${path}" = "/restore/objects" ] && continue
        relative="${path#/restore/objects/}"
        saved_ifs="${IFS}"
        IFS="/"
        set -- ${relative}
        IFS="${saved_ifs}"
        case "$#" in
          1)
            [ "${#1}" = "64" ] || exit 82
            case "$1" in ""|*[!0-9a-f]*) exit 82 ;; esac
            ;;
          2)
            [ "${#1}" = "64" ] && [ "$2" = "sha256" ] || exit 82
            case "$1" in ""|*[!0-9a-f]*) exit 82 ;; esac
            ;;
          3)
            [ "${#1}" = "64" ] && [ "$2" = "sha256" ] \
              && [ "${#3}" = "2" ] || exit 82
            case "$1$3" in ""|*[!0-9a-f]*) exit 82 ;; esac
            ;;
          *)
            exit 82
            ;;
        esac
      done <"${work}/directories"

      while IFS= read -r path; do
        relative="${path#/restore/}"
        saved_ifs="${IFS}"
        IFS="/"
        set -- ${relative}
        IFS="${saved_ifs}"
        [ "$#" = "5" ] && [ "$1" = "objects" ] \
          && [ "${#2}" = "64" ] && [ "$3" = "sha256" ] \
          && [ "${#4}" = "2" ] && [ "${#5}" = "64" ] || exit 83
        case "$2$4$5" in ""|*[!0-9a-f]*) exit 83 ;; esac
        [ "${5%${5#??}}" = "$4" ] || exit 83
        metadata="$(stat -c "%u:%g:%a:%h:%s" "${path}")" || exit 84
        identity="${metadata%:*}"
        size="${metadata##*:}"
        [ "${identity}" = "${expected_uid}:${expected_gid}:600:1" ] \
          || exit 84
        case "${size}" in ""|*[!0-9]*) exit 84 ;; esac
        [ "${size}" -gt 0 ] || exit 84
        actual="$(sha256sum "${path}")" || exit 85
        actual="${actual%% *}"
        [ "${actual}" = "$5" ] || exit 85
        printf "%s\t%s\t%s\n" "${relative}" "${size}" "$5"
      done <"${work}/files"
      rm -rf -- "${work}"
    ' sh "${sermon_service_uid}" "${sermon_service_gid}" \
    >"${sermon_restore_inventory}" \
    || heritage_die "Temporary private recording objects failed path, digest, ownership, or mode verification."

  read -r restored_inventory_digest restored_inventory_count restored_inventory_bytes \
    < <(heritage_sermon_inventory_summary "${sermon_restore_inventory}")
  if [[ "${backup_format}" == "2" ]]; then
    cmp -- "${backup_path}/sermon-media.inventory" \
      "${sermon_restore_inventory}" \
      || heritage_die "Extracted private objects do not exactly match the format 2 inventory."
  else
    (( restored_inventory_count == 0 && restored_inventory_bytes == 0 )) \
      || heritage_die "Legacy format 1 unexpectedly prepared private recording objects."
  fi
}

validate_live_sermon_layout_for_restore() {
  heritage_compose run --rm --no-deps -T \
    --entrypoint sh community -ec '
      base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
      expected="$(id -u):$(id -g):700"
      umask 077
      [ -d "${base}" ] && [ ! -L "${base}" ] || exit 86
      [ "$(stat -c "%u:%g:%a" "${base}")" = "${expected}" ] || exit 87

      staging="${base}/staging"
      if [ -L "${staging}" ] \
        || { [ -e "${staging}" ] && [ ! -d "${staging}" ]; }; then
        exit 88
      fi
      if [ ! -e "${staging}" ]; then
        mkdir -m 0700 "${staging}" || exit 89
      fi
      [ -d "${staging}" ] && [ ! -L "${staging}" ] || exit 88
      [ "$(stat -c "%u:%g:%a" "${staging}")" = "${expected}" ] || exit 87
      if find "${staging}" -mindepth 1 -print -quit | grep -q .; then
        printf "Private recording staging is not empty; restore refuses replacement.\n" >&2
        exit 90
      fi

      objects="${base}/objects"
      if [ -L "${objects}" ] \
        || { [ -e "${objects}" ] && [ ! -d "${objects}" ]; }; then
        exit 92
      fi
      if [ -e "${objects}" ]; then
        [ "$(stat -c "%u:%g:%a" "${objects}")" = "${expected}" ] || exit 87
      fi

      for entry in "${base}"/* "${base}"/.[!.]* "${base}"/..?*; do
        [ -e "${entry}" ] || [ -L "${entry}" ] || continue
        case "${entry}" in
          "${staging}"|"${objects}") ;;
          *)
            printf "Unexpected entry in the private recording root; restore refuses replacement.\n" >&2
            exit 91
            ;;
        esac
      done
    ' || heritage_die \
    "The live private sermon-media layout is unsafe for restore; no live data was changed."
}

replace_private_sermon_media() {
  local swap_token

  swap_token="$(date -u '+%Y%m%d%H%M%S')-$$"
  heritage_compose run --rm --no-deps -T \
    --volume "${sermon_restore_volume}:/restore:ro" \
    --entrypoint sh community -ec '
      base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
      token="$1"
      expected_uid="$2"
      expected_gid="$3"
      new="${base}/.restore-new-${token}"
      old="${base}/.restore-old-${token}"
      umask 077
      [ -d "${base}" ] && [ ! -L "${base}" ] || exit 86
      [ -d "${base}/staging" ] && [ ! -L "${base}/staging" ] || exit 88
      if find "${base}/staging" -mindepth 1 -print -quit | grep -q .; then
        printf "Private recording staging is not empty; restore refuses replacement.\n" >&2
        exit 90
      fi
      if [ -e "${base}/objects" ] || [ -L "${base}/objects" ]; then
        [ -d "${base}/objects" ] && [ ! -L "${base}/objects" ] || exit 92
      fi
      if [ -e "${new}" ] || [ -L "${new}" ] || [ -e "${old}" ] || [ -L "${old}" ]; then
        printf "A sermon-media restore workspace already exists.\n" >&2
        exit 91
      fi
      mkdir -m 0700 "${new}"
      cp -R /restore/objects/. "${new}/"
      find "${new}" -type d -exec chmod 0700 {} +
      find "${new}" -type f -exec chmod 0600 {} +

      (
        cd /restore/objects
        find . -type f -exec sha256sum {} + | LC_ALL=C sort
      ) >/tmp/sermon-restore-expected
      (
        cd "${new}"
        find . -type f -exec sha256sum {} + | LC_ALL=C sort
      ) >/tmp/sermon-restore-actual
      cmp /tmp/sermon-restore-expected /tmp/sermon-restore-actual

      find "${new}" -type d -exec sh -ec '"'"'
        expected_uid="$1"
        expected_gid="$2"
        shift 2
        for path do
          [ "$(stat -c "%u:%g:%a" "${path}")" \
            = "${expected_uid}:${expected_gid}:700" ] || exit 1
        done
      '"'"' sh "${expected_uid}" "${expected_gid}" {} +
      find "${new}" -type f -exec sh -ec '"'"'
        expected_uid="$1"
        expected_gid="$2"
        shift 2
        for path do
          [ "$(stat -c "%u:%g:%a" "${path}")" \
            = "${expected_uid}:${expected_gid}:600" ] || exit 1
        done
      '"'"' sh "${expected_uid}" "${expected_gid}" {} +

      had_old=0
      if [ -e "${base}/objects" ] || [ -L "${base}/objects" ]; then
        mv "${base}/objects" "${old}"
        had_old=1
      fi
      if ! mv "${new}" "${base}/objects"; then
        if [ "${had_old}" = "1" ]; then
          mv "${old}" "${base}/objects" || true
        fi
        exit 93
      fi
      if [ "${had_old}" = "1" ]; then
        rm -rf -- "${old}"
      fi
    ' sh "${swap_token}" "${sermon_service_uid}" "${sermon_service_gid}" \
    || heritage_die "Private sermon-media replacement failed; the app remains stopped."
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e

  if [[ -n "${sermon_restore_volume}" ]]; then
    heritage_docker volume rm "${sermon_restore_volume}" >/dev/null 2>&1 \
      || heritage_warn "Temporary restore volume remains: ${sermon_restore_volume}"
  fi
  if [[ -n "${sermon_restore_inventory}" ]]; then
    rm -f -- "${sermon_restore_inventory}"
  fi

  if (( status != 0 )); then
    heritage_warn "Restore did not finish. Safety backup: ${safety_backup}"
    if (( destructive_started || leave_app_stopped_on_failure )); then
      heritage_compose stop --timeout 60 community >/dev/null 2>&1 || true
      if (( destructive_started )); then
        heritage_warn "Live data may be incomplete. The application remains stopped; inspect the error and restore the safety backup."
      else
        heritage_warn "The safety backup did not complete. The application remains stopped for inspection."
      fi
      heritage_warn "The Cloudflare connector was left running to preserve remote recovery access; public app requests may report the origin as unavailable."
    elif (( community_was_running )); then
      heritage_warn "Attempting to restart the previously running community app."
      if (( community_was_running )); then
        heritage_compose up -d community >/dev/null
      fi
    fi
  fi

  exit "${status}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if heritage_service_running community; then
  community_was_running=1
fi

heritage_info "Stopping the community app during restore; the Cloudflare connector remains running for recovery access."
heritage_compose stop --timeout 60 community >/dev/null \
  || heritage_die "Could not stop the Community app. No live data was changed."

if (( skip_safety_backup )); then
  heritage_warn "Proceeding without a pre-restore safety backup."
else
  heritage_info "Creating a pre-restore safety backup while the app remains continuously stopped."
  leave_app_stopped_on_failure=1
  "${SCRIPT_DIR}/backup.sh" \
    --install-dir "${HERITAGE_INSTALL_DIR}" \
    --output-dir "${HERITAGE_BACKUP_DIR}" \
    --retention-days 0 \
    --label pre-restore \
    --quiesce
  safety_backup="$(heritage_latest_backup)"
  leave_app_stopped_on_failure=0
fi

heritage_info "Rechecking the selected restore source after the safety backup."
heritage_verify_backup "${backup_path}" >/dev/null
heritage_compose run --rm --no-deps -T --entrypoint pg_restore postgres --list \
  <"${backup_path}/database.dump" >/dev/null \
  || heritage_die "The selected PostgreSQL dump changed or became unreadable; live data was not changed."
heritage_validate_tar_archive "${backup_path}/media.tar.gz" generic \
  || heritage_die "The selected media archive changed or became unsafe; live data was not changed."
if [[ "${backup_format}" == "2" ]]; then
  heritage_validate_tar_archive "${backup_path}/sermon-media.tar.gz" sermon-media \
    || heritage_die "The selected private sermon-media archive changed or became unsafe; live data was not changed."
fi
if [[ "${backup_format}" == "1" \
  && ( "${restore_database}" != "1" || "${restore_media}" != "1" ) ]]; then
  assert_legacy_partial_restore_safe
fi

heritage_compose up -d postgres >/dev/null
heritage_wait_for_postgres 60 || heritage_die "PostgreSQL did not become ready."

if (( restore_media )); then
  prepare_sermon_restore_volume
  validate_live_sermon_layout_for_restore
fi

if (( restore_database )); then
  heritage_info "Replacing the PostgreSQL database."
  destructive_started=1
  heritage_compose exec -T postgres sh -ec '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    dropdb --maintenance-db=template1 --username="$POSTGRES_USER" --force --if-exists "$POSTGRES_DB"
    createdb --maintenance-db=template1 --username="$POSTGRES_USER" --owner="$POSTGRES_USER" "$POSTGRES_DB"
  '
  heritage_compose exec -T postgres sh -ec \
    'exec pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-owner --no-privileges --exit-on-error' \
    <"${backup_path}/database.dump"

  heritage_info "Applying current forward database migrations."
  heritage_compose run --rm -T migrate

  restored_database_inventory="$(mktemp \
    "${TMPDIR:-/tmp}/heritage-restored-database-inventory.XXXXXX")"
  heritage_capture_sermon_database_inventory "${restored_database_inventory}"
  if [[ "${backup_format}" == "2" ]]; then
    cmp -- "${backup_path}/sermon-media.inventory" \
      "${restored_database_inventory}" \
      || heritage_die "Restored database recording rows do not exactly match the format 2 object inventory."
  elif [[ -s "${restored_database_inventory}" ]]; then
    heritage_die "Legacy format 1 restored unexpected managed sermon-media database rows."
  fi
  rm -f -- "${restored_database_inventory}"
fi

if (( restore_media )); then
  heritage_info "Replacing uploaded media."
  destructive_started=1
  heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
    cd /app/media
    for entry in .[!.]* ..?* *; do
      if [ -e "$entry" ] || [ -L "$entry" ]; then
        rm -rf -- "$entry"
      fi
    done
    tar -xzf - -C /app/media
  ' <"${backup_path}/media.tar.gz"

  heritage_info "Replacing finalized private sermon recordings."
  replace_private_sermon_media
fi

if (( start_after )); then
  heritage_info "Starting Heritage Community."
  heritage_compose up -d postgres community
  # Never reconcile a connector that is already running: it may carry this
  # restore session's SSH transport. Start token mode only when no connector
  # exists, after the application is available again.
  if heritage_compose config --services | grep -qx cloudflared \
    && ! heritage_service_running cloudflared; then
    heritage_info "Starting the configured Cloudflare connector because it was not running."
    heritage_compose up -d cloudflared
  fi
  "${SCRIPT_DIR}/status.sh" \
    --install-dir "${HERITAGE_INSTALL_DIR}" \
    --backup-dir "${HERITAGE_BACKUP_DIR}" \
    --recording-coverage-backup "${backup_path}" \
    --wait 90
else
  heritage_info "Restore complete; the community app was left stopped by request."
  heritage_info "The Cloudflare connector remains running for recovery access, though public app requests will be unavailable."
fi

heritage_info "Restore complete. Safety backup: ${safety_backup}"
