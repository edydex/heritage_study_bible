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
  --skip-build             Use the configured images already on this host;
                           requires --no-pull and both expected image IDs
  --expected-community-image-id SHA256
                           Required exact community image ID with --skip-build
  --expected-migration-image-id SHA256
                           Required exact migration image ID with --skip-build
  --include-infrastructure Also pull current PostgreSQL and cloudflared images;
                           a running tunnel is staged but never restarted
  --skip-backup            Skip the required pre-update backup (dangerous)
  --yes                    Confirm --skip-backup without a typed phrase
  --wait SECONDS           Health-check timeout after deployment (default: 120)
  --dry-run                Print the intended phases without changing anything
  -h, --help               Show this help

Normal sequence:
  1. Refuse tracked local code changes.
  2. Create a consistent safety backup.
  3. Fast-forward the configured Git upstream (unless --no-pull).
  4. Build the application and migration images, or verify explicitly pinned
     prebuilt images when --skip-build is requested.
  5. Run database migrations before replacing the app container.
  6. Start services and require local health checks to pass.

The script never resets code or automatically restores a database. On failure
it prints the pre-update commit and backup so the operator can inspect first.
The Cloudflare connector is never stopped by update, because it may also carry
the operator's SSH recovery path. Public app requests can be unavailable while
the community app is deliberately stopped.
EOF
}

pull_source=1
skip_build=0
expected_community_image_id=""
expected_migration_image_id=""
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
    --skip-build)
      skip_build=1
      shift
      ;;
    --expected-community-image-id)
      (($# >= 2)) || heritage_die "--expected-community-image-id requires an image ID."
      expected_community_image_id="$2"
      shift 2
      ;;
    --expected-migration-image-id)
      (($# >= 2)) || heritage_die "--expected-migration-image-id requires an image ID."
      expected_migration_image_id="$2"
      shift 2
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

if (( skip_build )); then
  (( ! pull_source )) || heritage_die "--skip-build requires --no-pull so code cannot change independently of the verified images."
  (( ! include_infrastructure )) || heritage_die \
    "--skip-build cannot be combined with --include-infrastructure; the exact-image path performs no registry pulls."
  [[ "${expected_community_image_id}" =~ ^sha256:[0-9a-f]{64}$ ]] || heritage_die \
    "--skip-build requires --expected-community-image-id sha256:<64 lowercase hex characters>."
  [[ "${expected_migration_image_id}" =~ ^sha256:[0-9a-f]{64}$ ]] || heritage_die \
    "--skip-build requires --expected-migration-image-id sha256:<64 lowercase hex characters>."
else
  [[ -z "${expected_community_image_id}" && -z "${expected_migration_image_id}" ]] || heritage_die \
    "Expected image IDs are valid only with --skip-build."
fi

heritage_init_context

if (( dry_run )); then
  cat <<EOF
Heritage Community update dry run
  Install directory: ${HERITAGE_INSTALL_DIR}
  Compose file:      ${HERITAGE_COMPOSE_FILE}
  Environment file:  ${HERITAGE_ENV_FILE}
  Backup directory:  ${HERITAGE_BACKUP_DIR}
  Pull source:       ${pull_source}
  Build application images: $((1 - skip_build))
  Use verified prebuilt images: ${skip_build}
  Expected community image ID: ${expected_community_image_id:-not-applicable}
  Expected migration image ID: ${expected_migration_image_id:-not-applicable}
  Pull infrastructure images: ${include_infrastructure}
  Create safety backup: $((1 - skip_backup))

Planned phases: preflight -> prebuilt-image verification (when requested) ->
backup -> source fast-forward -> image build or revalidation -> database
migration -> service replacement -> health and final image verification.
EOF
  exit 0
fi

heritage_init_docker
heritage_require_command git
if (( skip_build )); then
  heritage_require_command jq
fi
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
community_image_ref=""
migration_image_ref=""
source_compose_file="${HERITAGE_COMPOSE_FILE}"
pinned_compose_file=""

assert_prebuilt_image_refs_unchanged() {
  local current_community_ref
  local current_migration_ref
  local resolved_config
  local resolved_community_ref
  local resolved_migration_ref
  local resolved_maintenance_ref

  current_community_ref="$(heritage_env_value HERITAGE_COMMUNITY_IMAGE)"
  current_migration_ref="$(heritage_env_value HERITAGE_MIGRATION_IMAGE)"
  [[ -n "${current_community_ref}" ]] || {
    heritage_warn "--skip-build requires HERITAGE_COMMUNITY_IMAGE to be explicitly set in the production environment file."
    return 1
  }
  [[ -n "${current_migration_ref}" ]] || {
    heritage_warn "--skip-build requires HERITAGE_MIGRATION_IMAGE to be explicitly set in the production environment file."
    return 1
  }
  [[ "${current_community_ref}" != *[[:space:]]* ]] || {
    heritage_warn "HERITAGE_COMMUNITY_IMAGE contains whitespace and is not a safe exact image reference."
    return 1
  }
  [[ "${current_migration_ref}" != *[[:space:]]* ]] || {
    heritage_warn "HERITAGE_MIGRATION_IMAGE contains whitespace and is not a safe exact image reference."
    return 1
  }

  if [[ -z "${community_image_ref}" ]]; then
    community_image_ref="${current_community_ref}"
    migration_image_ref="${current_migration_ref}"
  else
    [[ "${current_community_ref}" == "${community_image_ref}" ]] || {
      heritage_warn "The configured community image reference changed during the update."
      return 1
    }
    [[ "${current_migration_ref}" == "${migration_image_ref}" ]] || {
      heritage_warn "The configured migration image reference changed during the update."
      return 1
    }
  fi

  resolved_config="$(HERITAGE_COMPOSE_FILE="${source_compose_file}" \
    heritage_compose --profile operations config --format json)" || {
    heritage_warn "Compose could not render the canonical service configuration for exact image verification."
    return 1
  }
  resolved_community_ref="$(jq -er '.services.community.image | select(type == "string" and length > 0)' \
    <<<"${resolved_config}")" || {
    heritage_warn "Compose did not resolve one exact image reference for the community service."
    return 1
  }
  resolved_migration_ref="$(jq -er '.services.migrate.image | select(type == "string" and length > 0)' \
    <<<"${resolved_config}")" || {
    heritage_warn "Compose did not resolve one exact image reference for the migration service."
    return 1
  }
  resolved_maintenance_ref="$(jq -er \
    '.services["sermon-media-maintenance"].image | select(type == "string" and length > 0)' \
    <<<"${resolved_config}")" || {
    heritage_warn "Compose did not resolve one exact image reference for sermon-media maintenance."
    return 1
  }
  [[ "${resolved_community_ref}" == "${community_image_ref}" ]] || {
    heritage_warn "Compose resolved community to ${resolved_community_ref}; configured ${community_image_ref}."
    return 1
  }
  [[ "${resolved_migration_ref}" == "${migration_image_ref}" ]] || {
    heritage_warn "Compose resolved migrate to ${resolved_migration_ref}; configured ${migration_image_ref}."
    return 1
  }
  [[ "${resolved_maintenance_ref}" == "${migration_image_ref}" ]] || {
    heritage_warn "Compose resolved sermon-media maintenance to ${resolved_maintenance_ref}; configured migration image ${migration_image_ref}."
    return 1
  }
}

cleanup_pinned_compose() {
  if [[ -n "${pinned_compose_file}" ]]; then
    rm -f -- "${pinned_compose_file}"
    pinned_compose_file=""
  fi
  HERITAGE_COMPOSE_FILE="${source_compose_file}"
}

create_pinned_compose() {
  local resolved_config

  resolved_config="$(HERITAGE_COMPOSE_FILE="${source_compose_file}" \
    heritage_compose --profile operations config --format json)" || {
    heritage_warn "Compose could not render the source configuration for immutable image pinning."
    return 1
  }
  pinned_compose_file="$(mktemp \
    "${TMPDIR:-/tmp}/heritage-community-update-compose.XXXXXX")" || {
    heritage_warn "Could not allocate a private temporary Compose configuration."
    return 1
  }
  chmod 0600 "${pinned_compose_file}" || {
    heritage_warn "Could not protect the temporary Compose configuration."
    cleanup_pinned_compose
    return 1
  }
  if ! jq \
    --arg community "${expected_community_image_id}" \
    --arg migration "${expected_migration_image_id}" \
    '
      .services.community.image = $community
      | .services.community.pull_policy = "never"
      | del(.services.community.build)
      | .services.migrate.image = $migration
      | .services.migrate.pull_policy = "never"
      | del(.services.migrate.build)
      | .services["sermon-media-maintenance"].image = $migration
      | .services["sermon-media-maintenance"].pull_policy = "never"
      | del(.services["sermon-media-maintenance"].build)
    ' <<<"${resolved_config}" >"${pinned_compose_file}"; then
    heritage_warn "Could not create the immutable temporary Compose configuration."
    cleanup_pinned_compose
    return 1
  fi
  HERITAGE_COMPOSE_FILE="${pinned_compose_file}"
}

verify_pinned_compose() {
  local pinned_config

  [[ -n "${pinned_compose_file}" && -f "${pinned_compose_file}" ]] || {
    heritage_warn "The immutable temporary Compose configuration is missing."
    return 1
  }
  [[ "$(stat -c '%a' "${pinned_compose_file}" 2>/dev/null \
    || stat -f '%Lp' "${pinned_compose_file}" 2>/dev/null)" == "600" ]] || {
    heritage_warn "The immutable temporary Compose configuration is not mode 0600."
    return 1
  }
  pinned_config="$(heritage_compose --profile operations config --format json)" || {
    heritage_warn "Compose rejected the immutable temporary configuration."
    return 1
  }
  jq -e \
    --arg community "${expected_community_image_id}" \
    --arg migration "${expected_migration_image_id}" \
    '
      (.services.community.image == $community)
      and (.services.community.pull_policy == "never")
      and ((.services.community | has("build")) | not)
      and (.services.migrate.image == $migration)
      and (.services.migrate.pull_policy == "never")
      and ((.services.migrate | has("build")) | not)
      and (.services["sermon-media-maintenance"].image == $migration)
      and (.services["sermon-media-maintenance"].pull_policy == "never")
      and ((.services["sermon-media-maintenance"] | has("build")) | not)
    ' <<<"${pinned_config}" >/dev/null || {
    heritage_warn "The temporary Compose configuration does not preserve the exact no-build/no-pull image contract."
    return 1
  }
}

verify_community_image() {
  local actual_id
  assert_prebuilt_image_refs_unchanged
  actual_id="$(heritage_docker image inspect --format '{{.Id}}' "${community_image_ref}" 2>/dev/null)" || {
    heritage_warn "Configured community image is not present locally: ${community_image_ref}"
    return 1
  }
  [[ "${actual_id}" == "${expected_community_image_id}" ]] || {
    heritage_warn "Configured community image resolved to ${actual_id:-missing}; expected ${expected_community_image_id}."
    return 1
  }
}

verify_migration_image() {
  local actual_id
  assert_prebuilt_image_refs_unchanged
  actual_id="$(heritage_docker image inspect --format '{{.Id}}' "${migration_image_ref}" 2>/dev/null)" || {
    heritage_warn "Configured migration image is not present locally: ${migration_image_ref}"
    return 1
  }
  [[ "${actual_id}" == "${expected_migration_image_id}" ]] || {
    heritage_warn "Configured migration image resolved to ${actual_id:-missing}; expected ${expected_migration_image_id}."
    return 1
  }
}

verify_prebuilt_images() {
  verify_community_image
  verify_migration_image
}

verify_prebuilt_source_state() {
  local current_commit
  local tracked_changes_now

  current_commit="$(git -C "${HERITAGE_INSTALL_DIR}" rev-parse HEAD)" || {
    heritage_warn "Could not re-read the installation commit before quiescence."
    return 1
  }
  [[ "${current_commit}" == "${before_commit}" ]] || {
    heritage_warn "The installation commit changed after exact-image preflight."
    return 1
  }
  tracked_changes_now="$(git -C "${HERITAGE_INSTALL_DIR}" \
    status --porcelain --untracked-files=no)" || {
    heritage_warn "Could not recheck tracked source cleanliness before quiescence."
    return 1
  }
  [[ -z "${tracked_changes_now}" ]] || {
    heritage_warn "Tracked source changed after exact-image preflight."
    return 1
  }
  verify_prebuilt_images
  verify_pinned_compose
}

verify_running_community_image() {
  local container_id
  local running_image_id
  container_id="$(heritage_compose ps --quiet community 2>/dev/null)"
  [[ -n "${container_id}" ]] || {
    heritage_warn "The community container is not running for exact image verification."
    return 1
  }
  running_image_id="$(heritage_docker inspect --format '{{.Image}}' "${container_id}" 2>/dev/null)" || {
    heritage_warn "Could not inspect the running community container image."
    return 1
  }
  [[ "${running_image_id}" == "${expected_community_image_id}" ]] || {
    heritage_warn "The running community container uses ${running_image_id:-missing}; expected ${expected_community_image_id}."
    return 1
  }
}

if (( pull_source )); then
  upstream="$(git -C "${HERITAGE_INSTALL_DIR}" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)" || \
    heritage_die "The current branch has no Git upstream. Configure one or rerun with --no-pull."
fi

on_error() {
  local status=$?
  trap - ERR HUP INT TERM
  set +e
  heritage_warn "Update failed during: ${phase}"
  heritage_warn "Previous Git commit: ${before_commit}"
  heritage_warn "Safety backup: ${safety_backup}"
  heritage_warn "No automatic reset or database rollback was attempted. Inspect 'docker compose logs' before restoring."
  if (( app_quiesced )); then
    heritage_compose stop --timeout 60 community >/dev/null 2>&1 || true
    heritage_warn "The app remains stopped because the failure occurred after migration quiescence."
    heritage_warn "The Cloudflare connector was left running to preserve remote recovery access; public app requests may report the origin as unavailable."
  fi
  cleanup_pinned_compose
  exit "${status}"
}
on_signal() {
  local signal_name="$1"
  local status="$2"
  trap - ERR HUP INT TERM
  set +e
  heritage_warn "Update interrupted by ${signal_name} during: ${phase}"
  heritage_warn "Previous Git commit: ${before_commit}"
  heritage_warn "Safety backup: ${safety_backup}"
  if (( app_quiesced )); then
    heritage_compose stop --timeout 60 community >/dev/null 2>&1 || true
    heritage_warn "The app remains stopped because the interruption occurred after migration quiescence."
    heritage_warn "The Cloudflare connector was left running to preserve remote recovery access; public app requests may report the origin as unavailable."
  fi
  cleanup_pinned_compose
  exit "${status}"
}
trap on_error ERR
trap cleanup_pinned_compose EXIT
trap 'on_signal HUP 129' HUP
trap 'on_signal INT 130' INT
trap 'on_signal TERM 143' TERM

if (( skip_build )); then
  phase="prebuilt image preflight"
  heritage_info "Verifying the exact configured application and migration images before backup."
  verify_prebuilt_images
  phase="immutable Compose preparation"
  heritage_info "Pinning update operations to immutable local image IDs."
  create_pinned_compose
  verify_pinned_compose
fi

if (( skip_backup )); then
  heritage_warn "A pre-update backup was explicitly disabled."
  if (( ! assume_yes )); then
    heritage_confirm_exact "UPDATE WITHOUT BACKUP" \
      "Updating without a recoverable database/media snapshot can cause permanent data loss."
  fi
else
  phase="safety backup"
  HERITAGE_COMPOSE_FILE="${HERITAGE_COMPOSE_FILE}" \
    HERITAGE_ENV_FILE="${HERITAGE_ENV_FILE}" \
    HERITAGE_PROJECT_NAME="${HERITAGE_PROJECT_NAME}" \
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

if (( skip_build )); then
  phase="prebuilt image revalidation"
  heritage_info "Revalidating source and exact prebuilt images before service quiescence."
  verify_prebuilt_source_state
else
  phase="application image build"
  heritage_info "Building the application and migration images."
  heritage_compose build --pull community migrate
fi

phase="database readiness"
if (( skip_build )); then
  if ! heritage_service_running postgres; then
    heritage_compose up -d --no-build --pull never postgres
  fi
else
  heritage_compose up -d postgres
fi
heritage_wait_for_postgres 60 || heritage_die "PostgreSQL did not become ready."

phase="service quiescence"
heritage_info "Stopping the community app before database migration."
heritage_compose stop --timeout 60 community
app_quiesced=1

if (( skip_build )); then
  phase="migration image final verification"
  verify_migration_image
fi

phase="database migration"
heritage_info "Running database migrations."
if (( skip_build )); then
  heritage_compose run --rm -T --pull never migrate
else
  heritage_compose run --rm -T migrate
fi

if (( skip_build )); then
  phase="community image final verification"
  verify_community_image
fi

phase="service deployment"
heritage_info "Replacing the PostgreSQL and community services with the updated images."
if (( skip_build )); then
  heritage_compose up -d --no-build --pull never postgres community
else
  heritage_compose up -d postgres community
fi

if (( skip_build )); then
  phase="deployed image verification"
  verify_prebuilt_images
  verify_running_community_image
fi

# A running connector may be carrying the SSH session executing this update.
# Never ask Compose to reconcile or restart it. If token mode is configured but
# its connector was already absent, starting it after the app is safe and
# preserves the existing `update` behavior without touching a live transport.
if heritage_compose config --services | grep -qx cloudflared \
  && ! heritage_service_running cloudflared; then
  phase="public connector startup"
  heritage_info "Starting the configured Cloudflare connector because it was not running."
  if (( skip_build )); then
    heritage_compose up -d --no-build --pull never cloudflared
  else
    heritage_compose up -d cloudflared
  fi
fi

phase="health verification"
HERITAGE_COMPOSE_FILE="${HERITAGE_COMPOSE_FILE}" \
  HERITAGE_ENV_FILE="${HERITAGE_ENV_FILE}" \
  HERITAGE_PROJECT_NAME="${HERITAGE_PROJECT_NAME}" \
  "${SCRIPT_DIR}/status.sh" \
  --install-dir "${HERITAGE_INSTALL_DIR}" \
  --backup-dir "${HERITAGE_BACKUP_DIR}" \
  --wait "${wait_seconds}"

if (( skip_build )); then
  phase="post-health image verification"
  verify_prebuilt_images
  verify_running_community_image
fi
app_quiesced=0

after_commit="$(git -C "${HERITAGE_INSTALL_DIR}" rev-parse HEAD)"
cleanup_pinned_compose
trap - ERR EXIT HUP INT TERM
heritage_info "Update complete: ${before_commit} -> ${after_commit}"
heritage_info "Safety backup: ${safety_backup}"
