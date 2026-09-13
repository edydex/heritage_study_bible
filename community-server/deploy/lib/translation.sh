#!/usr/bin/env bash

heritage_translation_enabled() {
  [[ "$(heritage_config_value HERITAGE_TRANSLATION_ENABLED false)" == true ]]
}

heritage_translation_volume_name() {
  heritage_volume_name HERITAGE_TRANSLATION_VOLUME heritage-community-translation
}

heritage_validate_translation_source() {
  local source revision origin
  source="${1:-$(heritage_config_value HERITAGE_TRANSLATION_SOURCE)}"
  revision="${2:-$(heritage_config_value HERITAGE_TRANSLATION_REVISION)}"
  [[ -n "$source" && "$source" == /* && -d "$source" ]] || heritage_die \
    "Translation source is missing. Run the unified workspace bootstrap and translation setup."
  [[ "$revision" =~ ^[a-f0-9]{40}$ ]] || heritage_die "Translation must be pinned to one full source revision."
  [[ "$(git -C "$source" rev-parse --show-toplevel)" == "$source" ]] || heritage_die "Translation source must be its own checkout."
  origin="$(git -C "$source" remote get-url origin)"
  [[ "$origin" == https://github.com/edydex/multilinguum.git ]] || heritage_die "Translation source has an unexpected repository."
  [[ "$(git -C "$source" rev-parse HEAD)" == "$revision" ]] || heritage_die "Translation source differs from its configured revision."
  [[ -z "$(git -C "$source" status --porcelain)" ]] || heritage_die "Translation source has local changes; preserve them before updating."
  [[ -f "$source/services/processor/Dockerfile" && -f "$source/apps/operator/src/heritage.tsx" ]] || heritage_die \
    "This translation revision does not include the Community operator. Select a compatible integration release."
  [[ -f "$source/services/processor/heritage-companion.version" && "$(cat "$source/services/processor/heritage-companion.version")" == 1 ]] || heritage_die \
    "This translation revision does not support guarded companion maintenance. Select a compatible integration release."
}

heritage_translation_image_id() {
  local reference
  reference="$(heritage_config_value HERITAGE_TRANSLATION_IMAGE heritage-translation:local)"
  heritage_docker image inspect --format '{{.Id}}' "$reference"
}

heritage_translation_archive() {
  local destination="$1" image_id
  heritage_service_running translation-processor && heritage_die "Stop the translation processor before copying its archive database."
  image_id="$(heritage_translation_image_id)" || heritage_die "The configured translation image is not installed."
  heritage_docker volume inspect "$(heritage_translation_volume_name)" >/dev/null || heritage_die "Translation storage is missing; no backup was published."
  heritage_docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user 10001:10001 \
    --volume "$(heritage_translation_volume_name):/var/lib/multilinguum:ro" \
    --entrypoint tar "$image_id" -czf - -C /var/lib/multilinguum . >"$destination"
  heritage_validate_tar_archive "$destination" generic || heritage_die "Translation archive validation failed."
}

heritage_translation_wait() {
  local limit="${1:-60}" elapsed=0
  while (( elapsed < limit )); do
    if heritage_compose exec -T translation-processor node -e \
      "fetch('http://127.0.0.1:4310/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  return 1
}

# Literal single-quoted dotenv values avoid both shell execution and Compose interpolation.
heritage_set_config_value() {
  local key="$1" value="$2" file temporary
  [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || heritage_die "Invalid configuration key."
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* && "$value" != *"'"* && "$value" != *'\'* ]] \
    || heritage_die "Translation configuration cannot contain line breaks, apostrophes, or backslashes."
  file="$(heritage_realpath_allow_missing "$HERITAGE_ENV_FILE")" || heritage_die "Cannot resolve the configuration file."
  [[ -f "$file" ]] || heritage_die "The existing configuration file is missing."
  temporary="$(mktemp "${file}.translation.XXXXXX")" || heritage_die "Cannot create a private configuration update."
  if ! awk -v wanted="$key" '$0 !~ "^[[:space:]]*" wanted "[[:space:]]*=" { print }' "$file" >"$temporary"; then
    rm -f -- "$temporary"
    heritage_die "Cannot read the existing configuration."
  fi
  printf "%s='%s'\n" "$key" "$value" >>"$temporary"
  chmod 0600 "$temporary"
  mv -f -- "$temporary" "$file"
}

# The processor locks out new sessions before stopping; an active service refuses this operation.
heritage_translation_maintenance() {
  local enabled="$1"
  heritage_compose exec -T translation-processor node -e '
    fetch("http://127.0.0.1:4310/api/maintenance", {
      method: "POST",
      headers: { authorization: "Bearer " + process.env.PROCESSOR_CONTROL_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ enabled: process.argv[1] === "true" }),
      signal: AbortSignal.timeout(10000)
    }).then(r => {
      if (!r.ok) { console.error("Translation cannot enter maintenance. Finish any prepared or live service first, and check the processor version."); process.exitCode = 1; }
    }).catch(() => { console.error("Cannot contact translation maintenance."); process.exitCode = 1; });
  ' "$enabled"
}

heritage_translation_quiesce() {
  if heritage_service_running translation-processor; then
    heritage_translation_maintenance true || return 1
    heritage_compose stop --timeout 60 translation-processor >/dev/null || return 1
    ! heritage_service_running translation-processor || return 1
  fi
}

# Restore into a distinct volume. The old volume stays available for recovery.
heritage_translation_stage_restore() {
  local archive="$1" image_id candidate
  image_id="$(heritage_translation_image_id)" || heritage_die "The translation image is required to validate this restore."
  candidate="${HERITAGE_PROJECT_NAME}-translation-restore-$(date -u '+%Y%m%d%H%M%S')-$$"
  [[ "$candidate" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || heritage_die "Unsafe translation restore volume name."
  if heritage_docker volume inspect "$candidate" >/dev/null 2>&1; then
    heritage_die "The proposed translation restore volume already exists."
  fi
  heritage_docker volume create --label heritage.purpose=translation-restore "$candidate" >/dev/null \
    || heritage_die "Could not create translation restore storage."
  translation_restore_volume="$candidate"
  heritage_docker run --rm -i --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user 10001:10001 \
    --volume "$translation_restore_volume:/var/lib/multilinguum" \
    --entrypoint tar "$image_id" --no-same-owner -xzf - -C /var/lib/multilinguum <"$archive" \
    || heritage_die "Translation archive extraction failed; the original volume is unchanged."
  heritage_docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user 10001:10001 \
    --volume "$translation_restore_volume:/var/lib/multilinguum" \
    --entrypoint node "$image_id" --input-type=module -e '
      import { DatabaseSync } from "node:sqlite";
      const db = new DatabaseSync("/var/lib/multilinguum/archives/index.sqlite", { readOnly: true });
      const result = db.prepare("PRAGMA quick_check").all();
      db.close();
      if (result.length !== 1 || Object.values(result[0])[0] !== "ok") process.exit(1);
    ' || heritage_die "Restored translation database failed its integrity check; the original volume is unchanged."
}

heritage_translation_select_restore() {
  local previous
  previous="$(heritage_translation_volume_name)"
  heritage_set_config_value HERITAGE_TRANSLATION_VOLUME "$translation_restore_volume"
  export HERITAGE_TRANSLATION_VOLUME="$translation_restore_volume"
  translation_restore_selected=1
  heritage_info "Restored translation storage selected. Previous volume retained for recovery: $previous"
}

heritage_translation_resume() {
  heritage_compose start translation-processor >/dev/null || return 1
  heritage_translation_wait 60 || return 1
  heritage_translation_maintenance false
}
