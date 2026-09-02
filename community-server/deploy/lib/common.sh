#!/usr/bin/env bash

# Shared helpers for Heritage Community operator commands. Entry-point scripts
# deliberately enable their own shell options before sourcing this file.

HERITAGE_DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
HERITAGE_DEFAULT_INSTALL_DIR="$(cd -- "${HERITAGE_DEPLOY_DIR}/.." && pwd -P)"

heritage_info() {
  printf '[heritage] %s\n' "$*"
}

heritage_warn() {
  printf '[heritage] WARNING: %s\n' "$*" >&2
}

heritage_die() {
  printf '[heritage] ERROR: %s\n' "$*" >&2
  exit 1
}

heritage_require_command() {
  command -v "$1" >/dev/null 2>&1 || heritage_die "Required command not found: $1"
}

heritage_realpath_allow_missing() {
  local requested="$1"
  local parent
  local basename
  local resolved_parent

  if realpath -m -- "${requested}" 2>/dev/null; then
    return 0
  fi
  if [[ -e "${requested}" || -L "${requested}" ]]; then
    realpath -- "${requested}"
    return
  fi
  parent="$(dirname -- "${requested}")"
  basename="$(basename -- "${requested}")"
  [[ "${parent}" != "${requested}" ]] || return 1
  resolved_parent="$(heritage_realpath_allow_missing "${parent}")" || return
  printf '%s/%s\n' "${resolved_parent%/}" "${basename}"
}

heritage_is_nonnegative_integer() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

heritage_init_context() {
  HERITAGE_INSTALL_DIR="${HERITAGE_INSTALL_DIR:-${HERITAGE_DEFAULT_INSTALL_DIR}}"
  [[ -d "${HERITAGE_INSTALL_DIR}" ]] || heritage_die "Installation directory does not exist: ${HERITAGE_INSTALL_DIR}"
  HERITAGE_INSTALL_DIR="$(cd -- "${HERITAGE_INSTALL_DIR}" && pwd -P)"

  HERITAGE_COMPOSE_FILE="${HERITAGE_COMPOSE_FILE:-${HERITAGE_INSTALL_DIR}/docker-compose.production.yml}"
  HERITAGE_ENV_FILE="${HERITAGE_ENV_FILE:-${HERITAGE_INSTALL_DIR}/.env.production}"
  HERITAGE_PROJECT_NAME="${HERITAGE_PROJECT_NAME:-heritage-community}"
  HERITAGE_BACKUP_DIR="${HERITAGE_BACKUP_DIR:-/var/backups/heritage-community}"

  [[ -f "${HERITAGE_COMPOSE_FILE}" ]] || heritage_die "Production Compose file not found: ${HERITAGE_COMPOSE_FILE}"
  [[ -f "${HERITAGE_ENV_FILE}" ]] || heritage_die "Production environment file not found: ${HERITAGE_ENV_FILE}"

  HERITAGE_COMPOSE_PROFILE_ARGS=()
  if [[ -n "$(heritage_env_value TUNNEL_TOKEN "${HERITAGE_ENV_FILE}")" ]]; then
    HERITAGE_COMPOSE_PROFILE_ARGS=(--profile cloudflare-token)
  fi
}

heritage_init_docker() {
  heritage_require_command docker

  if docker info >/dev/null 2>&1; then
    HERITAGE_DOCKER=(docker)
  elif [[ "$(id -u)" -ne 0 ]] && command -v sudo >/dev/null 2>&1; then
    heritage_info "Docker requires elevated access; sudo may ask for your password."
    sudo -v || heritage_die "Could not obtain sudo access for Docker."
    sudo docker info >/dev/null 2>&1 || heritage_die "Docker is installed, but its daemon is unavailable."
    HERITAGE_DOCKER=(sudo docker)
  else
    heritage_die "Docker is installed, but its daemon is unavailable to this user."
  fi

  "${HERITAGE_DOCKER[@]}" compose version >/dev/null 2>&1 || \
    heritage_die "The Docker Compose plugin is not installed."
}

heritage_docker() {
  "${HERITAGE_DOCKER[@]}" "$@"
}

heritage_compose() {
  "${HERITAGE_DOCKER[@]}" compose \
    --project-name "${HERITAGE_PROJECT_NAME}" \
    --env-file "${HERITAGE_ENV_FILE}" \
    --file "${HERITAGE_COMPOSE_FILE}" \
    "${HERITAGE_COMPOSE_PROFILE_ARGS[@]}" \
    "$@"
}

# Read one literal dotenv value without sourcing the file as shell code. This
# intentionally does not expand $variables or backslash escapes.
heritage_env_value() {
  local key="$1"
  local file="${2:-${HERITAGE_ENV_FILE}}"

  awk -v wanted="${key}" '
    {
      line = $0
      sub(/\r$/, "", line)
    }
    line ~ "^[[:space:]]*" wanted "[[:space:]]*=" {
      sub("^[[:space:]]*" wanted "[[:space:]]*=[[:space:]]*", "", line)
      if (line ~ /^\047.*\047[[:space:]]*$/) {
        sub(/^\047/, "", line)
        sub(/\047[[:space:]]*$/, "", line)
      } else if (line ~ /^\".*\"[[:space:]]*$/) {
        sub(/^\"/, "", line)
        sub(/\"[[:space:]]*$/, "", line)
      } else {
        sub(/[[:space:]]+#.*$/, "", line)
        sub(/[[:space:]]*$/, "", line)
      }
      print line
      exit
    }
  ' "${file}"
}

heritage_manifest_value() {
  local key="$1"
  local file="$2"

  awk -v wanted="${key}" '
    {
      line = $0
      sub(/\r$/, "", line)
    }
    line ~ "^" wanted "=" {
      sub("^" wanted "=", "", line)
      print line
      exit
    }
  ' "${file}"
}

heritage_volume_name() {
  local key="$1"
  local fallback="$2"
  local value="${!key:-}"

  if [[ -z "${value}" ]]; then
    value="$(heritage_env_value "${key}")"
  fi
  value="${value:-${fallback}}"
  [[ "${value}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || \
    heritage_die "${key} is not a safe Docker volume name."
  printf '%s\n' "${value}"
}

heritage_sermon_media_volume_name() {
  heritage_volume_name HERITAGE_SERMON_MEDIA_VOLUME heritage-community-sermon-media
}

heritage_config_value() {
  local key="$1"
  local fallback="${2:-}"
  local value="${!key:-}"

  if [[ -z "${value}" ]]; then
    value="$(heritage_env_value "${key}")"
  fi
  printf '%s\n' "${value:-${fallback}}"
}

heritage_backup_format() {
  local backup_dir="$1"
  local format

  format="$(heritage_manifest_value HERITAGE_BACKUP_FORMAT "${backup_dir}/manifest.env")"
  case "${format}" in
    1|2)
      printf '%s\n' "${format}"
      ;;
    *)
      heritage_warn "Unsupported or missing Heritage backup format: ${format:-missing}"
      return 1
      ;;
  esac
}

# Validate an archive before any extraction. The generic layout accepts only
# regular files and directories with relative, traversal-free paths. The
# sermon-media layout is narrower: one immutable tenant-scoped,
# content-addressed objects tree and no duplicate archive members.
heritage_validate_tar_archive() {
  local archive="$1"
  local layout="${2:-generic}"

  tar -tzf "${archive}" >/dev/null 2>&1 || {
    heritage_warn "Archive is corrupt: ${archive}"
    return 1
  }
  if tar -tvzf "${archive}" 2>/dev/null | awk '
    substr($1, 1, 1) != "-" && substr($1, 1, 1) != "d" { unsafe = 1 }
    END { exit unsafe ? 0 : 1 }
  '; then
    heritage_warn "Archive contains a link, device, or unsupported entry type: ${archive}"
    return 1
  fi
  if tar -tzf "${archive}" 2>/dev/null | awk '
    BEGIN { unsafe = 0 }
    /^\// { unsafe = 1 }
    {
      count = split($0, parts, "/")
      for (i = 1; i <= count; i++) {
        if (parts[i] == "..") unsafe = 1
      }
    }
    END { exit unsafe ? 0 : 1 }
  '; then
    heritage_warn "Archive contains an unsafe path: ${archive}"
    return 1
  fi

  if [[ "${layout}" == "sermon-media" ]]; then
    if ! tar -tzf "${archive}" 2>/dev/null | LC_ALL=C awk '
      function invalid_hex(value) {
        return value ~ /[^0-9a-f]/
      }
      {
        path = $0
        sub(/^\.\//, "", path)
        sub(/\/$/, "", path)
        if (path == "") next
        if (seen[path]++) unsafe = 1
        count = split(path, parts, "/")
        allowed = 0
        if (count == 1 && parts[1] == "objects") {
          allowed = 1
          found_root = 1
        } else if (count == 2 && parts[1] == "objects") {
          if (length(parts[2]) == 64 && !invalid_hex(parts[2])) allowed = 1
        } else if (count == 3) {
          if (parts[1] == "objects" && length(parts[2]) == 64) {
            if (!invalid_hex(parts[2]) && parts[3] == "sha256") allowed = 1
          }
        } else if (count == 4) {
          if (parts[1] == "objects" && length(parts[2]) == 64) {
            if (!invalid_hex(parts[2]) && parts[3] == "sha256") {
              if (length(parts[4]) == 2 && !invalid_hex(parts[4])) allowed = 1
            }
          }
        } else if (count == 5) {
          if (parts[1] == "objects" && length(parts[2]) == 64) {
            if (!invalid_hex(parts[2]) && parts[3] == "sha256") {
              if (length(parts[4]) == 2 && !invalid_hex(parts[4])) {
                if (length(parts[5]) == 64 && !invalid_hex(parts[5])) {
                  if (substr(parts[5], 1, 2) == parts[4]) allowed = 1
                }
              }
            }
          }
        }
        if (!allowed) unsafe = 1
      }
      END { exit (!found_root || unsafe) ? 1 : 0 }
    '; then
      heritage_warn "Sermon-media archive does not contain exactly one safe content-addressed objects tree."
      return 1
    fi
  elif [[ "${layout}" != "generic" ]]; then
    heritage_warn "Unknown archive validation layout: ${layout}"
    return 1
  fi
}

# Emit one canonical TSV line per finalized private recording:
# relative storage key, byte length, and digest derived from the locked path.
# Full backup mode additionally hashes every byte and rejects a path/content
# mismatch. Metadata-only mode supports status without rereading the library.
heritage_capture_sermon_inventory() {
  local destination="$1"
  local verify_content="${2:-0}"
  local read_only_volume="${3:-}"
  local inventory_command

  [[ "${verify_content}" == "0" || "${verify_content}" == "1" ]] \
    || heritage_die "Inventory content verification must be 0 or 1."
  inventory_command='
    verify_content="$1"
    base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
    objects="${base}/objects"
    [ -d "${base}" ] && [ ! -L "${base}" ] || exit 61
    if [ ! -e "${objects}" ]; then
      exit 0
    fi
    [ -d "${objects}" ] && [ ! -L "${objects}" ] || exit 62
    work="/tmp/heritage-sermon-inventory.$$"
    mkdir "${work}"
    if find "${objects}" -mindepth 1 ! -type f ! -type d \
      -print -quit | grep -q .; then
      exit 63
    fi
    LC_ALL=C find "${objects}" -mindepth 1 -type d -print \
      | LC_ALL=C sort >"${work}/directories"
    LC_ALL=C find "${objects}" -mindepth 1 -type f -print \
      | LC_ALL=C sort >"${work}/files"
    awk -v prefix="${objects}/" '"'"'
      function bad_hex(value) { return value ~ /[^0-9a-f]/ }
      {
        path = substr($0, length(prefix) + 1)
        count = split(path, parts, "/")
        allowed = 0
        if (count == 1 && length(parts[1]) == 64 && !bad_hex(parts[1])) {
          allowed = 1
        } else if (count == 2 && length(parts[1]) == 64) {
          if (!bad_hex(parts[1]) && parts[2] == "sha256") allowed = 1
        } else if (count == 3 && length(parts[1]) == 64) {
          if (!bad_hex(parts[1]) && parts[2] == "sha256") {
            if (length(parts[3]) == 2 && !bad_hex(parts[3])) allowed = 1
          }
        }
        if (!allowed || seen[path]++) invalid = 1
      }
      END { exit invalid ? 1 : 0 }
    '"'"' "${work}/directories" || exit 64
    awk -v prefix="${objects}/" '"'"'
      function bad_hex(value) { return value ~ /[^0-9a-f]/ }
      {
        path = substr($0, length(prefix) + 1)
        count = split(path, parts, "/")
        allowed = count == 4
        if (allowed && (length(parts[1]) != 64 || bad_hex(parts[1]))) allowed = 0
        if (allowed && parts[2] != "sha256") allowed = 0
        if (allowed && (length(parts[3]) != 2 || bad_hex(parts[3]))) allowed = 0
        if (allowed && (length(parts[4]) != 64 || bad_hex(parts[4]))) allowed = 0
        if (allowed && substr(parts[4], 1, 2) != parts[3]) allowed = 0
        if (!allowed || seen[path]++) invalid = 1
      }
      END { exit invalid ? 1 : 0 }
    '"'"' "${work}/files" || exit 65

    expected_uid="$(id -u)"
    expected_gid="$(id -g)"
    find "${objects}" -type d -exec sh -ec '"'"'
      expected_uid="$1"
      expected_gid="$2"
      shift 2
      for path do
        [ "$(stat -c "%u:%g:%a" "${path}")" \
          = "${expected_uid}:${expected_gid}:700" ] || exit 1
      done
    '"'"' sh "${expected_uid}" "${expected_gid}" {} + || exit 66

    while IFS= read -r path; do
      relative="${path#${base}/}"
      digest="${path##*/}"
      metadata="$(stat -c "%u:%g:%a:%h:%s" "${path}")" || exit 67
      identity="${metadata%:*}"
      size="${metadata##*:}"
      [ "${identity}" = "${expected_uid}:${expected_gid}:600:1" ] || exit 68
      case "${size}" in
        ""|*[!0-9]*) exit 69 ;;
      esac
      [ "${size}" -gt 0 ] || exit 70
      if [ "${verify_content}" = "1" ]; then
        actual="$(sha256sum "${path}")" || exit 71
        actual="${actual%% *}"
        [ "${actual}" = "${digest}" ] || exit 72
      fi
      printf "%s\t%s\t%s\n" "${relative}" "${size}" "${digest}"
    done <"${work}/files"
    rm -rf -- "${work}"
  '

  if heritage_service_running community; then
    heritage_compose exec -T community sh -ec "${inventory_command}" \
      sh "${verify_content}" >"${destination}" \
      || heritage_die "Private sermon-media inventory validation failed."
  elif [[ -n "${read_only_volume}" ]]; then
    local stopped_container
    local community_image
    stopped_container="$(
      heritage_compose ps --all --quiet community 2>/dev/null | head -n 1
    )"
    [[ -n "${stopped_container}" ]] \
      || heritage_die "No existing Community container is available for read-only inventory."
    community_image="$(
      heritage_docker inspect --format '{{.Image}}' "${stopped_container}" 2>/dev/null
    )"
    [[ -n "${community_image}" ]] \
      || heritage_die "Could not resolve the existing Community image for read-only inventory."
    heritage_docker run --rm \
      --network none \
      --read-only \
      --user 1001:1001 \
      --volume "${read_only_volume}:/app/private/sermon-media:ro" \
      --tmpfs /tmp:rw,noexec,nosuid,size=32m \
      --entrypoint sh \
      "${community_image}" \
      -ec "${inventory_command}" sh "${verify_content}" >"${destination}" \
      || heritage_die "Read-only private sermon-media inventory validation failed."
  else
    heritage_compose run --rm --no-deps -T --entrypoint sh community \
      -ec "${inventory_command}" sh "${verify_content}" >"${destination}" \
      || heritage_die "Private sermon-media inventory validation failed."
  fi
}

heritage_sermon_inventory_summary() {
  local inventory="$1"
  local metrics
  local digest

  [[ -f "${inventory}" ]] || heritage_die "Private sermon-media inventory is missing."
  LC_ALL=C sort -c "${inventory}" 2>/dev/null \
    || heritage_die "Private sermon-media inventory is not in canonical order."
  metrics="$(awk -F '\t' '
    function bad_hex(value) { return value ~ /[^0-9a-f]/ }
    {
      if (NF != 3) invalid = 1
      path = $1
      size = $2
      digest = $3
      count = split(path, parts, "/")
      if (count != 5 || parts[1] != "objects") invalid = 1
      if (length(parts[2]) != 64 || bad_hex(parts[2])) invalid = 1
      if (parts[3] != "sha256") invalid = 1
      if (length(parts[4]) != 2 || bad_hex(parts[4])) invalid = 1
      if (length(parts[5]) != 64 || bad_hex(parts[5])) invalid = 1
      if (parts[5] != digest || substr(digest, 1, 2) != parts[4]) invalid = 1
      if (size !~ /^[1-9][0-9]*$/) invalid = 1
      if (length(digest) != 64 || bad_hex(digest)) invalid = 1
      if (seen[path]++) invalid = 1
      total += size
      objects++
    }
    END {
      if (invalid || total > 9007199254740991) exit 1
      printf "%.0f %.0f\n", objects + 0, total + 0
    }
  ' "${inventory}")" \
    || heritage_die "Private sermon-media inventory is invalid."
  digest="$(sha256sum "${inventory}")"
  digest="${digest%% *}"
  printf '%s %s\n' "${digest}" "${metrics}"
}

heritage_service_running() {
  local service="$1"
  local container_id
  local running

  container_id="$(heritage_compose ps --quiet "${service}" 2>/dev/null || true)"
  [[ -n "${container_id}" ]] || return 1
  running="$(heritage_docker inspect --format '{{.State.Running}}' "${container_id}" 2>/dev/null || true)"
  [[ "${running}" == "true" ]]
}

heritage_wait_for_postgres() {
  local wait_seconds="${1:-60}"
  local elapsed=0

  while (( elapsed < wait_seconds )); do
    if heritage_compose exec -T postgres sh -ec \
      'exec pg_isready --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

heritage_sermon_media_schema_present() {
  local table_count

  table_count="$(heritage_compose exec -T postgres sh -ec '
    exec psql \
      --username="$POSTGRES_USER" \
      --dbname="$POSTGRES_DB" \
      --tuples-only \
      --no-align \
      --set=ON_ERROR_STOP=1 \
      --command="SELECT count(*) FROM (VALUES
        ('\''public.syncshow_sermon_media_objects'\''),
        ('\''public.syncshow_sermon_media_uploads'\''),
        ('\''public.syncshow_sermon_media_chunks'\'')
      ) AS managed(name) WHERE to_regclass(name) IS NOT NULL"
  ' 2>/dev/null)" || return 2
  table_count="${table_count//$'\r'/}"
  table_count="${table_count//$'\n'/}"
  case "${table_count}" in
    3)
      return 0
      ;;
    0)
      return 1
      ;;
    *)
      # A partial managed-media schema is neither an installed schema nor a
      # valid pre-migration database. Fail closed instead of treating it as an
      # empty legacy store.
      return 2
      ;;
  esac
}

# Derive totals from the same deduplicated inventory used by backup/restore.
# Counting just the recording table omits saved service images and videos.
heritage_sermon_media_database_summary() {
  local inventory digest count bytes
  inventory="$(mktemp "${TMPDIR:-/tmp}/heritage-media-summary.XXXXXX")" || return 1
  if ! (heritage_capture_sermon_database_inventory "${inventory}"); then
    rm -f -- "${inventory}"
    return 1
  fi
  read -r digest count bytes < <(heritage_sermon_inventory_summary "${inventory}")
  rm -f -- "${inventory}"
  [[ "${count} ${bytes}" =~ ^[0-9]+\ [0-9]+$ ]] || return 1
  printf '%s %s\n' "${count}" "${bytes}"
}

# Capture the database side of the same canonical inventory contract used for
# the private object store. This exact row-level comparison prevents equal
# count/byte totals from hiding a missing object plus a same-sized orphan.
heritage_capture_sermon_database_inventory() {
  local destination="$1"

  if heritage_sermon_media_schema_present; then
    heritage_compose exec -T postgres sh -ec '
      exec psql \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
        --tuples-only \
        --no-align \
        --set=ON_ERROR_STOP=1 \
        --command="SELECT storage_key || chr(9) || size_bytes::text || chr(9) || sha256 FROM public.syncshow_sermon_media_objects ORDER BY storage_key"
    ' >"${destination}" \
      || heritage_die "Could not capture the managed sermon-media database inventory."
  else
    local schema_status=$?
    (( schema_status == 1 )) \
      || heritage_die "Could not determine whether managed sermon-media tables exist."
    : >"${destination}"
  fi
  # Service media shares this object store but is not a recording-table row.
  # Include immutable service history so saved revisions remain recoverable.
  local service_table_count
  service_table_count="$(heritage_compose exec -T postgres sh -ec '
    exec psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -At -v ON_ERROR_STOP=1 \
      --command="SELECT COUNT(*) FROM pg_tables WHERE schemaname = '\''public'\'' AND tablename IN ('\''service_documents'\'', '\''syncshow_service_document_changes'\'')"
  ')" || heritage_die "Could not inspect the service media schema."
  if [[ "${service_table_count}" == "2" ]]; then
    heritage_compose exec -T postgres sh -ec '
      exec psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -At -F "$(printf "\t")" -v ON_ERROR_STOP=1
    ' <"${HERITAGE_DEPLOY_DIR}/../scripts/service-document-asset-inventory.sql" >>"${destination}" \
      || heritage_die "Could not inventory saved service media."
    LC_ALL=C sort -u -o "${destination}" "${destination}"
  elif [[ "${service_table_count}" != "0" ]]; then
    heritage_die "Service-document media schema is incomplete."
  fi
  # Validate shape, ordering, totals, and digest even when the caller only
  # needs exact cmp semantics.
  heritage_sermon_inventory_summary "${destination}" >/dev/null
}

heritage_acquire_operations_lock() {
  if [[ "${HERITAGE_OPS_LOCK_HELD:-0}" == "1" ]]; then
    return 0
  fi

  heritage_require_command flock
  local lock_root="/run/lock"
  local lock_key
  if [[ ! -d "${lock_root}" || ! -w "${lock_root}" ]]; then
    lock_root="${TMPDIR:-/tmp}"
  fi
  lock_key="$(printf '%s' "${HERITAGE_INSTALL_DIR}" | cksum | awk '{print $1}')"
  HERITAGE_OPS_LOCK_FILE="${lock_root%/}/heritage-community-${lock_key}.lock"

  # File descriptor 8 remains open for the process lifetime. Child operator
  # commands receive the marker and reuse the parent lock instead of deadlocking.
  exec 8>"${HERITAGE_OPS_LOCK_FILE}"
  flock -n 8 || heritage_die "Another backup, restore, or update is already running."
  export HERITAGE_OPS_LOCK_HELD=1
}

heritage_prepare_backup_root() {
  local requested="${HERITAGE_BACKUP_DIR}"
  [[ -n "${requested}" ]] || heritage_die "Backup directory must not be empty."
  [[ "${requested}" == /* ]] || heritage_die "Backup directory must be an absolute path: ${requested}"
  [[ "${requested}" != "/" ]] || heritage_die "Refusing to use / as the backup directory."

  mkdir -p -- "${requested}" || heritage_die "Cannot create backup directory: ${requested}"
  HERITAGE_BACKUP_DIR="$(cd -- "${requested}" && pwd -P)"
  [[ "${HERITAGE_BACKUP_DIR}" != "${HERITAGE_INSTALL_DIR}" ]] || \
    heritage_die "The backup directory cannot be the installation directory itself."

  umask 077
  if [[ ! -f "${HERITAGE_BACKUP_DIR}/.heritage-community-backups" ]]; then
    printf 'Heritage Community backup root. Operator scripts may prune marked child backups.\n' \
      >"${HERITAGE_BACKUP_DIR}/.heritage-community-backups"
  fi
}

heritage_latest_backup() {
  local link="${HERITAGE_BACKUP_DIR}/latest"
  local target

  if [[ -L "${link}" ]]; then
    target="$(readlink "${link}")"
    if [[ "${target}" != /* ]]; then
      target="${HERITAGE_BACKUP_DIR}/${target}"
    fi
    [[ -d "${target}" ]] && {
      printf '%s\n' "$(cd -- "${target}" && pwd -P)"
      return 0
    }
  fi

  find "${HERITAGE_BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -name 'backup-20*' -print 2>/dev/null \
    | LC_ALL=C sort -r \
    | head -n 1
}

heritage_verify_backup() {
  local backup_dir="$1"
  local format
  local expected_checksum_count
  local inventory_digest
  local inventory_count
  local inventory_bytes
  [[ -d "${backup_dir}" ]] || heritage_die "Backup directory not found: ${backup_dir}"
  [[ -f "${backup_dir}/manifest.env" ]] || heritage_die "Backup manifest missing: ${backup_dir}/manifest.env"
  [[ -f "${backup_dir}/SHA256SUMS" ]] || heritage_die "Backup checksums missing: ${backup_dir}/SHA256SUMS"
  [[ -f "${backup_dir}/database.dump" ]] || heritage_die "Database dump missing from backup."
  [[ -f "${backup_dir}/media.tar.gz" ]] || heritage_die "Media archive missing from backup."
  [[ -f "${backup_dir}/recovery.tar.gz" ]] || heritage_die "Recovery archive missing from backup."

  format="$(heritage_backup_format "${backup_dir}")" || heritage_die "Backup format validation failed."
  [[ "$(heritage_manifest_value DATABASE_FILE "${backup_dir}/manifest.env")" == "database.dump" ]] \
    || heritage_die "Backup manifest has an unexpected database filename."
  [[ "$(heritage_manifest_value MEDIA_FILE "${backup_dir}/manifest.env")" == "media.tar.gz" ]] \
    || heritage_die "Backup manifest has an unexpected media filename."
  [[ "$(heritage_manifest_value RECOVERY_FILE "${backup_dir}/manifest.env")" == "recovery.tar.gz" ]] \
    || heritage_die "Backup manifest has an unexpected recovery filename."

  expected_checksum_count=4
  if [[ "${format}" == "2" ]]; then
    [[ "$(heritage_manifest_value SERMON_MEDIA_FILE "${backup_dir}/manifest.env")" \
      == "sermon-media.tar.gz" ]] \
      || heritage_die "Format 2 backup manifest has an unexpected sermon-media filename."
    [[ "$(heritage_manifest_value SERMON_MEDIA_LAYOUT "${backup_dir}/manifest.env")" \
      == "tenant-objects-sha256-v1" ]] \
      || heritage_die "Format 2 backup manifest has an unsupported sermon-media layout."
    [[ "$(heritage_manifest_value SERMON_MEDIA_INVENTORY_FILE "${backup_dir}/manifest.env")" \
      == "sermon-media.inventory" ]] \
      || heritage_die "Format 2 backup manifest has an unexpected sermon-media inventory filename."
    [[ -f "${backup_dir}/sermon-media.tar.gz" ]] \
      || heritage_die "Format 2 backup is missing sermon-media.tar.gz."
    [[ -f "${backup_dir}/sermon-media.inventory" ]] \
      || heritage_die "Format 2 backup is missing sermon-media.inventory."
    read -r inventory_digest inventory_count inventory_bytes \
      < <(heritage_sermon_inventory_summary "${backup_dir}/sermon-media.inventory")
    [[ "${inventory_digest}" \
      == "$(heritage_manifest_value SERMON_MEDIA_INVENTORY_SHA256 "${backup_dir}/manifest.env")" ]] \
      || heritage_die "Format 2 sermon-media inventory digest does not match its manifest."
    [[ "${inventory_count}" \
      == "$(heritage_manifest_value SERMON_MEDIA_OBJECT_COUNT "${backup_dir}/manifest.env")" ]] \
      || heritage_die "Format 2 sermon-media object count does not match its manifest."
    [[ "${inventory_bytes}" \
      == "$(heritage_manifest_value SERMON_MEDIA_OBJECT_BYTES "${backup_dir}/manifest.env")" ]] \
      || heritage_die "Format 2 sermon-media byte count does not match its manifest."
    expected_checksum_count=6
  elif [[ -e "${backup_dir}/sermon-media.tar.gz" \
    || -e "${backup_dir}/sermon-media.inventory" ]]; then
    heritage_die "Format 1 backup unexpectedly contains private sermon-media artifacts."
  fi

  awk -v format="${format}" -v expected="${expected_checksum_count}" '
    NF != 2 { invalid = 1; next }
    length($1) != 64 || $1 ~ /[^0-9a-f]/ { invalid = 1 }
    {
      filename = $2
      allowed = 0
      if (filename == "database.dump") allowed = 1
      if (filename == "media.tar.gz") allowed = 1
      if (filename == "recovery.tar.gz") allowed = 1
      if (filename == "manifest.env") allowed = 1
      if (format == "2" && filename == "sermon-media.tar.gz") allowed = 1
      if (format == "2" && filename == "sermon-media.inventory") allowed = 1
      if (!allowed) {
        invalid = 1
      }
      if (seen[filename]++) invalid = 1
      count++
    }
    END {
      if (count != expected) invalid = 1
      exit invalid ? 1 : 0
    }
  ' "${backup_dir}/SHA256SUMS" \
    || heritage_die "Backup checksum manifest is not the exact format ${format} file set."

  (
    cd -- "${backup_dir}" || exit
    sha256sum --check --strict SHA256SUMS
  )
}

heritage_confirm_exact() {
  local expected="$1"
  local prompt="$2"
  local answer

  [[ -t 0 ]] || heritage_die "Interactive confirmation is required. Re-run with --yes only after reviewing the command."
  printf '%s\n' "${prompt}" >&2
  printf 'Type %s to continue: ' "${expected}" >&2
  IFS= read -r answer
  [[ "${answer}" == "${expected}" ]] || heritage_die "Confirmation did not match; nothing was changed."
}
