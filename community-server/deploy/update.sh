#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

usage() {
  cat <<'EOF'
Safely update and redeploy Heritage Community.

Usage:
  update.sh [options]

Options:
  --install-dir PATH       Deployment directory (default: script parent)
  --backup-dir PATH        Backup root (default: /var/backups/heritage-community)
  --no-pull                Build the code already on disk; do not contact Git
  --include-infrastructure Also pull current PostgreSQL and cloudflared images
  --skip-backup            Skip the required pre-update backup (dangerous)
  --yes                    Confirm --skip-backup without a typed phrase
  --wait SECONDS           Health-check timeout after deployment (default: 120)
  --dry-run                Print the intended phases without changing anything
  -h, --help               Show this help

Normal sequence:
  1. Refuse tracked local code changes.
  2. Create a consistent safety backup.
  3. Fast-forward the configured Git upstream (unless --no-pull).
  4. Build the application and migration images.
  5. Run database migrations before replacing the app container.
  6. Start services and require local health checks to pass.

The script never resets code or automatically restores a database. On failure
it prints the pre-update commit and backup so the operator can inspect first.
EOF
}

pull_source=1
include_infrastructure=0
skip_backup=0
assume_yes=0
wait_seconds=120
dry_run=0

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
    --no-pull)
      pull_source=0
      shift
      ;;
    --include-infrastructure)
      include_infrastructure=1
      shift
      ;;
    --skip-backup)
      skip_backup=1
      shift
      ;;
    --yes)
      assume_yes=1
      shift
      ;;
    --wait)
      (($# >= 2)) || heritage_die "--wait requires a number of seconds."
      wait_seconds="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=1
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

if (( dry_run )); then
  cat <<EOF
Heritage Community update dry run
  Install directory: ${HERITAGE_INSTALL_DIR}
  Compose file:      ${HERITAGE_COMPOSE_FILE}
  Environment file:  ${HERITAGE_ENV_FILE}
  Backup directory:  ${HERITAGE_BACKUP_DIR}
  Pull source:       ${pull_source}
  Pull infrastructure images: ${include_infrastructure}
  Create safety backup: $((1 - skip_backup))

Planned phases: preflight -> backup -> source fast-forward -> image build ->
database migration -> service replacement -> health verification.
EOF
  exit 0
fi

heritage_init_docker
heritage_require_command git
heritage_acquire_operations_lock
heritage_compose config --quiet || heritage_die "Production Compose configuration is invalid."

git -C "${HERITAGE_INSTALL_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || \
  heritage_die "Installation directory is not a Git worktree. Use --no-pull only with a Git-based installation."

tracked_changes="$(git -C "${HERITAGE_INSTALL_DIR}" status --porcelain --untracked-files=no)"
[[ -z "${tracked_changes}" ]] || heritage_die \
  "Tracked local changes are present. Preserve or commit them before updating; nothing was changed."

before_commit="$(git -C "${HERITAGE_INSTALL_DIR}" rev-parse HEAD)"
safety_backup="not-created"
phase="preflight"
upstream=""
app_quiesced=0

if (( pull_source )); then
  upstream="$(git -C "${HERITAGE_INSTALL_DIR}" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)" || \
    heritage_die "The current branch has no Git upstream. Configure one or rerun with --no-pull."
fi

on_error() {
  local status=$?
  trap - ERR
  set +e
  heritage_warn "Update failed during: ${phase}"
  heritage_warn "Previous Git commit: ${before_commit}"
  heritage_warn "Safety backup: ${safety_backup}"
  heritage_warn "No automatic reset or database rollback was attempted. Inspect 'docker compose logs' before restoring."
  if (( app_quiesced )); then
    heritage_compose stop --timeout 60 community >/dev/null 2>&1 || true
    if heritage_service_running cloudflared; then
      heritage_compose stop --timeout 60 cloudflared >/dev/null 2>&1 || true
    fi
    if command -v systemctl >/dev/null 2>&1 \
      && systemctl is-active --quiet heritage-community-tunnel.service; then
      if [[ ${EUID} -eq 0 ]]; then
        systemctl stop heritage-community-tunnel.service >/dev/null 2>&1 || true
      elif command -v sudo >/dev/null 2>&1; then
        sudo systemctl stop heritage-community-tunnel.service >/dev/null 2>&1 || true
      fi
    fi
    heritage_warn "The app and public connector remain stopped because the failure occurred after migration quiescence."
  fi
  exit "${status}"
}
trap on_error ERR

if (( skip_backup )); then
  heritage_warn "A pre-update backup was explicitly disabled."
  if (( ! assume_yes )); then
    heritage_confirm_exact "UPDATE WITHOUT BACKUP" \
      "Updating without a recoverable database/media snapshot can cause permanent data loss."
  fi
else
  phase="safety backup"
  "${SCRIPT_DIR}/backup.sh" \
    --install-dir "${HERITAGE_INSTALL_DIR}" \
    --output-dir "${HERITAGE_BACKUP_DIR}" \
    --label pre-update \
    --quiesce
  safety_backup="$(heritage_latest_backup)"
fi

if (( pull_source )); then
  phase="source fast-forward"
  heritage_info "Fetching and fast-forwarding ${upstream}."
  git -C "${HERITAGE_INSTALL_DIR}" fetch --prune
  git -C "${HERITAGE_INSTALL_DIR}" merge --ff-only "${upstream}"
fi

if (( include_infrastructure )); then
  phase="infrastructure image pull"
  heritage_info "Pulling PostgreSQL and cloudflared images."
  heritage_compose pull postgres cloudflared
fi

phase="application image build"
heritage_info "Building the application and migration images."
heritage_compose build --pull community migrate

phase="database readiness"
heritage_compose up -d postgres
heritage_wait_for_postgres 60 || heritage_die "PostgreSQL did not become ready."

phase="service quiescence"
heritage_info "Stopping the community app before database migration."
heritage_compose stop --timeout 60 community
app_quiesced=1

phase="database migration"
heritage_info "Running database migrations."
heritage_compose run --rm -T migrate

phase="service deployment"
heritage_info "Replacing services with the updated images."
heritage_compose up -d --remove-orphans

phase="health verification"
"${SCRIPT_DIR}/status.sh" \
  --install-dir "${HERITAGE_INSTALL_DIR}" \
  --backup-dir "${HERITAGE_BACKUP_DIR}" \
  --wait "${wait_seconds}"
app_quiesced=0

after_commit="$(git -C "${HERITAGE_INSTALL_DIR}" rev-parse HEAD)"
trap - ERR
heritage_info "Update complete: ${before_commit} -> ${after_commit}"
heritage_info "Safety backup: ${safety_backup}"
