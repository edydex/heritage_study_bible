#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

usage() {
  cat <<'EOF'
Run quiesced maintenance for private managed sermon recordings.

Usage:
  sermon-media-maintenance.sh [options]

Options:
  --install-dir PATH       Deployment directory (default: script parent)
  --grace-seconds SECONDS  Orphan staging/object grace, 3600..2592000
                           (default: 86400 / 24 hours)
  --already-quiesced       Require the Community app to already be stopped
  --require-backup-ready   Fail unless no active upload or staging directory
                           remains after maintenance; with database tables
                           locked, immediately remove verified unreferenced
                           finalized objects so DB/filesystem inventory agrees
  -h, --help               Show this help

Without --already-quiesced, the command briefly stops a running Community app
and restarts it only after successful maintenance. The Cloudflare connector is
never stopped. On failure after quiescence, the app stays stopped for recovery.

Maintenance expires due active rows, cleans terminal and sufficiently old
unknown staging, verifies every retained database object, and removes only
content-verified objects absent from the database. The normal operator command
preserves the configured orphan grace; --require-backup-ready may bypass that
grace only after app quiescence, database locks, and a zero-active-work check.
It prints one validated JSON report to stdout and never prints database
credentials.
EOF
}

already_quiesced=0
require_backup_ready=0
grace_seconds=""

while (($#)); do
  case "$1" in
    --install-dir)
      (($# >= 2)) || heritage_die "--install-dir requires a path."
      HERITAGE_INSTALL_DIR="$2"
      shift 2
      ;;
    --grace-seconds)
      (($# >= 2)) || heritage_die "--grace-seconds requires a number."
      grace_seconds="$2"
      shift 2
      ;;
    --already-quiesced)
      already_quiesced=1
      shift
      ;;
    --require-backup-ready)
      require_backup_ready=1
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

if [[ -n "${grace_seconds}" ]]; then
  heritage_is_nonnegative_integer "${grace_seconds}" \
    || heritage_die "Grace seconds must be a whole number."
  (( grace_seconds >= 3600 && grace_seconds <= 2592000 )) \
    || heritage_die "Grace seconds must be between 3600 and 2592000."
fi

heritage_init_context
heritage_init_docker 1>&2
heritage_require_command jq
heritage_acquire_operations_lock
heritage_compose config --quiet \
  || heritage_die "Production Compose configuration is invalid."
heritage_service_running postgres \
  || heritage_die "PostgreSQL is not running; maintenance was not attempted."
heritage_wait_for_postgres 30 \
  || heritage_die "PostgreSQL did not become ready; maintenance was not attempted."

community_was_stopped=0
maintenance_started=0

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e

  if (( community_was_stopped )); then
    if (( status == 0 )); then
      heritage_info "Starting the Community app after successful sermon-media maintenance." >&2
      heritage_compose start community >/dev/null
      if [[ $? -ne 0 ]]; then
        heritage_warn "Maintenance succeeded, but the Community app could not be restarted."
        status=1
      fi
    elif (( maintenance_started )); then
      heritage_warn "Sermon-media maintenance failed after quiescence; the Community app remains stopped."
      heritage_warn "The Cloudflare connector remains running for recovery access."
    else
      heritage_info "Starting the Community app because maintenance did not begin." >&2
      heritage_compose start community >/dev/null || true
    fi
  fi

  exit "${status}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if (( already_quiesced )); then
  heritage_service_running community \
    && heritage_die "--already-quiesced requires the Community app to be stopped."
else
  if heritage_service_running community; then
    heritage_info "Stopping the Community app for sermon-media maintenance; the recovery connector stays running." >&2
    heritage_compose stop --timeout 60 community >/dev/null \
      || heritage_die "Could not stop the Community app; maintenance was not attempted."
    community_was_stopped=1
  fi
fi

maintenance_args=(
  run
  --rm
  --no-deps
  -T
  --env HERITAGE_SERMON_MEDIA_MAINTENANCE_QUIESCED=true
)
if [[ -n "${grace_seconds}" ]]; then
  maintenance_args+=(
    --env "HERITAGE_SERMON_MEDIA_ORPHAN_GRACE_SECONDS=${grace_seconds}"
  )
fi
if (( require_backup_ready )); then
  maintenance_args+=(
    --env "HERITAGE_SERMON_MEDIA_MAINTENANCE_REQUIRE_BACKUP_READY=true"
  )
fi
maintenance_args+=(sermon-media-maintenance)

maintenance_started=1
heritage_info "Expiring due uploads and reconciling private sermon-media storage." >&2
report="$(heritage_compose "${maintenance_args[@]}")" \
  || heritage_die "Sermon-media maintenance command failed."

validated_report="$(jq -sc -e '
  def nonnegative_integer:
    type == "number" and . >= 0 and . == floor;
  if length != 1 then
    false
  else
    .[0]
    | select(type == "object")
    | select((keys | sort) == ([
        "active",
        "cleanedOrphanStaging",
        "cleanedTerminalStaging",
        "expiredUploads",
        "graceSeconds",
        "mode",
        "removedOrphanObjects",
        "retained",
        "schemaVersion",
        "stagingDirectories"
      ] | sort))
    | select(.schemaVersion == 1 and .mode == "quiesced")
    | select(.graceSeconds | nonnegative_integer)
    | select(.expiredUploads | nonnegative_integer)
    | select(.cleanedTerminalStaging | nonnegative_integer)
    | select(.cleanedOrphanStaging | nonnegative_integer)
    | select(.removedOrphanObjects | nonnegative_integer)
    | select(.stagingDirectories | nonnegative_integer)
    | select((.active | keys | sort) == ([
        "finalizing",
        "reservedBytes",
        "uploads"
      ] | sort))
    | select(.active.uploads | nonnegative_integer)
    | select(.active.finalizing | nonnegative_integer)
    | select(.active.reservedBytes | nonnegative_integer)
    | select((.retained | keys | sort) == (["bytes", "objects"] | sort))
    | select(.retained.objects | nonnegative_integer)
    | select(.retained.bytes | nonnegative_integer)
  end
' <<<"${report}")" \
  || heritage_die "Sermon-media maintenance returned an invalid report."

if [[ -n "${grace_seconds}" ]]; then
  [[ "$(jq -r '.graceSeconds' <<<"${validated_report}")" == "${grace_seconds}" ]] \
    || heritage_die "Sermon-media maintenance did not honor the requested grace period."
fi

if (( require_backup_ready )); then
  jq -e '
    .active.uploads == 0
    and .active.finalizing == 0
    and .active.reservedBytes == 0
    and .stagingDirectories == 0
  ' <<<"${validated_report}" >/dev/null \
    || heritage_die "Nonexpired active recording staging remains; backup refuses to proceed."
fi

printf '%s\n' "${validated_report}"
