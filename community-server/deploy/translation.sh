#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
source "${SCRIPT_DIR}/lib/common.sh"

usage() {
  cat <<'HELP'
Set up live translation beside this Heritage Community.

heritage-community translation configure --source PATH --revision FULL_SHA [options]
heritage-community translation status

  --source PATH       Separate, clean Multilinguum checkout from the unified workspace
  --revision SHA      Exact compatible revision from components.lock.json
  --non-interactive   Use existing configuration and TRANSLATION_* environment variables
  --yes               Accept the non-secret setup summary
  --dry-run           Validate the source and show phases without changing the host

Optional secrets: TRANSLATION_OPENAI_API_KEY, TRANSLATION_LIVEKIT_URL,
TRANSLATION_LIVEKIT_API_KEY, TRANSLATION_LIVEKIT_API_SECRET.
Profile secrets: TRANSLATION_QUALITY_TEXT_API_KEY, TRANSLATION_ECONOMY_TEXT_API_KEY.
Profile settings: TRANSLATION_QUALITY_TEXT_MODEL, TRANSLATION_QUALITY_REASONING_EFFORT,
TRANSLATION_ECONOMY_TEXT_MODEL, TRANSLATION_ECONOMY_REASONING_EFFORT,
TRANSLATION_ECONOMY_SHARING_CONFIRMED, TRANSLATION_ECONOMY_OVERAGE_POLICY.
Economy defaults to blocked. An administrator must configure a separate text project,
confirm its sharing settings, and allow billed overage if its allowance runs out.
Text works without an audio relay. Missing provider credentials may be added later.
This command preserves existing Community, tunnel, database and control-key settings.
HELP
}
operation=status
source_path=""
revision=""
non_interactive=0
assume_yes=0
dry_run=0
while (($#)); do
  case "$1" in
    configure|status) operation="$1"; shift ;;
    --install-dir) HERITAGE_INSTALL_DIR="${2:?Missing install directory}"; shift 2 ;;
    --source) source_path="${2:?Missing source path}"; shift 2 ;;
    --revision) revision="${2:?Missing source revision}"; shift 2 ;;
    --non-interactive) non_interactive=1; shift ;;
    --yes) assume_yes=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) heritage_die "Unknown translation option: $1" ;;
  esac
done
heritage_init_context
if [[ "$operation" == status ]]; then
  if ! heritage_translation_enabled; then
    heritage_info "Live translation is not installed. Run translation configure with the unified workspace's pinned source."
    exit 0
  fi
  heritage_info "Translation revision: $(heritage_config_value HERITAGE_TRANSLATION_REVISION)"
  heritage_info "Manager controls: $(heritage_config_value COMMUNITY_PUBLIC_URL)/admin/live-translation"
  [[ -z "$(heritage_config_value TRANSLATION_OPENAI_API_KEY)" ]] || heritage_info "OpenAI credentials are configured."
  [[ -n "$(heritage_config_value TRANSLATION_OPENAI_API_KEY)" ]] || heritage_info "OpenAI credentials are still needed before a live service."
  heritage_init_docker
  heritage_translation_wait 2 || heritage_die "The translation processor is unavailable."
  heritage_info "Translation processor is healthy. No paid provider request was made."
  exit 0
fi

source_path="${source_path:-$(heritage_config_value HERITAGE_TRANSLATION_SOURCE)}"
revision="${revision:-$(heritage_config_value HERITAGE_TRANSLATION_REVISION)}"
[[ -d "$source_path" ]] || heritage_die "Select the Multilinguum checkout created by the unified workspace bootstrap."
source_path="$(cd -- "$source_path" && pwd -P)"
heritage_validate_translation_source "$source_path" "$revision"
[[ -f "$HERITAGE_INSTALL_DIR/src/components/LiveTranslation.tsx" ]] || heritage_die "Update Community to the compatible integration revision first."
if (( dry_run )); then
  heritage_info "Translation setup: $source_path at $revision"
  heritage_info "Phases: safety backup, private configuration, processor build, healthy companion, Community update and endpoint checks."
  heritage_info "The existing tunnel is preserved. Translation archives join the regular backup/restore workflow."
  exit 0
fi

heritage_init_docker
heritage_require_command openssl
heritage_acquire_operations_lock
openai_key="$(heritage_config_value TRANSLATION_OPENAI_API_KEY)"
livekit_url="$(heritage_config_value TRANSLATION_LIVEKIT_URL)"
livekit_key="$(heritage_config_value TRANSLATION_LIVEKIT_API_KEY)"
livekit_secret="$(heritage_config_value TRANSLATION_LIVEKIT_API_SECRET)"
if (( ! non_interactive )); then
  [[ -t 0 ]] || heritage_die "Use an interactive terminal, or --non-interactive with private environment variables."
  printf 'OpenAI API key (hidden; Enter keeps the existing key or leaves setup pending): ' >&2
  read -rs entered; printf '\n' >&2
  openai_key="${entered:-$openai_key}"
  printf 'Quality/Economy speech uses this server; a separate relay is optional.\n' >&2
  printf 'Configure a LiveKit relay for direct Realtime audio now? [y/N]: ' >&2
  read -r answer
  if [[ "$answer" == y || "$answer" == Y ]]; then
    printf 'LiveKit secure WebSocket URL: ' >&2; read -r entered
    livekit_url="${entered:-$livekit_url}"
    printf 'LiveKit API key (hidden): ' >&2; read -rs entered; printf '\n' >&2
    livekit_key="${entered:-$livekit_key}"
    printf 'LiveKit API secret (hidden): ' >&2; read -rs entered; printf '\n' >&2
    livekit_secret="${entered:-$livekit_secret}"
  fi
fi
if [[ -n "$livekit_url$livekit_key$livekit_secret" ]]; then
  [[ "$livekit_url" == wss://* && -n "$livekit_key" && -n "$livekit_secret" ]] \
    || heritage_die "Audio relay setup needs a wss:// URL, API key, and secret together."
fi
heritage_info "Install translation beside $(heritage_config_value COMMUNITY_NAME), revision ${revision:0:12}."
heritage_info "Provider credentials remain private; this setup does not opt into data sharing or start paid translation."
if (( ! assume_yes )); then
  [[ -t 0 ]] || heritage_die "Review the setup summary and rerun with --yes."
  printf 'Apply this setup? [y/N]: ' >&2; read -r answer
  [[ "$answer" == y || "$answer" == Y ]] || exit 0
fi

original_env="$HERITAGE_ENV_FILE"
staged_env=""
staged_processor_started=0
previous_processor_running=0
config_committed=0
updated_keys=(HERITAGE_TRANSLATION_ENABLED HERITAGE_TRANSLATION_SOURCE HERITAGE_TRANSLATION_REVISION HERITAGE_TRANSLATION_IMAGE TRANSLATION_PROCESSOR_URL TRANSLATION_CONTROL_TOKEN TRANSLATION_OPENAI_API_KEY TRANSLATION_LIVEKIT_URL TRANSLATION_LIVEKIT_API_KEY TRANSLATION_LIVEKIT_API_SECRET
  TRANSLATION_QUALITY_TEXT_API_KEY TRANSLATION_QUALITY_TEXT_MODEL TRANSLATION_QUALITY_REASONING_EFFORT
  TRANSLATION_ECONOMY_TEXT_API_KEY TRANSLATION_ECONOMY_TEXT_MODEL TRANSLATION_ECONOMY_REASONING_EFFORT
  TRANSLATION_ECONOMY_SHARING_CONFIRMED TRANSLATION_ECONOMY_OVERAGE_POLICY)
use_written_configuration() {
  local key
  # Explicit source/revision selections must win over stale inherited overrides.
  # Values, including supplied credentials, have already been saved privately.
  for key in "${updated_keys[@]}"; do unset "$key"; done
  heritage_init_context
}
cleanup() {
  local result=$?
  trap - EXIT INT TERM
  set +e
  if (( result != 0 )); then
    heritage_warn "Translation setup did not finish. Your database and archive volumes were preserved."
    if (( staged_processor_started && ! config_committed )); then
      (
        export HERITAGE_ENV_FILE="$staged_env"
        use_written_configuration
        heritage_compose stop --timeout 60 translation-processor >/dev/null 2>&1
      )
    fi
    if (( previous_processor_running && ! config_committed )); then
      HERITAGE_ENV_FILE="$original_env"
      heritage_init_context
      heritage_compose up -d --no-build --pull never translation-processor >/dev/null 2>&1 \
        && heritage_translation_wait 60 && heritage_translation_maintenance false \
        || heritage_warn "The previous translation processor could not resume; its original configuration and volume are retained."
    fi
    heritage_warn "Retry setup after resolving the reported problem. The existing tunnel was preserved."
  fi
  [[ -z "$staged_env" ]] || rm -f -- "$staged_env"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"${SCRIPT_DIR}/backup.sh" --install-dir "$HERITAGE_INSTALL_DIR" --output-dir "$HERITAGE_BACKUP_DIR" --quiesce --label pre-translation-setup
resolved_env="$(heritage_realpath_allow_missing "$original_env")"
staged_env="$(mktemp "${resolved_env}.translation-setup.XXXXXX")"
cp -- "$resolved_env" "$staged_env"
chmod 0600 "$staged_env"
control_key="$(heritage_config_value TRANSLATION_CONTROL_TOKEN)"
control_key="${control_key:-$(openssl rand -hex 32)}"
((${#control_key} >= 32)) || heritage_die "The existing translation control key is invalid. Recover the correct private configuration."
for key in "${updated_keys[@]}"; do
  case "$key" in
    HERITAGE_TRANSLATION_ENABLED) value=true ;;
    HERITAGE_TRANSLATION_SOURCE) value="$source_path" ;;
    HERITAGE_TRANSLATION_REVISION) value="$revision" ;;
    HERITAGE_TRANSLATION_IMAGE) value="heritage-translation:${revision:0:12}" ;;
    TRANSLATION_PROCESSOR_URL) value=http://translation-processor:4310 ;;
    TRANSLATION_CONTROL_TOKEN) value="$control_key" ;;
    TRANSLATION_OPENAI_API_KEY) value="$openai_key" ;;
    TRANSLATION_LIVEKIT_URL) value="$livekit_url" ;;
    TRANSLATION_LIVEKIT_API_KEY) value="$livekit_key" ;;
    TRANSLATION_LIVEKIT_API_SECRET) value="$livekit_secret" ;;
    *) value="$(heritage_config_value "$key")" ;;
  esac
  HERITAGE_ENV_FILE="$staged_env" heritage_set_config_value "$key" "$value"
done
(
  export HERITAGE_ENV_FILE="$staged_env"
  use_written_configuration
  heritage_compose config --quiet
  heritage_validate_translation_source
  heritage_compose build translation-processor
)
if heritage_translation_enabled; then
  if heritage_service_running translation-processor; then
    heritage_translation_maintenance true || heritage_die "Finish the translation service before applying this setup."
    previous_processor_running=1
  fi
  heritage_translation_quiesce || heritage_die "Finish the translation service before applying this setup."
fi
staged_processor_started=1
(
  export HERITAGE_ENV_FILE="$staged_env"
  use_written_configuration
  heritage_compose up -d translation-processor
  heritage_translation_wait 60
)
mv -f -- "$staged_env" "$resolved_env"
staged_env=""
config_committed=1
use_written_configuration
"${SCRIPT_DIR}/update.sh" --install-dir "$HERITAGE_INSTALL_DIR" --backup-dir "$HERITAGE_BACKUP_DIR" --no-pull
heritage_info "Live translation is installed: $(heritage_config_value COMMUNITY_PUBLIC_URL)/admin/live-translation"
