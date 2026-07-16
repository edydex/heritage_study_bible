#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

purge_data=0
purge_backups=0
assume_yes=0

usage() {
  cat <<'EOF'
Stop and remove Heritage Community services.

Usage: uninstall.sh [options]

By default containers and system services are removed, while PostgreSQL,
media, private configuration, source, tunnel credentials, and backups remain.
Running the installer again reconnects them.

Options:
  --install-dir PATH  Community server source directory
  --purge-data        Also delete PostgreSQL/media volumes and configuration
  --purge-backups     Delete recognized Heritage backups (requires --purge-data;
                      unrelated files and a nonempty root are preserved)
  --yes               Skip confirmation only for the preserve-data default
  -h, --help          Show this help
EOF
}

while (($#)); do
  case "$1" in
    --install-dir) export HERITAGE_INSTALL_DIR=${2:?Missing path}; shift 2 ;;
    --purge-data) purge_data=1; shift ;;
    --purge-backups) purge_backups=1; shift ;;
    --yes) assume_yes=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) heritage_die "Unknown option: $1 (try --help)" ;;
  esac
done

((purge_backups == 0 || purge_data == 1)) || heritage_die "--purge-backups requires --purge-data."
[[ ${EUID} -eq 0 ]] || heritage_die "Run uninstall as root: sudo heritage-community uninstall"
heritage_init_context
heritage_init_docker
heritage_acquire_operations_lock
heritage_require_command realpath

community_id=$(heritage_env_value COMMUNITY_ID)
[[ -n $community_id ]] || heritage_die "Cannot read COMMUNITY_ID from ${HERITAGE_ENV_FILE}."

resolved_env=$(readlink -f "$HERITAGE_ENV_FILE" 2>/dev/null || printf '%s' "$HERITAGE_ENV_FILE")
resolved_env=$(realpath -m -- "$resolved_env")
config_dir=$(realpath -m -- "$(dirname "$resolved_env")")
deployment_root=$(dirname "$config_dir")
[[ $config_dir == */config && $deployment_root != / ]] \
  || heritage_die "Refusing to infer a safe configuration directory from ${resolved_env}."
if ((purge_data)); then
  [[ $HERITAGE_BACKUP_DIR == /* ]] || heritage_die "Backup directory must be absolute before purging data."
  HERITAGE_BACKUP_DIR=$(realpath -m -- "$HERITAGE_BACKUP_DIR")
  [[ $HERITAGE_BACKUP_DIR != / ]] || heritage_die "Refusing to use / as the backup directory."
  for removed_path in "$config_dir" "${deployment_root}/state"; do
    removed_path=$(realpath -m -- "$removed_path")
    if [[ $HERITAGE_BACKUP_DIR == "$removed_path" || $HERITAGE_BACKUP_DIR == "$removed_path/"* ]]; then
      heritage_die "Backup directory overlaps ${removed_path}. Move the backups before purging live data."
    fi
  done
fi

if ((purge_data)); then
  heritage_confirm_exact "$community_id" \
    "This permanently deletes the live PostgreSQL database, uploaded media, and private configuration. Backups are $([[ $purge_backups == 1 ]] && printf 'also deleted' || printf 'preserved')."
elif (( ! assume_yes )); then
  heritage_confirm_exact "UNINSTALL" \
    "Services will be removed, but database/media volumes, configuration, source, and backups will be preserved."
fi

heritage_info "Stopping containers without touching data."
heritage_compose down --remove-orphans
stale_tunnel_output=$(heritage_docker ps --all --quiet \
  --filter "label=com.docker.compose.project=${HERITAGE_PROJECT_NAME}" \
  --filter label=com.docker.compose.service=cloudflared) \
  || heritage_die "Could not inspect the token-based Cloudflare connector; uninstall stopped."
stale_tunnel_containers=()
if [[ -n $stale_tunnel_output ]]; then
  readarray -t stale_tunnel_containers <<<"$stale_tunnel_output"
fi
if ((${#stale_tunnel_containers[@]})); then
  heritage_docker rm --force "${stale_tunnel_containers[@]}" >/dev/null \
    || heritage_die "Could not remove the token-based Cloudflare connector; uninstall stopped."
fi

if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files heritage-community-backup.timer --no-legend 2>/dev/null \
    | grep -q '^heritage-community-backup.timer'; then
    systemctl disable --now heritage-community-backup.timer \
      || heritage_die "Could not disable the nightly backup timer; uninstall stopped."
  fi
  if systemctl is-active --quiet heritage-community-tunnel.service \
    || systemctl list-unit-files heritage-community-tunnel.service --no-legend 2>/dev/null \
      | grep -q '^heritage-community-tunnel.service'; then
    systemctl disable --now heritage-community-tunnel.service \
      || heritage_die "Could not stop the locally managed Cloudflare connector; uninstall stopped."
    systemctl is-active --quiet heritage-community-tunnel.service \
      && heritage_die "The locally managed Cloudflare connector is still active; uninstall stopped."
  fi
  rm -f /etc/systemd/system/heritage-community-backup.service \
    /etc/systemd/system/heritage-community-backup.timer \
    /etc/systemd/system/heritage-community-tunnel.service
  if [[ -f /etc/systemd/logind.conf.d/heritage-community.conf ]]; then
    rm -f /etc/systemd/logind.conf.d/heritage-community.conf
    systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true
  fi
  systemctl daemon-reload
fi

rm -f /usr/local/sbin/heritage-community \
  /usr/local/sbin/heritage-community-backup \
  /usr/local/sbin/heritage-community-restore \
  /usr/local/sbin/heritage-community-status \
  /usr/local/sbin/heritage-community-update \
  /etc/default/heritage-community

if ((purge_data)); then
  heritage_info "Deleting explicit Heritage database and media volumes."
  volume_removal_failed=0
  for volume in heritage-community-postgres heritage-community-media; do
    heritage_docker volume inspect "$volume" >/dev/null 2>&1 || continue
    if ! heritage_docker volume rm "$volume"; then
      heritage_warn "Could not delete Docker volume ${volume}. Private configuration will be preserved."
      volume_removal_failed=1
    fi
  done
  ((volume_removal_failed == 0)) || heritage_die "Data-volume deletion was incomplete; configuration and backups were not deleted."

  rm -f -- "${HERITAGE_INSTALL_DIR}/.env.production"
  rm -rf -- "$config_dir" "${deployment_root}/state"

  if ((purge_backups)); then
    [[ -f ${HERITAGE_BACKUP_DIR}/.heritage-community-backups ]] || heritage_die "Backup marker is missing; refusing to delete ${HERITAGE_BACKUP_DIR}."
    heritage_info "Deleting only Heritage-owned backup entries; unrelated files are preserved."
    while IFS= read -r -d '' backup_entry; do
      if [[ $(basename -- "$backup_entry") == backup-20* ]]; then
        [[ -f ${backup_entry}/manifest.env && -f ${backup_entry}/SHA256SUMS ]] || {
          heritage_warn "Preserving unrecognized directory: ${backup_entry}"
          continue
        }
      fi
      rm -rf -- "$backup_entry"
    done < <(find "$HERITAGE_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d \
      \( -name 'backup-20*' -o -name '.partial-backup-20*' \) -print0)
    rm -f -- "${HERITAGE_BACKUP_DIR}/latest" "${HERITAGE_BACKUP_DIR}/.heritage-community-backups"
    if ! rmdir -- "$HERITAGE_BACKUP_DIR" 2>/dev/null; then
      heritage_warn "Backup root was preserved because it contains unrelated files: ${HERITAGE_BACKUP_DIR}"
    fi
  fi
fi

heritage_info "Uninstall complete."
if ((purge_data == 0)); then
  heritage_info "Data is preserved. Rerun the installer to reconnect it."
else
  heritage_warn "Cloudflare DNS/tunnel objects remain in your Cloudflare account and can be removed from its dashboard."
fi
