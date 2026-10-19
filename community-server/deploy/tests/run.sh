#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SERVER_DIR="$(cd -- "${DEPLOY_DIR}/.." && pwd -P)"
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/heritage-installer-tests.XXXXXX")
trap 'rm -rf -- "$TMP_ROOT"' EXIT

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'ok - %s\n' "$*"; }

scripts=(
  "${DEPLOY_DIR}"/*.sh
  "${DEPLOY_DIR}/heritage-community"
  "${DEPLOY_DIR}/lib"/*.sh
  "${DEPLOY_DIR}/tests"/*.sh
)
for script in "${scripts[@]}"; do
  bash -n "$script"
done
pass "all operator scripts pass bash syntax checking"

grep -Fq '/app/private/sermon-media/staging' "${SERVER_DIR}/Dockerfile" \
  && grep -Fq '/app/private/sermon-media/objects' "${SERVER_DIR}/Dockerfile" \
  || fail "runtime image does not precreate private sermon-media structural directories"
grep -Fq 'chown -R nextjs:nodejs /app/media /app/private /app/.next' \
  "${SERVER_DIR}/Dockerfile" \
  || fail "runtime image does not assign the private mountpoint to UID/GID 1001"
grep -Fq '/app/private/sermon-media/objects' "${SERVER_DIR}/Dockerfile" \
  || fail "runtime image private sermon path is not mode 0700"
grep -Fq 'HERITAGE_SERMON_MEDIA_PATH: /app/private/sermon-media' \
  "${SERVER_DIR}/docker-compose.production.yml" \
  || fail "production Compose does not lock the private sermon-media path"
grep -Fq 'sermon-media:/app/private/sermon-media' \
  "${SERVER_DIR}/docker-compose.production.yml" \
  || fail "production Compose does not mount the private sermon volume"
grep -Fq 'read_only: true' "${SERVER_DIR}/docker-compose.production.yml" \
  || fail "production Compose no longer keeps service root filesystems read-only"
for capacity_default in \
  'HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED: ${HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED:-false}' \
  'HERITAGE_SERMON_MEDIA_MAX_ACTIVE_GLOBAL: ${HERITAGE_SERMON_MEDIA_MAX_ACTIVE_GLOBAL:-8}' \
  'HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_COMMUNITY: ${HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_COMMUNITY:-4}' \
  'HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_CONNECTION: ${HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_CONNECTION:-2}' \
  'HERITAGE_SERMON_MEDIA_MAX_FINALIZING_GLOBAL: ${HERITAGE_SERMON_MEDIA_MAX_FINALIZING_GLOBAL:-1}' \
  'HERITAGE_SERMON_MEDIA_MAX_RETAINED_BYTES_PER_COMMUNITY: ${HERITAGE_SERMON_MEDIA_MAX_RETAINED_BYTES_PER_COMMUNITY:-53687091200}' \
  'HERITAGE_SERMON_MEDIA_MAX_RETAINED_OBJECTS_PER_COMMUNITY: ${HERITAGE_SERMON_MEDIA_MAX_RETAINED_OBJECTS_PER_COMMUNITY:-2000}' \
  'HERITAGE_SERMON_MEDIA_STORAGE_RESERVE_BYTES: ${HERITAGE_SERMON_MEDIA_STORAGE_RESERVE_BYTES:-5368709120}'; do
  grep -Fq "${capacity_default}" "${SERVER_DIR}/docker-compose.production.yml" \
    || fail "production Compose omits managed recording default: ${capacity_default}"
done
grep -Fq 'sermon-media-maintenance:' \
  "${SERVER_DIR}/docker-compose.production.yml" \
  || fail "production Compose omits the quiesced sermon-media maintenance service"
pass "runtime image and Compose lock the private recording mount while preserving a read-only root"

# shellcheck source=../lib/common.sh
source "${DEPLOY_DIR}/lib/common.sh"

assert_sermon_schema_probe_status() {
  local mock_table_count="$1"
  local expected_status="$2"
  local query_failure="${3:-0}"
  local actual_status

  set +e
  (
    heritage_compose() {
      (( query_failure == 0 )) || return "${query_failure}"
      printf '%s\n' "${mock_table_count}"
    }
    heritage_sermon_media_schema_present >/dev/null
  )
  actual_status=$?
  set -e
  [[ "${actual_status}" == "${expected_status}" ]] \
    || fail "managed-media schema probe returned ${actual_status}, expected ${expected_status} for table count ${mock_table_count}"
}

assert_sermon_schema_probe_status 3 0
assert_sermon_schema_probe_status 0 1
assert_sermon_schema_probe_status 1 2
assert_sermon_schema_probe_status 2 2
assert_sermon_schema_probe_status invalid 2
assert_sermon_schema_probe_status 3 2 86
for managed_table in \
  syncshow_sermon_media_objects \
  syncshow_sermon_media_uploads \
  syncshow_sermon_media_chunks; do
  grep -Fq "public.${managed_table}" "${DEPLOY_DIR}/lib/common.sh" \
    || fail "managed-media schema probe omits ${managed_table}"
done
legacy_database_inventory="${TMP_ROOT}/legacy-sermon-media.database.inventory"
(
  heritage_compose() { printf '0\n'; }
  read -r legacy_objects legacy_bytes \
    < <(heritage_sermon_media_database_summary) \
    || exit 1
  [[ "${legacy_objects}" == "0" && "${legacy_bytes}" == "0" ]] \
    || exit 1
  heritage_capture_sermon_database_inventory "${legacy_database_inventory}" \
    || exit 1
  [[ -f "${legacy_database_inventory}" && ! -s "${legacy_database_inventory}" ]] \
    || exit 1
) || fail "fully absent legacy schema did not produce an exact empty database inventory"
for partial_table_count in 1 2; do
  if (
    heritage_compose() { printf '%s\n' "${partial_table_count}"; }
    heritage_sermon_media_database_summary >/dev/null
  ); then
    fail "partial managed-media schema produced a legacy-empty database summary"
  fi
  if (
    heritage_compose() { printf '%s\n' "${partial_table_count}"; }
    heritage_capture_sermon_database_inventory \
      "${TMP_ROOT}/partial-${partial_table_count}.database.inventory" \
      >/dev/null 2>&1
  ); then
    fail "partial managed-media schema produced a legacy-empty database inventory"
  fi
done
pass "managed-media schema probe accepts all-or-none legacy state and rejects partial schemas"

archive_test_root="${TMP_ROOT}/archive-validation"
archive_namespace="$(printf 'a%.0s' {1..64})"
archive_payload='private-sermon-archive-validator'
archive_digest="$(printf '%s' "${archive_payload}" | sha256sum | cut -d' ' -f1)"
archive_prefix="${archive_digest:0:2}"
mkdir -p \
  "${archive_test_root}/safe/objects/${archive_namespace}/sha256/${archive_prefix}"
printf '%s' "${archive_payload}" \
  >"${archive_test_root}/safe/objects/${archive_namespace}/sha256/${archive_prefix}/${archive_digest}"
chmod 0700 "${archive_test_root}/safe/objects" \
  "${archive_test_root}/safe/objects/${archive_namespace}" \
  "${archive_test_root}/safe/objects/${archive_namespace}/sha256" \
  "${archive_test_root}/safe/objects/${archive_namespace}/sha256/${archive_prefix}"
chmod 0600 \
  "${archive_test_root}/safe/objects/${archive_namespace}/sha256/${archive_prefix}/${archive_digest}"
tar -czf "${archive_test_root}/safe.tar.gz" \
  -C "${archive_test_root}/safe" objects
heritage_validate_tar_archive "${archive_test_root}/safe.tar.gz" sermon-media \
  || fail "a safe content-addressed sermon-media archive was rejected"
format2_backup="${archive_test_root}/format2-backup"
mkdir -p "${format2_backup}"
printf 'database\n' >"${format2_backup}/database.dump"
printf 'uploaded media\n' | gzip -c >"${format2_backup}/media.tar.gz"
printf 'recovery\n' | gzip -c >"${format2_backup}/recovery.tar.gz"
cp -- "${archive_test_root}/safe.tar.gz" \
  "${format2_backup}/sermon-media.tar.gz"
archive_object_size="$(wc -c \
  <"${archive_test_root}/safe/objects/${archive_namespace}/sha256/${archive_prefix}/${archive_digest}" \
  | tr -d ' ')"
printf 'objects/%s/sha256/%s/%s\t%s\t%s\n' \
  "${archive_namespace}" "${archive_prefix}" "${archive_digest}" \
  "${archive_object_size}" "${archive_digest}" \
  >"${format2_backup}/sermon-media.inventory"
archive_inventory_digest="$(
  sha256sum "${format2_backup}/sermon-media.inventory" | cut -d' ' -f1
)"
printf '%s\n' \
  'HERITAGE_BACKUP_FORMAT=2' \
  'DATABASE_FILE=database.dump' \
  'MEDIA_FILE=media.tar.gz' \
  'RECOVERY_FILE=recovery.tar.gz' \
  'SERMON_MEDIA_FILE=sermon-media.tar.gz' \
  'SERMON_MEDIA_LAYOUT=tenant-objects-sha256-v1' \
  'SERMON_MEDIA_INVENTORY_FILE=sermon-media.inventory' \
  "SERMON_MEDIA_INVENTORY_SHA256=${archive_inventory_digest}" \
  'SERMON_MEDIA_OBJECT_COUNT=1' \
  "SERMON_MEDIA_OBJECT_BYTES=${archive_object_size}" \
  >"${format2_backup}/manifest.env"
(
  cd -- "${format2_backup}"
  sha256sum database.dump media.tar.gz recovery.tar.gz sermon-media.tar.gz \
    sermon-media.inventory manifest.env >SHA256SUMS
)
heritage_verify_backup "${format2_backup}" >/dev/null \
  || fail "an exact checksummed format 2 backup was rejected"
large_inventory="${archive_test_root}/large.inventory"
printf 'objects/%s/sha256/%s/%s\t53687091200\t%s\n' \
  "${archive_namespace}" "${archive_prefix}" "${archive_digest}" \
  "${archive_digest}" >"${large_inventory}"
read -r large_digest large_count large_bytes \
  < <(heritage_sermon_inventory_summary "${large_inventory}")
[[ "${large_digest}" =~ ^[0-9a-f]{64}$ \
  && "${large_count}" == "1" \
  && "${large_bytes}" == "53687091200" ]] \
  || fail "canonical inventory summary loses exact byte totals above 2 GiB"

mkdir -p "${archive_test_root}/unsafe"
printf 'unsafe\n' >"${archive_test_root}/unsafe/original"
ln "${archive_test_root}/unsafe/original" "${archive_test_root}/unsafe/hardlink"
tar -czf "${archive_test_root}/hardlink.tar.gz" \
  -C "${archive_test_root}/unsafe" original hardlink
if heritage_validate_tar_archive "${archive_test_root}/hardlink.tar.gz" generic \
  >/dev/null 2>&1; then
  fail "archive validation accepted a hard-link member"
fi
ln -s original "${archive_test_root}/unsafe/symlink"
tar -czf "${archive_test_root}/symlink.tar.gz" \
  -C "${archive_test_root}/unsafe" symlink
if heritage_validate_tar_archive "${archive_test_root}/symlink.tar.gz" generic \
  >/dev/null 2>&1; then
  fail "archive validation accepted a symbolic-link member"
fi
pass "archive validation accepts exact recording objects and rejects link members"

backup_dump_check_line=$(grep -n -m 1 'pg_restore --list' "${DEPLOY_DIR}/backup.sh" | cut -d: -f1)
backup_media_check_line=$(grep -n -m 1 \
  'heritage_validate_tar_archive "${partial}/media.tar.gz" generic' \
  "${DEPLOY_DIR}/backup.sh" | cut -d: -f1)
backup_complete_check_line=$(grep -n -m 1 \
  'heritage_verify_backup "${partial}"' \
  "${DEPLOY_DIR}/backup.sh" | cut -d: -f1)
backup_publish_line=$(grep -n -m 1 'mv -- "${partial}" "${destination}"' "${DEPLOY_DIR}/backup.sh" | cut -d: -f1)
[[ -n $backup_dump_check_line \
  && -n $backup_media_check_line \
  && -n $backup_complete_check_line \
  && -n $backup_publish_line \
  && $backup_dump_check_line -lt $backup_publish_line \
  && $backup_media_check_line -lt $backup_publish_line \
  && $backup_complete_check_line -lt $backup_publish_line ]] \
  || fail "a backup can be published before its dump, archives, and complete set are validated"

restore_dump_check_line=$(grep -n -m 1 'pg_restore postgres --list' "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
restore_confirmation_line=$(grep -n -m 1 '^confirmation=' "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
restore_drop_line=$(grep -n -m 1 'dropdb --maintenance-db' "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
[[ -n $restore_dump_check_line \
  && -n $restore_confirmation_line \
  && -n $restore_drop_line \
  && $restore_dump_check_line -lt $restore_confirmation_line \
  && $restore_dump_check_line -lt $restore_drop_line ]] \
  || fail "restore can prompt or replace live data before validating the PostgreSQL dump catalog"
pass "backup and restore validate PostgreSQL dump catalogs before publication or replacement"

maintenance_stop_line=$(grep -n -m 1 'stop --timeout 60 community' \
  "${DEPLOY_DIR}/backup.sh" | cut -d: -f1)
maintenance_backup_line=$(grep -n -m 1 'sermon-media-maintenance.sh' \
  "${DEPLOY_DIR}/backup.sh" | cut -d: -f1)
maintenance_dump_line=$(grep -n -m 1 'pg_dump --username' \
  "${DEPLOY_DIR}/backup.sh" | cut -d: -f1)
[[ -n "${maintenance_stop_line}" \
  && -n "${maintenance_backup_line}" \
  && -n "${maintenance_dump_line}" \
  && "${maintenance_stop_line}" -lt "${maintenance_backup_line}" \
  && "${maintenance_backup_line}" -lt "${maintenance_dump_line}" ]] \
  || fail "quiesced backup does not run supported sermon-media maintenance between stop and pg_dump"
grep -Fq -- '--require-backup-ready' "${DEPLOY_DIR}/backup.sh" \
  || fail "quiesced backup does not refuse remaining active staging"
backup_quiesced_layout_block="$(
  sed -n '/^ensure_private_sermon_layout_quiesced() {$/,/^}$/p' \
    "${DEPLOY_DIR}/backup.sh"
)"
backup_online_layout_block="$(
  sed -n '/^ensure_private_sermon_layout_online() {$/,/^}$/p' \
    "${DEPLOY_DIR}/backup.sh"
)"
restore_prepare_volume_block="$(
  sed -n '/^prepare_sermon_restore_volume() {$/,/^}$/p' \
    "${DEPLOY_DIR}/restore.sh"
)"
for capability in CHOWN DAC_OVERRIDE FOWNER; do
  [[ "$(grep -Fc -- "--cap-add ${capability}" \
    <<<"${backup_quiesced_layout_block}")" == "1" ]] \
    || fail "quiesced backup private-layout preparation does not add exactly one ${capability}"
  [[ "$(grep -Fc -- "--cap-add ${capability}" \
    <<<"${restore_prepare_volume_block}")" == "1" ]] \
    || fail "restore private-volume preparation does not add exactly one ${capability}"
done
[[ "$(grep -c -- '--cap-add ' <<<"${backup_quiesced_layout_block}")" == "3" ]] \
  || fail "quiesced backup private-layout preparation has an unexpected capability set"
[[ "$(grep -c -- '--cap-add ' <<<"${restore_prepare_volume_block}")" == "3" ]] \
  || fail "restore private-volume preparation has an unexpected capability set"
[[ "$(grep -c -- '--cap-add ' "${DEPLOY_DIR}/backup.sh")" == "3" ]] \
  || fail "backup adds capabilities outside its quiesced private-layout repair"
[[ "$(grep -c -- '--user 0' "${DEPLOY_DIR}/backup.sh")" == "1" ]] \
  || fail "backup overrides the service identity outside its quiesced private-layout repair"
if grep -Eq -- '--cap-add |--user 0|--privileged' \
  <<<"${backup_online_layout_block}"; then
  fail "online backup private-layout validation can run with elevated container authority"
fi
if grep -Fq -- '--privileged' "${DEPLOY_DIR}/backup.sh" \
  || grep -Fq -- '--privileged' "${DEPLOY_DIR}/restore.sh"; then
  fail "backup or restore uses an unrestricted privileged helper"
fi
grep -Fq 'for child in staging objects' <<<"${backup_quiesced_layout_block}" \
  || fail "quiesced backup does not validate each private-layout child"
grep -Fq '[ -L "${target}" ]' <<<"${backup_quiesced_layout_block}" \
  || fail "quiesced backup does not reject private-layout child symlinks"
grep -Fq 'for child in staging objects' <<<"${backup_online_layout_block}" \
  || fail "online backup does not validate each private-layout child"
grep -Fq '[ -L "${target}" ]' <<<"${backup_online_layout_block}" \
  || fail "online backup does not reject private-layout child symlinks"
[[ "$(grep -Fc 'ensure_private_sermon_layout_quiesced' \
  "${DEPLOY_DIR}/backup.sh")" == "2" ]] \
  && grep -Eq '^  ensure_private_sermon_layout_quiesced$' \
    "${DEPLOY_DIR}/backup.sh" \
  || fail "quiesced backup does not call its private-layout repair exactly once"
[[ "$(grep -Fc 'ensure_private_sermon_layout_online' \
  "${DEPLOY_DIR}/backup.sh")" == "2" ]] \
  && grep -Eq '^  ensure_private_sermon_layout_online$' \
    "${DEPLOY_DIR}/backup.sh" \
  || fail "online backup does not call its unprivileged private-layout validation exactly once"
grep -Fq 'sermon-media-maintenance)' "${DEPLOY_DIR}/heritage-community" \
  || fail "the supported operator dispatcher omits sermon-media maintenance"
grep -Fq 'sermon-media-maintenance.sh' "${DEPLOY_DIR}/install.sh" \
  || fail "the installer does not validate and chmod sermon-media maintenance"
grep -Fq 'HERITAGE_SERMON_MEDIA_MAINTENANCE_QUIESCED=true' \
  "${DEPLOY_DIR}/sermon-media-maintenance.sh" \
  || fail "maintenance wrapper does not explicitly acknowledge quiescence"
grep -Fq 'HERITAGE_SERMON_MEDIA_MAINTENANCE_REQUIRE_BACKUP_READY=true' \
  "${DEPLOY_DIR}/sermon-media-maintenance.sh" \
  || fail "backup-ready maintenance does not explicitly enable fresh verified orphan cleanup"
if grep -Fq 'sermon-media-maintenance.sh' "${DEPLOY_DIR}/status.sh"; then
  fail "status can invoke mutating sermon-media maintenance"
fi
pass "supported quiesced maintenance is installed, dispatched, and required by backup"

restore_prepare_line=$(grep -n -m 1 '^  prepare_sermon_restore_volume$' \
  "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
restore_live_layout_line=$(grep -n -m 1 \
  '^  validate_live_sermon_layout_for_restore$' \
  "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
restore_copy_compare_line=$(grep -n -m 1 \
  'cmp /tmp/sermon-restore-expected /tmp/sermon-restore-actual' \
  "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
restore_swap_line=$(grep -n -m 1 'mv "${new}" "${base}/objects"' \
  "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
[[ -n "${restore_prepare_line}" \
  && -n "${restore_live_layout_line}" \
  && -n "${restore_copy_compare_line}" \
  && -n "${restore_swap_line}" \
  && "${restore_prepare_line}" -lt "${restore_drop_line}" \
  && "${restore_live_layout_line}" -lt "${restore_drop_line}" \
  && "${restore_copy_compare_line}" -lt "${restore_swap_line}" ]] \
  || fail "private recordings can reach a live or partial replacement before distinct-volume validation"
restore_live_layout_block="$(
  sed -n '/^validate_live_sermon_layout_for_restore() {$/,/^}$/p' \
    "${DEPLOY_DIR}/restore.sh"
)"
if grep -Eq -- '--cap-add |--user 0|--privileged' \
  <<<"${restore_live_layout_block}"; then
  fail "live restore-layout validation can run with elevated container authority"
fi
grep -Fq '[ -L "${staging}" ]' <<<"${restore_live_layout_block}" \
  || fail "restore preflight does not reject a live staging symlink"
grep -Fq '[ -L "${objects}" ]' <<<"${restore_live_layout_block}" \
  || fail "restore preflight does not reject a live objects symlink"
if grep -Fq 'mkdir -p "${base}/staging"' "${DEPLOY_DIR}/restore.sh"; then
  fail "restore can follow a live staging symlink while preparing replacement"
fi
restore_safety_retention_line=$(grep -n -m 1 -- '--retention-days 0' \
  "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
restore_continuous_stop_line=$(grep -n -m 1 \
  'Stopping the community app during restore' \
  "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
restore_source_recheck_line=$(grep -n -m 1 \
  'Rechecking the selected restore source after the safety backup' \
  "${DEPLOY_DIR}/restore.sh" | cut -d: -f1)
[[ -n "${restore_safety_retention_line}" \
  && -n "${restore_continuous_stop_line}" \
  && -n "${restore_source_recheck_line}" \
  && "${restore_continuous_stop_line}" -lt "${restore_safety_retention_line}" \
  && "${restore_safety_retention_line}" -lt "${restore_source_recheck_line}" \
  && "${restore_source_recheck_line}" -lt "${restore_drop_line}" ]] \
  || fail "restore does not remain continuously stopped across safety backup and source revalidation"
[[ "$(grep -Fc 'assert_legacy_partial_restore_safe' \
  "${DEPLOY_DIR}/restore.sh")" == "3" \
  && "$(grep -Ec '^  assert_legacy_partial_restore_safe$' \
    "${DEPLOY_DIR}/restore.sh")" == "2" ]] \
  || fail "legacy partial-restore emptiness is not rechecked after continuous quiescence"
grep -Fq 'leave_app_stopped_on_failure=1' "${DEPLOY_DIR}/restore.sh" \
  || fail "safety-backup failure can restart an app that backup left stopped for inspection"
grep -Fq 'sermon-media-restore-' "${DEPLOY_DIR}/restore.sh" \
  || fail "private recordings are not extracted into a distinct temporary volume"
grep -Fq '.restore-old-' "${DEPLOY_DIR}/restore.sh" \
  || fail "private recording replacement cannot retain a complete rollback tree during swap"
grep -Fq 'Format 2 backup is one atomic database/media set' \
  "${DEPLOY_DIR}/restore.sh" \
  || fail "format 2 partial database/media restores are not rejected"
grep -Fq 'Legacy format 1 partial restore is allowed only' \
  "${DEPLOY_DIR}/restore.sh" \
  || fail "legacy partial restore does not require an empty current managed store"
grep -Fq 'restored_database_inventory' "${DEPLOY_DIR}/restore.sh" \
  || fail "restore does not compare exact restored database rows with object inventory"
grep -Fq -- '--recording-coverage-backup "${backup_path}"' \
  "${DEPLOY_DIR}/restore.sh" \
  || fail "post-restore health can compare only against an unrelated latest safety backup"
pass "private recording restore validates a distinct volume and complete copy before live-tree swap"

tunnel_preservation_test="${DEPLOY_DIR}/tests/tunnel-preservation.sh"
bash "${tunnel_preservation_test}" >/dev/null
pass "guarded prebuilt updates fail closed while update and restore preserve Cloudflare recovery transport"

backup_restore_test="${DEPLOY_DIR}/tests/backup-restore-syncshow.sh"
if env -u HERITAGE_DISPOSABLE_CI \
  CI=true GITHUB_ACTIONS=true \
  bash "${backup_restore_test}" >/dev/null 2>&1; then
  fail "the destructive SyncShow restore regression ran without its exact disposable marker"
fi
if HERITAGE_DISPOSABLE_CI=wrong-marker \
  CI=true GITHUB_ACTIONS=true \
  bash "${backup_restore_test}" >/dev/null 2>&1; then
  fail "the destructive SyncShow restore regression accepted the wrong marker"
fi
if HERITAGE_DISPOSABLE_CI=heritage-community-syncshow-backup-restore-v1 \
  CI=false GITHUB_ACTIONS=true \
  bash "${backup_restore_test}" >/dev/null 2>&1; then
  fail "the destructive SyncShow restore regression accepted a non-CI host"
fi
grep -Fq "GITHUB_ACTIONS" "${backup_restore_test}" \
  || fail "the destructive restore regression is not restricted to GitHub Actions"
grep -Fq 'COMMUNITY_ID=ci-church' "${backup_restore_test}" \
  || fail "the destructive restore regression does not require its disposable church identity"
grep -Fq 'postgresql://heritage:ci-database-password@postgres:5432/heritage_community' \
  "${backup_restore_test}" \
  || fail "the destructive restore regression does not require a container-local CI database"
grep -Fq 'HERITAGE_POSTGRES_VOLUME' "${backup_restore_test}" \
  || fail "the destructive restore regression does not isolate PostgreSQL storage"
grep -Fq 'HERITAGE_MEDIA_VOLUME' "${backup_restore_test}" \
  || fail "the destructive restore regression does not isolate media storage"
grep -Fq 'HERITAGE_SERMON_MEDIA_VOLUME' "${backup_restore_test}" \
  || fail "the destructive restore regression does not isolate private sermon storage"
grep -Fq 'config --format json' "${backup_restore_test}" \
  || fail "the destructive restore regression does not prove resolved storage names"
grep -Fq -- '--quiesce' "${backup_restore_test}" \
  || fail "the restore regression does not exercise a quiesced backup"
grep -Fq -- '--online' "${backup_restore_test}" \
  || fail "the restore regression does not prove online backup refusal for finalized recordings"
grep -Fq 'Online backup accepted finalized private recording objects' "${backup_restore_test}" \
  || fail "the restore regression can use an online backup with finalized recordings"
grep -Fq -- '--skip-safety-backup' "${backup_restore_test}" \
  || fail "the disposable restore regression can create a redundant safety backup"
grep -Fq -- '--yes' "${backup_restore_test}" \
  || fail "the disposable restore regression does not invoke the actual confirmed restore path"
for retained_table in \
  syncshow_sermon_changes \
  syncshow_sermon_publications \
  syncshow_sermon_publication_catalogs \
  service_plans \
  service_plans_entries \
  syncshow_song_public_links \
  media; do
  grep -Fq "${retained_table}" "${backup_restore_test}" \
    || fail "the restore regression omits ${retained_table} evidence"
done
grep -Fq 'syncshow-backup-restore-sentinel.txt' "${backup_restore_test}" \
  || fail "the restore regression omits exact media bytes"
grep -Fq '/sha256/' "${backup_restore_test}" \
  || fail "the restore regression omits exact private recording object bytes"
grep -Fq 'HERITAGE_BACKUP_FORMAT=2' "${backup_restore_test}" \
  || fail "the restore regression does not require backup format 2"
grep -Fq 'legacy-format1' "${backup_restore_test}" \
  || fail "the restore regression does not exercise backward format 1 restore"
grep -Fq 'traversal' "${backup_restore_test}" \
  || fail "the restore regression does not exercise traversal rejection"
grep -Fq 'cmp -- "${expected_db}" "${after_db}"' "${backup_restore_test}" \
  || fail "the restore regression does not compare exact database evidence"
grep -Fq 'assert_fixture_rows_absent' "${backup_restore_test}" \
  || fail "the restore regression does not prove every fixture row was removed"
grep -Fq '/.well-known/heritage-community.json' "${backup_restore_test}" \
  || fail "the restore regression does not finish with an app health check"
grep -Fq 'HERITAGE_POSTGRES_VOLUME' "${SERVER_DIR}/docker-compose.production.yml" \
  || fail "production Compose cannot allocate a disposable PostgreSQL volume"
grep -Fq 'HERITAGE_MEDIA_VOLUME' "${SERVER_DIR}/docker-compose.production.yml" \
  || fail "production Compose cannot allocate a disposable media volume"
grep -Fq 'HERITAGE_SERMON_MEDIA_VOLUME' "${SERVER_DIR}/docker-compose.production.yml" \
  || fail "production Compose cannot allocate a disposable private-sermon volume"
pass "SyncShow recovery regression is fail-closed and covers database, media, and private recording restore evidence"

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -S warning "${scripts[@]}"
  pass "all operator scripts pass ShellCheck warnings"
fi

prompt_test=$(
  printf 'Typed Church\nno\n' | bash -c '
    set -u
    NON_INTERACTIVE=false
    ASSUME_YES=false
    '"$(sed -n '/^tty_read() {/,/^}/p' "${DEPLOY_DIR}/install.sh")"'
    '"$(sed -n '/^ask_value() {/,/^}/p' "${DEPLOY_DIR}/install.sh")"'
    '"$(sed -n '/^confirm() {/,/^}/p' "${DEPLOY_DIR}/install.sh")"'
    church=Default
    ask_value church Church Default
    if confirm Continue yes; then
      confirmation=yes
    else
      confirmation=no
    fi
    printf "%s|%s\n" "$church" "$confirmation"
  '
)
[[ $prompt_test == 'Typed Church|no' ]] \
  || fail "interactive prompts ignored typed values and kept their defaults"
pass "interactive prompts retain typed answers instead of silently using defaults"

interactive_retry_output="${TMP_ROOT}/interactive-retry.out"
printf '%s\n' \
  'Typed Church' \
  'typed-church' \
  'Typed description' \
  '' \
  'UTC' \
  'typed.example.org' \
  'https://heritage.faith' \
  'Typed Administrator' \
  'not-an-email' \
  'admin@example.org' \
  'short' \
  'first-long-password' \
  'different-password' \
  'second-long-password' \
  'second-long-password' \
  '3' \
  '' \
  '' \
  '' \
  '' \
  | HERITAGE_DISABLE_SLEEP=false "${DEPLOY_DIR}/install.sh" \
      --dry-run --yes --deployment-root "${TMP_ROOT}/interactive-retry" \
      >"$interactive_retry_output" 2>&1
grep -q 'That email address is not valid. Please try again.' "$interactive_retry_output" \
  || fail "interactive setup did not re-prompt after an invalid administrator email"
grep -q 'That password is too short. Please use at least 12 characters.' "$interactive_retry_output" \
  || fail "interactive setup did not re-prompt after a short administrator password"
grep -q 'Those passwords did not match. Please enter both again.' "$interactive_retry_output" \
  || fail "interactive setup did not re-prompt after mismatched administrator passwords"
grep -q 'Community:       Typed Church (typed-church)' "$interactive_retry_output" \
  || fail "interactive setup did not retain corrected answers through the final summary"
grep -q 'Dry run complete' "$interactive_retry_output" \
  || fail "interactive setup did not finish after corrected administrator credentials"
if grep -Eq 'first-long-password|second-long-password|different-password' "$interactive_retry_output"; then
  fail "interactive setup printed an administrator password"
fi
pass "interactive setup re-prompts for invalid email and password entries without quitting"

common_env=(
  HERITAGE_COMMUNITY_NAME="Test Church"
  HERITAGE_COMMUNITY_ID="test-church"
  HERITAGE_PUBLIC_HOSTNAME="community.example.org"
  HERITAGE_ADMIN_NAME="Test Administrator"
  HERITAGE_ADMIN_EMAIL="admin@example.org"
  HERITAGE_ADMIN_PASSWORD="admin-password-must-not-leak"
  HERITAGE_SMTP_HOST="smtp.example.org"
  HERITAGE_SMTP_USER="smtp-user"
  HERITAGE_SMTP_PASSWORD='smtp-$-password-must-not-leak'
  HERITAGE_DISABLE_SLEEP="false"
)

for mode in local token none; do
  output_file="${TMP_ROOT}/${mode}.out"
  env "${common_env[@]}" \
    HERITAGE_TUNNEL_MODE="$mode" \
    HERITAGE_TUNNEL_TOKEN="tunnel-token-must-not-leak" \
    "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
    --deployment-root "${TMP_ROOT}/${mode}" >"$output_file"
  grep -q "Public method:   ${mode}" "$output_file" || fail "dry-run did not select ${mode} mode"
  grep -q 'Dry run complete' "$output_file" || fail "${mode} dry-run did not finish"
  if grep -Eq 'admin-password-must-not-leak|smtp-\$-password-must-not-leak|tunnel-token-must-not-leak' "$output_file"; then
    fail "${mode} dry-run printed a secret"
  fi
done
pass "all tunnel modes complete a non-interactive dry-run without leaking secrets"

save_phase_line=$(grep -n 'saving private configuration for safe resume' "${TMP_ROOT}/local.out" | cut -d: -f1)
dependency_phase_line=$(grep -n 'installing system dependencies' "${TMP_ROOT}/local.out" | cut -d: -f1)
[[ -n $save_phase_line && -n $dependency_phase_line && $save_phase_line -lt $dependency_phase_line ]] \
  || fail "private recovery configuration was not saved before package installation"
grep -q 'chmod a+r /usr/share/keyrings/cloudflare-main.gpg' "${DEPLOY_DIR}/install.sh" \
  || fail "Cloudflare signing key is not made readable by Debian's package verifier"
grep -q 'apt-get install .* qrencode ' "${DEPLOY_DIR}/install.sh" \
  || fail "the guided installer does not install its terminal QR-code renderer"
grep -q 'qrencode -t ANSIUTF8 -m 1' "${DEPLOY_DIR}/install.sh" \
  || fail "the guided Cloudflare login does not render its one-time URL as a QR code"
grep -q 'cloudflared_login_with_qr' "${DEPLOY_DIR}/install.sh" \
  || fail "the guided Cloudflare login bypasses the QR-code wrapper"
email_test_phase_line=$(grep -n 'set_phase "testing email delivery"' "${DEPLOY_DIR}/install.sh" | cut -d: -f1)
email_ready_line=$(tail -n "+${email_test_phase_line}" "${DEPLOY_DIR}/install.sh" \
  | grep -n -m 1 'wait_for_local_server 120' | cut -d: -f1)
[[ -n $email_ready_line ]] \
  || fail "the real email test can race the app restart performed by the initial backup"
pass "retries preserve answers, Cloudflare offers a QR code, and email waits for app restart"

local_without_smtp_output="${TMP_ROOT}/local-without-smtp.out"
env \
  HERITAGE_COMMUNITY_NAME="Local Test Church" \
  HERITAGE_COMMUNITY_ID="local-test-church" \
  HERITAGE_ADMIN_NAME="Test Administrator" \
  HERITAGE_ADMIN_EMAIL="admin@example.org" \
  HERITAGE_ADMIN_PASSWORD="admin-password-must-not-leak" \
  HERITAGE_TUNNEL_MODE=none \
  HERITAGE_DISABLE_SLEEP=false \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root "${TMP_ROOT}/local-without-smtp" >"$local_without_smtp_output"
grep -q 'Member sign-in:  false' "$local_without_smtp_output" \
  || fail "local-only dry-run did not disable member sign-in without SMTP"
pass "local-only mode works without an SMTP account and clearly disables member sign-in"

copied_token_command='docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token copied-token-value'
token_command_output="${TMP_ROOT}/token-command.out"
env "${common_env[@]}" \
  HERITAGE_TUNNEL_MODE=token \
  HERITAGE_TUNNEL_TOKEN="$copied_token_command" \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root "${TMP_ROOT}/token-command" >"$token_command_output"
grep -q 'Extracted the token from the copied Cloudflare command' "$token_command_output" \
  || fail "a copied Cloudflare command was not normalized to its token"
if grep -Fq 'copied-token-value' "$token_command_output"; then
  fail "normalized Cloudflare token was printed"
fi
pass "token mode safely extracts a token from Cloudflare's copied command"

if env "${common_env[@]}" \
  HERITAGE_TUNNEL_MODE=token \
  HERITAGE_TUNNEL_TOKEN='not a token command' \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root "${TMP_ROOT}/invalid-token-command" >/dev/null 2>&1; then
  fail "token mode accepted whitespace that was not a --token command"
fi
pass "token mode rejects pasted commands that do not identify a token"

if env "${common_env[@]}" HERITAGE_COMMUNITY_ID='Bad Slug' HERITAGE_TUNNEL_MODE=none \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root "${TMP_ROOT}/invalid" >/dev/null 2>&1; then
  fail "invalid community ID was accepted"
fi
pass "invalid stable community IDs fail before host mutation"

if env "${common_env[@]}" HERITAGE_TUNNEL_MODE=none \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root 'relative/deployment' >/dev/null 2>&1; then
  fail "a relative deployment root was accepted"
fi
pass "deployment roots are validated before host mutation"

if env "${common_env[@]}" HERITAGE_TUNNEL_MODE=none \
  HERITAGE_BACKUP_DIR="$TMP_ROOT" \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root "${TMP_ROOT}/nested-deployment" >/dev/null 2>&1; then
  fail "a deployment ancestor was accepted as its backup folder"
fi
pass "backup folders cannot contain the deployment itself"

if env "${common_env[@]}" HERITAGE_TUNNEL_MODE=none \
  HERITAGE_BACKUP_DIR="${TMP_ROOT}/overlap-deployment/config/backups" \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root "${TMP_ROOT}/overlap-deployment" >/dev/null 2>&1; then
  fail "a configuration subdirectory was accepted as the backup folder"
fi
pass "backup folders cannot overlap private configuration or application paths"

if env "${common_env[@]}" HERITAGE_TUNNEL_MODE=none \
  HERITAGE_BACKUP_DIR="${TMP_ROOT}/slash-deployment//config/backups" \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root "${TMP_ROOT}/slash-deployment" >/dev/null 2>&1; then
  fail "a repeated-slash configuration path bypassed backup overlap checks"
fi
pass "backup overlap checks use canonical paths rather than path spelling"

symlink_deployment="${TMP_ROOT}/symlink-deployment"
mkdir -p "${symlink_deployment}/config"
ln -s "${symlink_deployment}/config" "${TMP_ROOT}/backup-path-link"
if env "${common_env[@]}" HERITAGE_TUNNEL_MODE=none \
  HERITAGE_BACKUP_DIR="${TMP_ROOT}/backup-path-link" \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root "$symlink_deployment" >/dev/null 2>&1; then
  fail "a backup symlink bypassed configuration overlap checks"
fi
pass "backup symlinks cannot redirect backups into private configuration"

if env "${common_env[@]}" HERITAGE_TUNNEL_MODE=none \
  HERITAGE_BACKUP_SCHEDULE='daily' \
  "${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes \
  --deployment-root "${TMP_ROOT}/invalid-schedule" >/dev/null 2>&1; then
  fail "an invalid systemd backup schedule was accepted"
fi
pass "non-interactive backup schedules are validated before systemd configuration"

reconfigure_root="${TMP_ROOT}/reconfigure"
mkdir -p "${reconfigure_root}/config" "${reconfigure_root}/state"
cat >"${reconfigure_root}/config/community.env" <<'EOF'
POSTGRES_DB=heritage_community
POSTGRES_USER=heritage
POSTGRES_PASSWORD=existing-database-secret
DATABASE_URL=postgresql://heritage:existing-database-secret@postgres:5432/heritage_community
PAYLOAD_SECRET=existing-payload-secret-at-least-thirty-two-characters
COMMUNITY_PUBLIC_URL="https://existing.example.org"
COMMUNITY_ID=existing-church
COMMUNITY_NAME="Existing Church"
COMMUNITY_DESCRIPTION="Existing description"
COMMUNITY_TIME_ZONE="UTC"
HERITAGE_APP_URL="https://heritage.faith"
HERITAGE_APP_ORIGINS="https://heritage.faith,https://localhost,capacitor://localhost,http://localhost"
SMTP_HOST="smtp.example.org"
SMTP_PORT=587
SMTP_USER="existing-user"
SMTP_PASS="existing-$$-smtp-secret"
SMTP_FROM="admin@example.org"
SMTP_FROM_NAME="Existing Church"
COMMUNITY_LOCAL_PORT=3456
BACKUP_RETENTION_DAYS=21
TUNNEL_TOKEN="existing-tunnel-token"
EOF
cat >"${reconfigure_root}/state/install.env" <<EOF
TUNNEL_MODE=token
TUNNEL_NAME=existing-church-tunnel
BACKUP_SCHEDULE="*-*-* 04:00:00"
BACKUP_DIR="${reconfigure_root}/backups"
DISABLE_SLEEP=false
EOF
: >"${reconfigure_root}/state/bootstrap-complete"
printf 'admin@example.org\n' >"${reconfigure_root}/state/admin-email"

reconfigure_output="${TMP_ROOT}/reconfigure.out"
"${DEPLOY_DIR}/install.sh" --dry-run --non-interactive --yes --reconfigure \
  --deployment-root "$reconfigure_root" >"$reconfigure_output"
grep -q 'Community:       Existing Church (existing-church)' "$reconfigure_output" \
  || fail "reconfigure did not preserve the community identity"
grep -q 'Local port:      127.0.0.1:3456' "$reconfigure_output" \
  || fail "reconfigure did not preserve the local port"
grep -q 'Public method:   token' "$reconfigure_output" \
  || fail "reconfigure did not preserve the tunnel mode"
grep -q 'Keep awake:      false' "$reconfigure_output" \
  || fail "reconfigure did not preserve the power policy"
if grep -Eq 'existing-database-secret|existing-\$-smtp-secret|existing-tunnel-token' "$reconfigure_output"; then
  fail "reconfigure dry-run printed an existing secret"
fi
pass "reconfigure preserves identity, ports, tunnel mode, and secrets"

if HERITAGE_TUNNEL_MODE=local "${DEPLOY_DIR}/install.sh" \
  --dry-run --non-interactive --yes --reconfigure \
  --deployment-root "$reconfigure_root" >/dev/null 2>&1; then
  fail "direct token-to-local tunnel conversion was accepted"
fi
pass "direct local/token conversion is blocked before DNS can be stranded"

uninstall_root="${TMP_ROOT}/uninstall-dry-run"
mkdir -p "${uninstall_root}/app" "${uninstall_root}/config" \
  "${uninstall_root}/state" "${uninstall_root}/backups"
cp -- "${SERVER_DIR}/docker-compose.production.yml" \
  "${uninstall_root}/app/docker-compose.production.yml"
cat >"${uninstall_root}/config/community.env" <<'EOF'
COMMUNITY_ID=dry-run-church
HERITAGE_POSTGRES_VOLUME=dry-run-postgres
HERITAGE_MEDIA_VOLUME=dry-run-uploaded-media
HERITAGE_SERMON_MEDIA_VOLUME=dry-run-private-sermons
EOF
ln -s ../config/community.env "${uninstall_root}/app/.env.production"
uninstall_preserve_output="${uninstall_root}/preserve.out"
HERITAGE_BACKUP_DIR="${uninstall_root}/backups" \
  "${DEPLOY_DIR}/uninstall.sh" --dry-run \
  --install-dir "${uninstall_root}/app" >"${uninstall_preserve_output}"
grep -Fq 'Would preserve all three data volumes' "${uninstall_preserve_output}" \
  || fail "uninstall dry-run does not preserve all data volumes by default"
for preserved_volume in \
  dry-run-postgres \
  dry-run-uploaded-media \
  dry-run-private-sermons; do
  grep -Fq "${preserved_volume}" "${uninstall_preserve_output}" \
    || fail "uninstall dry-run omitted preserved volume ${preserved_volume}"
done

uninstall_purge_output="${uninstall_root}/purge.out"
HERITAGE_BACKUP_DIR="${uninstall_root}/backups" \
  "${DEPLOY_DIR}/uninstall.sh" --dry-run --purge-data \
  --install-dir "${uninstall_root}/app" >"${uninstall_purge_output}"
grep -Fq 'Would require typing the exact community ID before deleting' \
  "${uninstall_purge_output}" \
  || fail "purge dry-run bypasses the typed community-ID boundary"
grep -Fq 'Private-sermon volume: dry-run-private-sermons' \
  "${uninstall_purge_output}" \
  || fail "purge dry-run omits the private sermon volume"
grep -Fq 'Backups would be preserved' "${uninstall_purge_output}" \
  || fail "purge-data dry-run does not preserve backups by default"
pass "uninstall dry-runs preserve private recordings by default and expose the explicit purge boundary"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  compose_env="${TMP_ROOT}/compose.env"
  cat >"$compose_env" <<'EOF'
POSTGRES_DB=heritage_community
POSTGRES_USER=heritage
POSTGRES_PASSWORD=test-database-password
DATABASE_URL=postgresql://heritage:test-database-password@postgres:5432/heritage_community
PAYLOAD_SECRET=test-payload-secret-at-least-thirty-two-characters
COMMUNITY_PUBLIC_URL=https://community.example.org
COMMUNITY_ID=test-church
COMMUNITY_NAME=Test Church
COMMUNITY_DESCRIPTION=Test deployment
HERITAGE_APP_URL=https://heritage.faith
HERITAGE_APP_ORIGINS=https://heritage.faith,https://localhost,capacitor://localhost,http://localhost
SMTP_HOST=smtp.example.org
SMTP_PORT=587
SMTP_USER=test
SMTP_PASS=test
SMTP_FROM=admin@example.org
SMTP_FROM_NAME=Test Church
COMMUNITY_LOCAL_PORT=3300
TUNNEL_TOKEN=test-token
HERITAGE_SERMON_MEDIA_VOLUME=test-sermon-media
EOF
  docker compose --env-file "$compose_env" --file "${SERVER_DIR}/docker-compose.production.yml" config --quiet
  docker compose --env-file "$compose_env" --file "${SERVER_DIR}/docker-compose.production.yml" \
    --profile operations --profile cloudflare-token config --quiet
  COMMUNITY_AUTH_ENABLED=false SMTP_HOST= SMTP_FROM= \
    docker compose --env-file "$compose_env" --file "${SERVER_DIR}/docker-compose.production.yml" config --quiet
  pass "production Compose validates with default and optional profiles"
fi

printf '\nInstaller/operator tests passed.\n'
