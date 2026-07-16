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
  [[ -d "${backup_dir}" ]] || heritage_die "Backup directory not found: ${backup_dir}"
  [[ -f "${backup_dir}/manifest.env" ]] || heritage_die "Backup manifest missing: ${backup_dir}/manifest.env"
  [[ -f "${backup_dir}/SHA256SUMS" ]] || heritage_die "Backup checksums missing: ${backup_dir}/SHA256SUMS"
  [[ -f "${backup_dir}/database.dump" ]] || heritage_die "Database dump missing from backup."
  [[ -f "${backup_dir}/media.tar.gz" ]] || heritage_die "Media archive missing from backup."

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
