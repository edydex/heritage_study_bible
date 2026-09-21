#!/usr/bin/env bash
# Explicit opt-in integration rehearsal. Uses only a new project and disposable volumes.
set -Eeuo pipefail
umask 077
DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
source "$DEPLOY_DIR/lib/common.sh"
[[ -n "${HERITAGE_TRANSLATION_TEST_IMAGE:-}" ]] || heritage_die 'Set HERITAGE_TRANSLATION_TEST_IMAGE to a locally built processor image.'
test_root="$(mktemp -d /var/tmp/heritage-translation-docker.XXXXXX)"
HERITAGE_PROJECT_NAME="heritage-translation-test-$(basename "$test_root" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
HERITAGE_INSTALL_DIR="$(cd "$DEPLOY_DIR/.." && pwd -P)"
# Read by heritage_compose in the sourced common library.
# shellcheck disable=SC2034
HERITAGE_COMPOSE_FILE="$HERITAGE_INSTALL_DIR/docker-compose.production.yml"
HERITAGE_ENV_FILE="$test_root/community.env"
original_volume="$HERITAGE_PROJECT_NAME-original"
translation_restore_volume=''
cat >"$HERITAGE_ENV_FILE" <<EOF
DATABASE_URL=postgresql://unused:unused@postgres/unused
POSTGRES_DB=unused
POSTGRES_USER=unused
POSTGRES_PASSWORD=unused-synthetic-rehearsal
PAYLOAD_SECRET=synthetic-rehearsal-secret-never-used-for-members
COMMUNITY_ID=translation-rehearsal
COMMUNITY_NAME=Isolated translation rehearsal
COMMUNITY_PUBLIC_URL=https://translation-rehearsal.invalid
HERITAGE_APP_URL=https://translation-rehearsal.invalid
HERITAGE_APP_ORIGINS=https://translation-rehearsal.invalid
HERITAGE_TRANSLATION_ENABLED=true
HERITAGE_TRANSLATION_IMAGE=$HERITAGE_TRANSLATION_TEST_IMAGE
HERITAGE_TRANSLATION_VOLUME=$original_volume
HERITAGE_POSTGRES_VOLUME=$HERITAGE_PROJECT_NAME-postgres
HERITAGE_MEDIA_VOLUME=$HERITAGE_PROJECT_NAME-media
HERITAGE_SERMON_MEDIA_VOLUME=$HERITAGE_PROJECT_NAME-sermon
TRANSLATION_CONTROL_TOKEN='synthetic-control-key-with-literal-\$dollar-value'
EOF
heritage_init_context
heritage_init_docker
heritage_translation_image_id >/dev/null
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e
  heritage_compose down --volumes --timeout 15 >/dev/null 2>&1
  for volume in "$original_volume" "$translation_restore_volume"; do
    [[ -z "$volume" || "$volume" != "$HERITAGE_PROJECT_NAME-"* ]] || heritage_docker volume rm "$volume" >/dev/null 2>&1
  done
  if (( status == 0 )); then rm -rf -- "$test_root"; else heritage_warn "Rehearsal evidence retained: $test_root"; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
heritage_compose config --quiet
heritage_compose up -d --no-build --pull never translation-processor
heritage_translation_wait 60 || heritage_die 'Rehearsal processor failed to start.'
container_id="$(heritage_compose ps -q translation-processor)"
[[ "$(heritage_docker inspect --format '{{len .HostConfig.PortBindings}}' "$container_id")" == 0 ]] || heritage_die 'Rehearsal exposed a host port.'
heritage_compose exec -T translation-processor node --input-type=module - <<'JS'
import assert from 'node:assert/strict';
assert.equal(process.env.OPENAI_API_KEY, '');
assert.equal(process.env.LIVEKIT_API_SECRET, '');
assert.equal(process.env.PROCESSOR_CONTROL_TOKEN, 'synthetic-control-key-with-literal-$dollar-value');
const headers = { authorization: `Bearer ${process.env.PROCESSOR_CONTROL_TOKEN}`, 'content-type': 'application/json' };
const post = async (path, data, status = 200) => {
  const response = await fetch('http://127.0.0.1:4310' + path, { method: 'POST', headers, body: JSON.stringify(data) });
  assert.equal(response.status, status, path);
  return response.json();
};
for (const filename of ['heritage.js', 'operator.js', 'pcm-worklet.js']) {
  const response = await fetch('http://127.0.0.1:4310/client/' + filename);
  assert.equal(response.status, 200, filename);
  assert.match(response.headers.get('content-type'), /javascript/);
}
const session = {
  sourceLanguage: 'en',
  targets: ['en', 'ru'].map(language => ({ id: 'channel-' + language, targetLanguage: language, translationProvider: 'deterministic', voiceMode: language === 'en' ? 'source' : 'natural', fallbackOrder: ['mute'], muted: false, speechEnabled: false })),
  processingNode: { id: 'rehearsal', name: 'Synthetic rehearsal', mode: 'embedded', endpoint: 'http://127.0.0.1:4310', identityFingerprint: 'synthetic-rehearsal-identity' },
  archivePolicy: { retentionDays: 1, retainIndefinitely: false, recordSource: false, recordTranslations: false },
  expectedDurationMinutes: 5, budgetWarningUsd: 20,
};
await post('/api/sessions', session);
await post('/api/maintenance', { enabled: true }, 409);
assert.equal((await post('/api/sessions/current/stop', {})).archive, null);
await post('/api/maintenance', { enabled: true });
await post('/api/sessions', session, 503);
await post('/api/maintenance', { enabled: false });
await post('/api/sessions', session);
await post('/api/sessions/current/start', {});
await post('/api/sessions/current/replay', { segments: [{ text: 'Grace to you and peace from God our Father.', sequence: 0, sourceStartMs: 0, sourceEndMs: 4000, final: true }] });
await post('/api/maintenance', { enabled: true }, 409);
const stopped = await post('/api/sessions/current/stop', {});
assert.equal(stopped.archive.transcripts.length, 2);
assert.equal(stopped.archive.audioTracks.length, 0);
console.log('PASS: packaged clients, literal configuration, prepared cancellation, live guard, synthetic EN/RU archive without provider credentials');
JS
heritage_translation_quiesce
[[ "$(heritage_docker inspect --format '{{.State.ExitCode}}' "$container_id")" == 0 ]] || heritage_die 'Processor did not exit cleanly on SIGTERM.'
heritage_translation_archive "$test_root/translation.tar.gz"
heritage_translation_stage_restore "$test_root/translation.tar.gz"
heritage_translation_select_restore
heritage_compose up -d --no-build --pull never translation-processor
heritage_translation_wait 60 || heritage_die 'Restored processor did not become healthy.'
heritage_compose exec -T translation-processor node --input-type=module - <<'JS'
import assert from 'node:assert/strict';
const headers = { authorization: `Bearer ${process.env.PROCESSOR_CONTROL_TOKEN}` };
const response = await fetch('http://127.0.0.1:4310/api/archives', { headers });
assert.equal(response.status, 200);
const archives = await response.json();
assert.equal(archives.length, 1);
for (const language of ['en', 'ru']) {
  const transcript = await fetch(`http://127.0.0.1:4310/api/archives/${archives[0].sessionId}/transcripts/channel-${language}`, { headers });
  assert.equal(transcript.status, 200);
  const records = (await transcript.text()).trim().split('\n').map(JSON.parse);
  assert.ok(records.some(record => record.final && record.text.length > 0));
}
console.log('PASS: stopped archive copy, fresh-volume extraction, SQLite integrity check, restored EN/RU transcript retrieval');
JS
heritage_docker volume inspect "$original_volume" >/dev/null
printf 'PASS: original volume retained; rehearsal cleanup only removes its own disposable project and volumes\n'
