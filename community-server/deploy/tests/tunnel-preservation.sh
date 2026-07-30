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
if [[ ${1:-} == "inspect" ]]; then
  printf 'true\n'
  exit 0
fi
[[ ${1:-} == "compose" ]] || exit 0
shift

while (($#)); do
  case "$1" in
    --project-name|--env-file|--file|--profile)
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

operation=${1:-}
[[ $# -eq 0 ]] || shift
case "$operation" in
  version|build|pull|stop|up)
    exit 0
    ;;
  config)
    if [[ " $* " == *" --services "* ]]; then
      printf '%s\n' postgres community migrate cloudflared
    fi
    exit 0
    ;;
  ps)
    case " $* " in
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
    if [[ ${HERITAGE_TEST_RESTORE_FAIL:-0} == "1" \
      && $joined == *" exec pg_restore --username="* ]]; then
      exit 43
    fi
    exit 0
    ;;
  run)
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
exit 0
EOF

cat >"${fake_bin}/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

chmod +x \
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
EOF

printf 'test database dump\n' >"${backup_dir}/database.dump"
media_source="${TMP_ROOT}/media-source"
mkdir -p "$media_source"
printf 'test media\n' >"${media_source}/sentinel.txt"
tar -czf "${backup_dir}/media.tar.gz" -C "$media_source" .
printf '%s\n' \
  'HERITAGE_BACKUP_FORMAT=1' \
  'DATABASE_FILE=database.dump' \
  'MEDIA_FILE=media.tar.gz' \
  >"${backup_dir}/manifest.env"
(
  cd "$backup_dir"
  sha256sum database.dump media.tar.gz manifest.env >SHA256SUMS
)

common_env=(
  "PATH=${fake_bin}:${PATH}"
  "HERITAGE_TEST_COMMAND_LOG=${command_log}"
  "HERITAGE_INSTALL_DIR=${install_dir}"
  "HERITAGE_ENV_FILE=${install_dir}/.env.production"
  "HERITAGE_COMPOSE_FILE=${install_dir}/docker-compose.production.yml"
  "HERITAGE_BACKUP_DIR=${backup_root}"
  "HERITAGE_PROJECT_NAME=heritage-tunnel-test"
)

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
grep -Fq 'stop --timeout 60 community' "$command_log" \
  || {
    sed -n '1,160p' "$update_output" >&2
    sed -n '1,160p' "$command_log" >&2
    fail "update failure did not keep the community app stopped"
  }
if grep -Eq 'docker .* (stop|restart) .*cloudflared|systemctl .*heritage-community-tunnel' "$command_log"; then
  fail "update failure stopped a Cloudflare recovery transport"
fi
grep -Fq 'Cloudflare connector was left running to preserve remote recovery access' "$update_output" \
  || fail "update failure did not explain that recovery transport remains available"

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
if grep -Eq 'docker .* (stop|restart) .*cloudflared|systemctl .*heritage-community-tunnel' "$command_log"; then
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
if grep -Eq 'docker .* (stop|restart) .*cloudflared|systemctl .*heritage-community-tunnel' "$command_log"; then
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
