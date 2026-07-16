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
  --no-start               Leave application services stopped after restore
  --yes                    Skip the exact typed confirmation
  -h, --help               Show this help

Safety behavior:
  * SHA-256 checksums and the archive structure are verified before changes.
  * A full pre-restore backup is created by default.
  * The app is stopped before replacing the database or media.
  * Current forward database migrations run after a database restore.

Restore is intentionally not automatic rollback. If it fails before live data
changes, the script restarts only services that were running. If it fails after
replacement starts, it prints the safety backup and keeps public/app services
stopped for deliberate recovery.
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

# Ensure the media archive can be listed and contains no absolute or parent
# traversal paths before it is ever streamed into the media volume.
tar -tzf "${backup_path}/media.tar.gz" >/dev/null || heritage_die "Media archive is corrupt."
if tar -tvzf "${backup_path}/media.tar.gz" | awk '
  substr($1, 1, 1) != "-" && substr($1, 1, 1) != "d" { unsafe = 1 }
  END { exit unsafe ? 0 : 1 }
'; then
  heritage_die "Media archive contains a link, device, or unsupported entry type."
fi
if tar -tzf "${backup_path}/media.tar.gz" | awk '
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
  heritage_die "Media archive contains an unsafe path."
fi

confirmation="RESTORE $(basename -- "${backup_path}")"
if (( ! assume_yes )); then
  heritage_confirm_exact "${confirmation}" \
    "This replaces live Heritage Community data with ${backup_path}."
fi

safety_backup="not-created"
if (( skip_safety_backup )); then
  heritage_warn "Proceeding without a pre-restore safety backup."
else
  heritage_info "Creating a pre-restore safety backup."
  "${SCRIPT_DIR}/backup.sh" \
    --install-dir "${HERITAGE_INSTALL_DIR}" \
    --output-dir "${HERITAGE_BACKUP_DIR}" \
    --label pre-restore \
    --quiesce
  safety_backup="$(heritage_latest_backup)"
fi

heritage_compose config --quiet || heritage_die "Production Compose configuration is invalid."
community_was_running=0
cloudflared_was_running=0
host_tunnel_was_running=0
destructive_started=0

manage_host_tunnel() {
  local action=$1
  if [[ ${EUID} -eq 0 ]]; then
    systemctl "$action" heritage-community-tunnel.service
  elif command -v sudo >/dev/null 2>&1; then
    sudo systemctl "$action" heritage-community-tunnel.service
  else
    heritage_die "sudo is required to ${action} the host Cloudflare tunnel during restore."
  fi
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e

  if (( status != 0 )); then
    heritage_warn "Restore did not finish. Safety backup: ${safety_backup}"
    if (( destructive_started )); then
      heritage_compose stop --timeout 60 community >/dev/null 2>&1 || true
      if heritage_service_running cloudflared; then
        heritage_compose stop --timeout 60 cloudflared >/dev/null 2>&1 || true
      fi
      if (( host_tunnel_was_running )); then
        manage_host_tunnel stop >/dev/null 2>&1 || true
      fi
      heritage_warn "Live data may be incomplete. The application remains stopped; inspect the error and restore the safety backup."
    elif (( community_was_running || cloudflared_was_running )); then
      heritage_warn "Attempting to restart the previously running services."
      if (( community_was_running )); then
        heritage_compose up -d community >/dev/null
      fi
      if (( cloudflared_was_running )); then
        heritage_compose up -d cloudflared >/dev/null
      fi
      if (( host_tunnel_was_running )); then
        manage_host_tunnel start >/dev/null
      fi
    elif (( host_tunnel_was_running )); then
      heritage_warn "Attempting to restart the previously running host tunnel."
      manage_host_tunnel start >/dev/null
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
if heritage_service_running cloudflared; then
  cloudflared_was_running=1
fi
if command -v systemctl >/dev/null 2>&1 \
  && systemctl is-active --quiet heritage-community-tunnel.service; then
  host_tunnel_was_running=1
fi

heritage_info "Stopping the public tunnel and community app during restore."
if (( cloudflared_was_running )); then
  heritage_compose stop --timeout 60 cloudflared >/dev/null \
    || heritage_die "Could not stop the token-based Cloudflare tunnel. No live data was changed."
fi
if (( host_tunnel_was_running )); then
  manage_host_tunnel stop >/dev/null \
    || heritage_die "Could not stop the host Cloudflare tunnel. No live data was changed."
fi
heritage_compose stop --timeout 60 community >/dev/null \
  || heritage_die "Could not stop the Community app. No live data was changed."
heritage_compose up -d postgres >/dev/null
heritage_wait_for_postgres 60 || heritage_die "PostgreSQL did not become ready."

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
fi

if (( start_after )); then
  heritage_info "Starting Heritage Community."
  heritage_compose up -d --remove-orphans
  if (( host_tunnel_was_running )); then
    manage_host_tunnel start >/dev/null
  fi
  "${SCRIPT_DIR}/status.sh" \
    --install-dir "${HERITAGE_INSTALL_DIR}" \
    --backup-dir "${HERITAGE_BACKUP_DIR}" \
    --wait 90
else
  heritage_info "Restore complete; application services were left stopped by request."
fi

heritage_info "Restore complete. Safety backup: ${safety_backup}"
