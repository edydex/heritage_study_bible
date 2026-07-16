#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SERVER_DIR="$(cd -- "${DEPLOY_DIR}/.." && pwd -P)"
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/heritage-installer-tests.XXXXXX")
trap 'rm -rf -- "$TMP_ROOT"' EXIT

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'ok - %s\n' "$*"; }

scripts=("${DEPLOY_DIR}"/*.sh "${DEPLOY_DIR}/heritage-community" "${DEPLOY_DIR}/lib"/*.sh)
for script in "${scripts[@]}"; do
  bash -n "$script"
done
pass "all operator scripts pass bash syntax checking"

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -S warning "${scripts[@]}"
  pass "all operator scripts pass ShellCheck warnings"
fi

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
EOF
  docker compose --env-file "$compose_env" --file "${SERVER_DIR}/docker-compose.production.yml" config --quiet
  docker compose --env-file "$compose_env" --file "${SERVER_DIR}/docker-compose.production.yml" \
    --profile operations --profile cloudflare-token config --quiet
  COMMUNITY_AUTH_ENABLED=false SMTP_HOST= SMTP_FROM= \
    docker compose --env-file "$compose_env" --file "${SERVER_DIR}/docker-compose.production.yml" config --quiet
  pass "production Compose validates with default and optional profiles"
fi

printf '\nInstaller/operator tests passed.\n'
