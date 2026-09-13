#!/usr/bin/env bash
set -Eeuo pipefail
DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
source "$DEPLOY_DIR/lib/common.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/heritage-translation-tests.XXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

# Update the target of an existing private-config symlink without evaluating values.
printf 'COMMUNITY_NAME=Existing church\nTRANSLATION_OPENAI_API_KEY=old\n' >"$test_root/private.env"
ln -s "$test_root/private.env" "$test_root/community.env"
HERITAGE_ENV_FILE="$test_root/community.env"
literal='test-$dollar-$(not-a-command)-`also-not-a-command` # literal'
heritage_set_config_value TRANSLATION_OPENAI_API_KEY "$literal"
[[ -L "$HERITAGE_ENV_FILE" ]] || fail 'configuration symlink was replaced'
[[ "$(heritage_env_value TRANSLATION_OPENAI_API_KEY)" == "$literal" ]] || fail 'private value was expanded or truncated'
[[ "$(heritage_env_value COMMUNITY_NAME)" == 'Existing church' ]] || fail 'unrelated configuration changed'
if (heritage_set_config_value TRANSLATION_OPENAI_API_KEY $'unsafe\nINJECTED=true') 2>/dev/null; then
  fail 'configuration accepted line injection'
fi

# Format 3 is a single exact checksum set, including translation and sermon data.
backup="$test_root/backup"
mkdir "$backup"
for artifact in database.dump media.tar.gz recovery.tar.gz sermon-media.tar.gz translation.tar.gz; do
  printf 'synthetic-%s\n' "$artifact" >"$backup/$artifact"
done
: >"$backup/sermon-media.inventory"
empty_digest="$(sha256sum "$backup/sermon-media.inventory" | cut -d ' ' -f 1)"
cat >"$backup/manifest.env" <<EOF
HERITAGE_BACKUP_FORMAT=3
DATABASE_FILE=database.dump
MEDIA_FILE=media.tar.gz
RECOVERY_FILE=recovery.tar.gz
SERMON_MEDIA_FILE=sermon-media.tar.gz
SERMON_MEDIA_LAYOUT=tenant-objects-sha256-v1
SERMON_MEDIA_INVENTORY_FILE=sermon-media.inventory
SERMON_MEDIA_INVENTORY_SHA256=$empty_digest
SERMON_MEDIA_OBJECT_COUNT=0
SERMON_MEDIA_OBJECT_BYTES=0
TRANSLATION_FILE=translation.tar.gz
TRANSLATION_SOURCE_REVISION=1111111111111111111111111111111111111111
EOF
checksums() { (cd "$backup"; sha256sum database.dump media.tar.gz recovery.tar.gz sermon-media.tar.gz sermon-media.inventory translation.tar.gz manifest.env >SHA256SUMS); }
checksums
heritage_verify_backup "$backup" >/dev/null || fail 'valid format 3 backup rejected'
printf 'corruption' >>"$backup/translation.tar.gz"
if (heritage_verify_backup "$backup") >/dev/null 2>&1; then fail 'translation corruption accepted'; fi
checksums
cp "$backup/SHA256SUMS" "$test_root/checksums"
tail -1 "$test_root/checksums" >>"$backup/SHA256SUMS"
if (heritage_verify_backup "$backup") >/dev/null 2>&1; then fail 'duplicate checksum accepted'; fi
cp "$test_root/checksums" "$backup/SHA256SUMS"
sed 's/HERITAGE_BACKUP_FORMAT=3/HERITAGE_BACKUP_FORMAT=2/' "$backup/manifest.env" >"$test_root/manifest"
mv "$test_root/manifest" "$backup/manifest.env"
checksums
if (heritage_verify_backup "$backup") >/dev/null 2>&1; then fail 'legacy backup accepted unexpected translation'; fi

# An active service refuses maintenance before any stop operation.
(
  heritage_service_running() { return 0; }
  heritage_translation_maintenance() { printf 'maintenance\n' >>"$test_root/busy.log"; return 1; }
  heritage_compose() { printf 'unexpected-stop\n' >>"$test_root/busy.log"; }
  if heritage_translation_quiesce; then exit 1; fi
) || fail 'busy translation was quiesced'
[[ "$(cat "$test_root/busy.log")" == maintenance ]] || fail 'busy service was changed'
(
  running=1
  heritage_service_running() { (( running )); }
  heritage_translation_maintenance() { printf 'maintenance-%s\n' "$1" >>"$test_root/idle.log"; }
  heritage_compose() { printf '%s\n' "$*" >>"$test_root/idle.log"; running=0; }
  heritage_translation_quiesce
) || fail 'idle translation did not quiesce'
[[ "$(cat "$test_root/idle.log")" == $'maintenance-true\nstop --timeout 60 translation-processor' ]] || fail 'stop occurred before maintenance'

# A colliding volume never becomes owned by restore cleanup, and a corrupt staged
# database never changes the configured volume pointer.
for scenario in collision corrupt; do
  (
    translation_restore_volume=''
    HERITAGE_PROJECT_NAME=translation-test
    trap 'printf "%s" "$translation_restore_volume" >"$test_root/$scenario-owned"' EXIT
    heritage_translation_image_id() { printf 'sha256:test\n'; }
    heritage_docker() {
      printf '%s\n' "$*" >>"$test_root/$scenario.log"
      case "$1 $2" in
        'volume inspect') [[ "$scenario" == collision ]];;
        'volume create') return 0;;
        'run --rm') [[ " $* " != *' --entrypoint node '* ]];;
        *) return 99;;
      esac
    }
    heritage_translation_stage_restore "$backup/translation.tar.gz"
    heritage_translation_select_restore
  ) >/dev/null 2>&1 && fail "$scenario restore unexpectedly succeeded"
done
[[ ! -s "$test_root/collision-owned" ]] || fail 'restore claimed an existing volume'
[[ -s "$test_root/corrupt-owned" ]] || fail 'restore lost track of its own temporary volume'
[[ -z "$(heritage_env_value HERITAGE_TRANSLATION_VOLUME)" ]] || fail 'failed restore changed volume pointer'

# Exercise the actual setup command against a clean pinned source, without Docker.
source_fixture="$test_root/source"
mkdir -p "$source_fixture/services/processor" "$source_fixture/apps/operator/src"
printf 'FROM scratch\n' >"$source_fixture/services/processor/Dockerfile"
printf 'export {};\n' >"$source_fixture/apps/operator/src/heritage.tsx"
printf '1\n' >"$source_fixture/services/processor/heritage-companion.version"
git -C "$source_fixture" init -q
git -C "$source_fixture" remote add origin https://github.com/edydex/multilinguum.git
git -C "$source_fixture" add .
git -C "$source_fixture" -c user.name=Rehearsal -c user.email=rehearsal@example.invalid commit -qm fixture
source_revision="$(git -C "$source_fixture" rev-parse HEAD)"
HERITAGE_ENV_FILE="$HERITAGE_ENV_FILE" bash "$DEPLOY_DIR/translation.sh" configure --source "$source_fixture" --revision "$source_revision" --dry-run >/dev/null \
  || fail 'compatible pinned setup dry-run failed'
if HERITAGE_ENV_FILE="$HERITAGE_ENV_FILE" bash "$DEPLOY_DIR/translation.sh" configure --source "$source_fixture" --revision 1111111111111111111111111111111111111111 --dry-run >/dev/null 2>&1; then
  fail 'setup accepted a mismatched source revision'
fi
printf 'uncommitted\n' >>"$source_fixture/services/processor/Dockerfile"
if HERITAGE_ENV_FILE="$HERITAGE_ENV_FILE" bash "$DEPLOY_DIR/translation.sh" configure --source "$source_fixture" --revision "$source_revision" --dry-run >/dev/null 2>&1; then
  fail 'setup accepted dirty translation source'
fi
printf 'ok - translation configuration, checksum sets, live maintenance guard and staged restore failure boundaries\n'
