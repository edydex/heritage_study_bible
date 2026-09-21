#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/heritage-tunnel-preservation.XXXXXX")
trap 'rm -rf -- "$TMP_ROOT"' EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

fake_bin="${TMP_ROOT}/bin"
command_log="${TMP_ROOT}/commands.log"
install_dir="${TMP_ROOT}/install"
backup_root="${TMP_ROOT}/backups"
backup_dir="${backup_root}/backup-20260730T000000Z-test"
mkdir -p "$fake_bin" "$install_dir" "$backup_dir"
: >"$command_log"

cat >"${fake_bin}/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

{
  printf 'docker'
  printf ' %q' "$@"
  printf '\n'
} >>"${HERITAGE_TEST_COMMAND_LOG}"

if [[ ${1:-} == "info" ]]; then
  exit 0
fi
if [[ ${1:-} == "image" && ${2:-} == "inspect" ]]; then
  image_ref="${@: -1}"
  case "${image_ref}" in
    heritage-community:test)
      printf '%s\n' "${HERITAGE_TEST_APP_IMAGE_ID}"
      ;;
    heritage-community:migrations-test)
      count=0
      if [[ -f "${HERITAGE_TEST_MIGRATION_INSPECT_COUNT}" ]]; then
        count="$(<"${HERITAGE_TEST_MIGRATION_INSPECT_COUNT}")"
      fi
      count=$((count + 1))
      printf '%s\n' "${count}" >"${HERITAGE_TEST_MIGRATION_INSPECT_COUNT}"
      if [[ ${HERITAGE_TEST_MIGRATION_GOOD_INSPECTS:--1} -ge 0 \
        && ${count} -gt ${HERITAGE_TEST_MIGRATION_GOOD_INSPECTS} ]]; then
        printf '%s\n' "${HERITAGE_TEST_DRIFT_IMAGE_ID}"
      else
        printf '%s\n' "${HERITAGE_TEST_MIGRATION_IMAGE_ID}"
      fi
      ;;
    *)
      exit 1
      ;;
  esac
  exit 0
fi
if [[ ${1:-} == "inspect" ]]; then
  if [[ " $* " == *" {{.Image}} "* \
    && " $* " == *" community-container "* ]]; then
    printf '%s\n' "${HERITAGE_TEST_RUNNING_APP_IMAGE_ID:-${HERITAGE_TEST_APP_IMAGE_ID}}"
    exit 0
  fi
  printf 'true\n'
  exit 0
fi
if [[ ${1:-} == "volume" && ${2:-} == "inspect" ]]; then
  exit 0
fi
[[ ${1:-} == "compose" ]] || exit 0
shift

compose_file=""
while (($#)); do
  case "$1" in
    --file)
      compose_file="$2"
      shift 2
      ;;
    --project-name|--env-file|--profile)
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

operation=${1:-}
[[ $# -eq 0 ]] || shift
if [[ "${compose_file}" == *heritage-community-update-compose.* ]]; then
  jq -e \
    --arg community "${HERITAGE_TEST_APP_IMAGE_ID}" \
    --arg migration "${HERITAGE_TEST_MIGRATION_IMAGE_ID}" \
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
    ' "${compose_file}" >/dev/null || exit 97
  if [[ ${HERITAGE_TEST_ABORT_PINNED_BACKUP_CONFIG:-0} == "1" \
    && "$operation" == "config" \
    && " $* " == *" --quiet "* ]]; then
    : >"${HERITAGE_TEST_PINNED_BACKUP_SENTINEL}"
    exit 86
  fi
fi
case "$operation" in
  version|build|pull|stop|up)
    exit 0
    ;;
  config)
    if [[ " $* " == *" --format json "* ]]; then
      if [[ "${compose_file}" == *heritage-community-update-compose.* ]]; then
        printf \
          '{"services":{"community":{"image":"%s","pull_policy":"never"},"migrate":{"image":"%s","pull_policy":"never"},"sermon-media-maintenance":{"image":"%s","pull_policy":"never"}}}\n' \
          "${HERITAGE_TEST_APP_IMAGE_ID}" \
          "${HERITAGE_TEST_MIGRATION_IMAGE_ID}" \
          "${HERITAGE_TEST_MIGRATION_IMAGE_ID}"
      else
        printf '%s\n' \
          '{"services":{"community":{"image":"heritage-community:test"},"migrate":{"image":"heritage-community:migrations-test"},"sermon-media-maintenance":{"image":"heritage-community:migrations-test"}}}'
      fi
    elif [[ " $* " == *" --services "* ]]; then
      printf '%s\n' postgres community migrate cloudflared
    fi
    exit 0
    ;;
  ps)
    case " $* " in
      *" postgres "*) printf 'postgres-container\n' ;;
      *" community "*) printf 'community-container\n' ;;
      *" cloudflared "*) printf 'cloudflared-container\n' ;;
    esac
    exit 0
    ;;
  exec)
    joined=" $* "
    if [[ $joined == *" pg_isready "* ]]; then
      exit 0
    fi
    if [[ $joined == *"tablename IN ('service_documents', 'syncshow_service_document_changes')"* ]]; then
      printf '0\n'
      exit 0
    fi
    if [[ $joined == *"SELECT count(*) FROM (VALUES"* \
      && $joined == *"public.syncshow_sermon_media_objects"* \
      && $joined == *"public.syncshow_sermon_media_uploads"* \
      && $joined == *"public.syncshow_sermon_media_chunks"* ]]; then
      printf '3\n'
      exit 0
    fi
    if [[ $joined == *"COALESCE(sum(size_bytes), 0)"* \
      && $joined == *"public.syncshow_sermon_media_objects"* ]]; then
      printf '0 0\n'
      exit 0
    fi
    if [[ $joined == *"SELECT storage_key || chr(9)"* \
      && $joined == *"public.syncshow_sermon_media_objects"* ]]; then
      exit 0
    fi
    if [[ $joined == *"completed_bytes=%s"* \
      && $joined == *"used_percent=%s"* ]]; then
      printf '%s\n' \
        'completed_bytes=0' \
        'completed_files=0' \
        'staging_bytes=0' \
        'staging_files=0' \
        'staging_nonempty=0' \
        'capacity_kib=1024' \
        'free_kib=900' \
        'used_percent=12%'
      exit 0
    fi
    if [[ ${HERITAGE_TEST_RESTORE_FAIL:-0} == "1" \
      && $joined == *" exec pg_restore --username="* ]]; then
      exit 43
    fi
    exit 0
    ;;
  run)
    if [[ ${HERITAGE_TEST_PAUSE_MIGRATION:-0} == "1" \
      && " $* " == *" migrate "* ]]; then
      : >"${HERITAGE_TEST_SIGNAL_READY}"
      sleep 2
    fi
    if [[ ${HERITAGE_TEST_UPDATE_FAIL:-0} == "1" && " $* " == *" migrate "* ]]; then
      exit 42
    fi
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
EOF

cat >"${fake_bin}/git" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

{
  printf 'git'
  printf ' %q' "$@"
  printf '\n'
} >>"${HERITAGE_TEST_COMMAND_LOG}"

joined=" $* "
case "$joined" in
  *" rev-parse --is-inside-work-tree "*)
    printf 'true\n'
    ;;
  *" rev-parse HEAD "*)
    printf '%064d\n' 0
    ;;
  *" status --porcelain --untracked-files=no "*)
    ;;
  *)
    ;;
esac
EOF

cat >"${fake_bin}/systemctl" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
{
  printf 'systemctl'
  printf ' %q' "$@"
  printf '\n'
} >>"${HERITAGE_TEST_COMMAND_LOG}"
if [[ ${1:-} == "list-unit-files" ]]; then
  case " $* " in
    *" heritage-community-tunnel.service "*)
      printf 'heritage-community-tunnel.service enabled\n'
      ;;
    *" heritage-community-backup.timer "*)
      printf 'heritage-community-backup.timer enabled\n'
      ;;
  esac
fi
exit 0
EOF

cat >"${fake_bin}/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat >"${fake_bin}/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

chmod +x \
  "${fake_bin}/curl" \
  "${fake_bin}/docker" \
  "${fake_bin}/git" \
  "${fake_bin}/systemctl" \
  "${fake_bin}/flock"

cat >"${install_dir}/docker-compose.production.yml" <<'EOF'
services:
  postgres:
    image: postgres:17-alpine
  community:
    image: heritage-community:test
  migrate:
    image: heritage-community:migrations-test
  cloudflared:
    image: cloudflare/cloudflared:test
EOF

cat >"${install_dir}/.env.production" <<'EOF'
TUNNEL_TOKEN=test-token
HERITAGE_COMMUNITY_IMAGE=heritage-community:test
HERITAGE_MIGRATION_IMAGE=heritage-community:migrations-test
EOF
chmod 0600 "${install_dir}/.env.production"

printf 'test database dump\n' >"${backup_dir}/database.dump"
media_source="${TMP_ROOT}/media-source"
mkdir -p "$media_source"
printf 'test media\n' >"${media_source}/sentinel.txt"
tar -czf "${backup_dir}/media.tar.gz" -C "$media_source" .
tar -czf "${backup_dir}/recovery.tar.gz" -C "$media_source" .
printf '%s\n' \
  'HERITAGE_BACKUP_FORMAT=1' \
  'DATABASE_FILE=database.dump' \
  'MEDIA_FILE=media.tar.gz' \
  'RECOVERY_FILE=recovery.tar.gz' \
  >"${backup_dir}/manifest.env"
(
  cd "$backup_dir"
  sha256sum database.dump media.tar.gz recovery.tar.gz manifest.env >SHA256SUMS
)

app_image_id="sha256:$(printf 'a%.0s' {1..64})"
migration_image_id="sha256:$(printf 'b%.0s' {1..64})"
drift_image_id="sha256:$(printf 'c%.0s' {1..64})"
migration_inspect_count="${TMP_ROOT}/migration-image-inspects"
signal_ready="${TMP_ROOT}/signal-ready"
pinned_backup_sentinel="${TMP_ROOT}/pinned-backup-sentinel"

common_env=(
  "PATH=${fake_bin}:${PATH}"
  "TMPDIR=${TMP_ROOT}"
  "HERITAGE_TEST_COMMAND_LOG=${command_log}"
  "HERITAGE_INSTALL_DIR=${install_dir}"
  "HERITAGE_ENV_FILE=${install_dir}/.env.production"
  "HERITAGE_COMPOSE_FILE=${install_dir}/docker-compose.production.yml"
  "HERITAGE_BACKUP_DIR=${backup_root}"
  "HERITAGE_PROJECT_NAME=heritage-tunnel-test"
  "HERITAGE_TEST_APP_IMAGE_ID=${app_image_id}"
  "HERITAGE_TEST_MIGRATION_IMAGE_ID=${migration_image_id}"
  "HERITAGE_TEST_DRIFT_IMAGE_ID=${drift_image_id}"
  "HERITAGE_TEST_MIGRATION_INSPECT_COUNT=${migration_inspect_count}"
  "HERITAGE_TEST_MIGRATION_GOOD_INSPECTS=-1"
  "HERITAGE_TEST_SIGNAL_READY=${signal_ready}"
  "HERITAGE_TEST_PINNED_BACKUP_SENTINEL=${pinned_backup_sentinel}"
)

guarded_update_args=(
  --no-pull
  --skip-build
  --expected-community-image-id "${app_image_id}"
  --expected-migration-image-id "${migration_image_id}"
  --skip-backup
  --yes
  --wait 0
)

guarded_backup_args=(
  --no-pull
  --skip-build
  --expected-community-image-id "${app_image_id}"
  --expected-migration-image-id "${migration_image_id}"
  --wait 0
)

assert_no_update_mutation() {
  local label="$1"
  if grep -Eq 'docker compose .* (build|pull|stop|run|up)( |$)' "$command_log"; then
    sed -n '1,200p' "$command_log" >&2
    fail "${label} reached an update mutation command"
  fi
}

assert_no_pinned_compose_residue() {
  local label="$1"
  if find "$TMP_ROOT" -maxdepth 1 -type f \
    -name 'heritage-community-update-compose.*' -print -quit | grep -q .; then
    fail "${label} left a private temporary Compose configuration behind"
  fi
}

if ! printf '%s\n' \
  'docker compose --project-name test --file test.yml build --pull community migrate' \
  | grep -Eq 'docker compose .* (build|pull|stop|run|up)( |$)'; then
  fail "the forbidden update-mutation assertion cannot recognize a Compose build"
fi

run_invalid_guarded_update() {
  local label="$1"
  shift
  local output="${TMP_ROOT}/invalid-${label}.out"
  local status
  : >"$command_log"
  printf '0\n' >"$migration_inspect_count"
  set +e
  env "${common_env[@]}" bash "${DEPLOY_DIR}/update.sh" "$@" \
    >"$output" 2>&1
  status=$?
  set -e
  [[ $status -ne 0 ]] || fail "invalid guarded update was accepted: ${label}"
  assert_no_update_mutation "invalid guarded update ${label}"
  assert_no_pinned_compose_residue "invalid guarded update ${label}"
}

help_output="${TMP_ROOT}/update-help.out"
: >"$command_log"
env "${common_env[@]}" bash "${DEPLOY_DIR}/update.sh" --help >"$help_output"
grep -Fq -- '--skip-build' "$help_output" \
  && grep -Fq -- '--expected-community-image-id' "$help_output" \
  && grep -Fq -- '--expected-migration-image-id' "$help_output" \
  || fail "update help omits the guarded prebuilt-image contract"
[[ ! -s "$command_log" ]] || fail "update help contacted Docker"

dry_run_output="${TMP_ROOT}/update-dry-run.out"
: >"$command_log"
env "${common_env[@]}" bash "${DEPLOY_DIR}/update.sh" \
  "${guarded_update_args[@]}" --dry-run >"$dry_run_output"
grep -Fq 'Use verified prebuilt images: 1' "$dry_run_output" \
  && grep -Fq "Expected community image ID: ${app_image_id}" "$dry_run_output" \
  && grep -Fq "Expected migration image ID: ${migration_image_id}" "$dry_run_output" \
  || fail "guarded update dry-run does not disclose its exact image contract"
[[ ! -s "$command_log" ]] || fail "guarded update dry-run contacted Docker"

run_invalid_guarded_update without-no-pull \
  --skip-build \
  --expected-community-image-id "$app_image_id" \
  --expected-migration-image-id "$migration_image_id"
run_invalid_guarded_update missing-image-ids --no-pull --skip-build
run_invalid_guarded_update malformed-image-id \
  --no-pull --skip-build \
  --expected-community-image-id sha256:not-a-digest \
  --expected-migration-image-id "$migration_image_id"
run_invalid_guarded_update infrastructure-pull \
  --no-pull --skip-build --include-infrastructure \
  --expected-community-image-id "$app_image_id" \
  --expected-migration-image-id "$migration_image_id"
run_invalid_guarded_update ids-with-default-build \
  --no-pull \
  --expected-community-image-id "$app_image_id" \
  --expected-migration-image-id "$migration_image_id"

update_output="${TMP_ROOT}/update.out"
: >"$command_log"
set +e
env "${common_env[@]}" HERITAGE_TEST_UPDATE_FAIL=1 \
  bash "${DEPLOY_DIR}/update.sh" \
    --no-pull --skip-backup --yes --wait 0 \
    >"$update_output" 2>&1
update_status=$?
set -e
[[ $update_status -ne 0 ]] || fail "the mocked migration failure did not fail update"
grep -Fq 'build --pull community migrate' "$command_log" \
  || fail "the default update path no longer builds both application images"
grep -Fq 'stop --timeout 60 community' "$command_log" \
  || {
    sed -n '1,160p' "$update_output" >&2
    sed -n '1,160p' "$command_log" >&2
    fail "update failure did not keep the community app stopped"
  }
if grep -Eq 'docker .* (stop|restart) .*cloudflared|systemctl .*(stop|restart).*heritage-community-tunnel' "$command_log"; then
  fail "update failure stopped a Cloudflare recovery transport"
fi
grep -Fq 'Cloudflare connector was left running to preserve remote recovery access' "$update_output" \
  || fail "update failure did not explain that recovery transport remains available"

initial_mismatch_output="${TMP_ROOT}/guarded-initial-mismatch.out"
: >"$command_log"
printf '0\n' >"$migration_inspect_count"
set +e
env "${common_env[@]}" HERITAGE_TEST_MIGRATION_IMAGE_ID="$drift_image_id" \
  bash "${DEPLOY_DIR}/update.sh" "${guarded_update_args[@]}" \
  >"$initial_mismatch_output" 2>&1
initial_mismatch_status=$?
set -e
[[ $initial_mismatch_status -ne 0 ]] \
  || fail "guarded update accepted an initial migration-image mismatch"
grep -Fq "expected ${migration_image_id}" "$initial_mismatch_output" \
  || fail "initial image mismatch did not identify the expected migration image"
if grep -Fq 'A pre-update backup was explicitly disabled' "$initial_mismatch_output"; then
  fail "initial image mismatch was not rejected before the backup phase"
fi
assert_no_update_mutation "initial guarded image mismatch"
assert_no_pinned_compose_residue "initial guarded image mismatch"

pinned_backup_output="${TMP_ROOT}/guarded-pinned-backup.out"
: >"$command_log"
printf '0\n' >"$migration_inspect_count"
rm -f -- "$pinned_backup_sentinel"
set +e
env "${common_env[@]}" HERITAGE_TEST_ABORT_PINNED_BACKUP_CONFIG=1 \
  bash "${DEPLOY_DIR}/update.sh" "${guarded_backup_args[@]}" \
  >"$pinned_backup_output" 2>&1
pinned_backup_status=$?
set -e
[[ "$pinned_backup_status" -ne 0 ]] \
  || fail "guarded update ignored a pinned safety-backup preflight failure"
grep -Fq 'Update failed during: safety backup' "$pinned_backup_output" \
  || fail "pinned safety-backup failure did not identify its phase"
[[ -f "$pinned_backup_sentinel" ]] \
  || fail "the real safety-backup subprocess did not inherit and validate the pinned Compose file"
grep -Eq 'docker compose .* --file [^ ]*heritage-community-update-compose\.[^ ]* .* config --quiet' \
  "$command_log" \
  || fail "the real safety-backup subprocess did not use the pinned Compose file"
assert_no_update_mutation "pinned safety-backup preflight failure"
assert_no_pinned_compose_residue "pinned safety-backup preflight failure"

toctou_output="${TMP_ROOT}/guarded-toctou-mismatch.out"
: >"$command_log"
printf '0\n' >"$migration_inspect_count"
set +e
env "${common_env[@]}" HERITAGE_TEST_MIGRATION_GOOD_INSPECTS=1 \
  bash "${DEPLOY_DIR}/update.sh" "${guarded_update_args[@]}" \
  >"$toctou_output" 2>&1
toctou_status=$?
set -e
[[ $toctou_status -ne 0 ]] \
  || fail "guarded update accepted a migration tag that changed after preflight"
[[ "$(<"$migration_inspect_count")" == "2" ]] \
  || fail "guarded update did not re-inspect the migration image before quiescence"
grep -Fq 'A pre-update backup was explicitly disabled' "$toctou_output" \
  || fail "TOCTOU regression did not advance beyond initial image preflight"
assert_no_update_mutation "guarded tag drift before quiescence"
assert_no_pinned_compose_residue "guarded tag drift before quiescence"

guarded_success_output="${TMP_ROOT}/guarded-success.out"
: >"$command_log"
printf '0\n' >"$migration_inspect_count"
if ! env "${common_env[@]}" bash "${DEPLOY_DIR}/update.sh" \
  "${guarded_update_args[@]}" >"$guarded_success_output" 2>&1; then
  sed -n '1,240p' "$guarded_success_output" >&2
  sed -n '1,240p' "$command_log" >&2
  fail "the exact-image guarded update did not complete"
fi
if grep -Eq 'docker compose .* (build|pull)( |$)' "$command_log"; then
  fail "successful guarded update invoked a Compose build or pull operation"
fi
grep -Fq 'up -d --no-build --pull never postgres' "$command_log" \
  || fail "guarded update can pull or build PostgreSQL during readiness"
grep -Fq 'stop --timeout 60 community' "$command_log" \
  || fail "guarded update did not quiesce the community app"
grep -Fq 'run --rm -T --pull never migrate' "$command_log" \
  || fail "guarded update migration can pull a replacement image"
grep -Fq 'up -d --no-build --pull never postgres community' "$command_log" \
  || fail "guarded update deployment can pull or build a replacement image"
grep -Eq 'docker compose .* --file [^ ]*heritage-community-update-compose\.[^ ]* .* run --rm -T --pull never migrate' \
  "$command_log" \
  || {
    sed -n '1,240p' "$command_log" >&2
    fail "guarded migration did not execute through the immutable Compose configuration"
  }
grep -Eq 'docker compose .* --file [^ ]*heritage-community-update-compose\.[^ ]* .* up -d --no-build --pull never postgres community' \
  "$command_log" \
  || fail "guarded deployment did not execute through the immutable Compose configuration"
grep -Fq 'inspect --format \{\{.Image\}\} community-container' "$command_log" \
  || fail "guarded update did not verify the running container image"
[[ "$(grep -Fc 'image inspect' "$command_log")" -ge 8 ]] \
  || fail "guarded update did not repeatedly verify both configured image tags"
stop_line="$(grep -n -m 1 'stop --timeout 60 community' "$command_log" | cut -d: -f1)"
migrate_line="$(grep -n -m 1 'run --rm -T --pull never migrate' "$command_log" | cut -d: -f1)"
deploy_line="$(grep -n -m 1 'up -d --no-build --pull never postgres community' "$command_log" | cut -d: -f1)"
[[ -n "$stop_line" && -n "$migrate_line" && -n "$deploy_line" \
  && "$stop_line" -lt "$migrate_line" && "$migrate_line" -lt "$deploy_line" ]] \
  || fail "guarded update did not preserve stop, migrate, then deploy ordering"
if grep -Eq 'docker .* (stop|restart) .*cloudflared|systemctl .*(stop|restart).*heritage-community-tunnel' "$command_log"; then
  fail "successful guarded update stopped a Cloudflare recovery transport"
fi
assert_no_pinned_compose_residue "successful guarded update"

running_mismatch_output="${TMP_ROOT}/guarded-running-mismatch.out"
: >"$command_log"
printf '0\n' >"$migration_inspect_count"
set +e
env "${common_env[@]}" HERITAGE_TEST_RUNNING_APP_IMAGE_ID="$drift_image_id" \
  bash "${DEPLOY_DIR}/update.sh" "${guarded_update_args[@]}" \
  >"$running_mismatch_output" 2>&1
running_mismatch_status=$?
set -e
[[ $running_mismatch_status -ne 0 ]] \
  || fail "guarded update accepted an unexpected running community image"
grep -Fq 'up -d --no-build --pull never postgres community' "$command_log" \
  || fail "running-image mismatch test did not reach service deployment"
[[ "$(grep -Fc 'stop --timeout 60 community' "$command_log")" -ge 2 ]] \
  || fail "running-image mismatch did not leave the community app stopped"
grep -Fq 'Cloudflare connector was left running to preserve remote recovery access' "$running_mismatch_output" \
  || fail "running-image mismatch did not preserve and explain recovery access"
if grep -Eq 'docker .* (stop|restart) .*cloudflared|systemctl .*(stop|restart).*heritage-community-tunnel' "$command_log"; then
  fail "running-image mismatch stopped a Cloudflare recovery transport"
fi
assert_no_pinned_compose_residue "running-image mismatch"

signal_output="${TMP_ROOT}/guarded-signal.out"
: >"$command_log"
printf '0\n' >"$migration_inspect_count"
rm -f -- "$signal_ready"
env "${common_env[@]}" HERITAGE_TEST_PAUSE_MIGRATION=1 \
  bash "${DEPLOY_DIR}/update.sh" "${guarded_update_args[@]}" \
  >"$signal_output" 2>&1 &
signal_pid=$!
for _ in {1..100}; do
  [[ -f "$signal_ready" ]] && break
  sleep 0.05
done
if [[ ! -f "$signal_ready" ]]; then
  kill -TERM "$signal_pid" >/dev/null 2>&1 || true
  wait "$signal_pid" >/dev/null 2>&1 || true
  fail "signal regression did not reach database migration"
fi
kill -TERM "$signal_pid" \
  || fail "could not interrupt the guarded update during migration"
set +e
wait "$signal_pid"
signal_status=$?
set -e
[[ "$signal_status" == "143" ]] \
  || fail "TERM during guarded migration returned ${signal_status}, expected 143"
grep -Fq 'Update interrupted by TERM during: database migration' "$signal_output" \
  || fail "guarded update did not report its interrupted phase"
[[ "$(grep -Fc 'stop --timeout 60 community' "$command_log")" -ge 2 ]] \
  || fail "TERM after quiescence did not leave the community app stopped"
grep -Fq 'Cloudflare connector was left running to preserve remote recovery access' "$signal_output" \
  || fail "TERM after quiescence did not preserve and explain recovery access"
if grep -Eq 'docker .* (stop|restart) .*cloudflared|systemctl .*(stop|restart).*heritage-community-tunnel' "$command_log"; then
  fail "TERM during guarded migration stopped a Cloudflare recovery transport"
fi
assert_no_pinned_compose_residue "TERM during guarded migration"

restore_output="${TMP_ROOT}/restore-failure.out"
: >"$command_log"
set +e
env "${common_env[@]}" HERITAGE_TEST_RESTORE_FAIL=1 \
  bash "${DEPLOY_DIR}/restore.sh" \
    --database-only --skip-safety-backup --yes "$backup_dir" \
    >"$restore_output" 2>&1
restore_status=$?
set -e
[[ $restore_status -ne 0 ]] || fail "the mocked destructive restore failure did not fail"
[[ $(grep -Fc 'stop --timeout 60 community' "$command_log") -ge 2 ]] \
  || fail "destructive restore failure did not leave the community app stopped"
if grep -Eq 'docker .* (stop|restart) .*cloudflared|systemctl .*(stop|restart).*heritage-community-tunnel' "$command_log"; then
  fail "destructive restore failure stopped a Cloudflare recovery transport"
fi
grep -Fq 'Cloudflare connector was left running to preserve remote recovery access' "$restore_output" \
  || fail "restore failure did not explain that recovery transport remains available"

no_start_output="${TMP_ROOT}/restore-no-start.out"
: >"$command_log"
env "${common_env[@]}" \
  bash "${DEPLOY_DIR}/restore.sh" \
    --database-only --skip-safety-backup --yes --no-start "$backup_dir" \
    >"$no_start_output" 2>&1
grep -Fq 'stop --timeout 60 community' "$command_log" \
  || fail "--no-start restore did not quiesce the community app"
if grep -Eq 'docker .* (stop|restart) .*cloudflared|systemctl .*(stop|restart).*heritage-community-tunnel' "$command_log"; then
  fail "--no-start restore stopped a Cloudflare recovery transport"
fi
grep -Fq 'Cloudflare connector remains running for recovery access' "$no_start_output" \
  || fail "--no-start restore did not explain its transport-preserving behavior"

for script in "${DEPLOY_DIR}/update.sh" "${DEPLOY_DIR}/restore.sh"; do
  if grep -Eq \
    'heritage_compose stop[^[:cntrl:]]*cloudflared|systemctl stop heritage-community-tunnel|manage_host_tunnel stop' \
    "$script"; then
    fail "$(basename -- "$script") contains a tunnel-stop path"
  fi
  grep -Fq 'heritage_compose up -d postgres community' "$script" \
    || fail "$(basename -- "$script") can reconcile a running tunnel during app deployment"
  if grep -Eq 'heritage_compose up[^[:cntrl:]]*--remove-orphans' "$script"; then
    fail "$(basename -- "$script") can remove a recovery connector as an orphan"
  fi
done

printf 'Tunnel-preservation update/restore regression passed.\n'
