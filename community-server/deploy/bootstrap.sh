#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY_URL="${HERITAGE_REPOSITORY_URL:-https://github.com/edydex/heritage_study_bible.git}"
REPOSITORY_REF="${HERITAGE_REPOSITORY_REF:-main}"
DEPLOYMENT_ROOT="${HERITAGE_DEPLOYMENT_ROOT:-/opt/heritage-community}"
REPOSITORY_DIR="${DEPLOYMENT_ROOT}/app"
PRESERVED_ENV_NAMES='HERITAGE_REPOSITORY_URL,HERITAGE_REPOSITORY_REF,HERITAGE_DEPLOYMENT_ROOT,HERITAGE_BACKUP_DIR,HERITAGE_COMMUNITY_NAME,HERITAGE_COMMUNITY_ID,HERITAGE_COMMUNITY_DESCRIPTION,HERITAGE_CCLI_LICENSE_NUMBER,HERITAGE_COMMUNITY_TIME_ZONE,HERITAGE_PUBLIC_HOSTNAME,HERITAGE_APP_URL,HERITAGE_APP_ORIGINS,HERITAGE_ADMIN_NAME,HERITAGE_ADMIN_EMAIL,HERITAGE_ADMIN_PASSWORD,HERITAGE_COMMUNITY_AUTH_ENABLED,HERITAGE_SMTP_HOST,HERITAGE_SMTP_PORT,HERITAGE_SMTP_USER,HERITAGE_SMTP_PASSWORD,HERITAGE_SMTP_FROM,HERITAGE_SMTP_FROM_NAME,HERITAGE_TUNNEL_MODE,HERITAGE_TUNNEL_NAME,HERITAGE_TUNNEL_TOKEN,HERITAGE_LOCAL_PORT,HERITAGE_BACKUP_RETENTION_DAYS,HERITAGE_BACKUP_SCHEDULE,HERITAGE_DISABLE_SLEEP,HERITAGE_TEST_EMAIL'

say() { printf '\n%s\n' "$*"; }
fail() { printf '\nError: %s\n' "$*" >&2; exit 1; }

[[ $DEPLOYMENT_ROOT == /* && $DEPLOYMENT_ROOT != / ]] \
  || fail "HERITAGE_DEPLOYMENT_ROOT must be an absolute path other than /."
[[ $DEPLOYMENT_ROOT =~ ^/[A-Za-z0-9._/-]+$ ]] \
  || fail "HERITAGE_DEPLOYMENT_ROOT contains unsupported path characters."

if [[ ${1:-} == -h || ${1:-} == --help ]]; then
  cat <<'EOF'
Bootstrap the Heritage Community guided installer on fresh Debian.

Environment overrides:
  HERITAGE_DEPLOYMENT_ROOT  default /opt/heritage-community
  HERITAGE_REPOSITORY_URL   default official GitHub repository
  HERITAGE_REPOSITORY_REF   default main

All other arguments are passed to the full install.sh wizard after cloning.
EOF
  exit 0
fi

if [[ ${EUID} -ne 0 ]]; then
  command -v sudo >/dev/null 2>&1 || fail "sudo is required. Sign in as root or install sudo first."
  export HERITAGE_REPOSITORY_URL="$REPOSITORY_URL"
  export HERITAGE_REPOSITORY_REF="$REPOSITORY_REF"
  export HERITAGE_DEPLOYMENT_ROOT="$DEPLOYMENT_ROOT"
  exec sudo --preserve-env="$PRESERVED_ENV_NAMES" bash "$0" "$@"
fi

[[ -r /etc/os-release ]] || fail "This installer requires Debian Linux."
# shellcheck disable=SC1091
source /etc/os-release
[[ ${ID:-} == debian ]] || fail "This installer supports Debian 12 and 13; detected ${PRETTY_NAME:-an unknown system}."
DEPLOYMENT_ROOT=$(realpath -m -- "$DEPLOYMENT_ROOT")
REPOSITORY_DIR="${DEPLOYMENT_ROOT}/app"

say "Heritage Community Server — bootstrap"
printf '%s\n' \
  "This small first step installs Git and downloads the auditable installer." \
  "Application files: ${REPOSITORY_DIR}" \
  "Git source:        ${REPOSITORY_URL} (${REPOSITORY_REF})"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git

install -d -m 0755 "$DEPLOYMENT_ROOT"
if [[ -d "${REPOSITORY_DIR}/.git" ]]; then
  say "An existing Heritage checkout was found; it will be reused without overwriting local changes."
elif [[ -e "$REPOSITORY_DIR" ]]; then
  fail "${REPOSITORY_DIR} exists but is not a Git checkout. Move it aside and run this command again."
else
  git clone --filter=blob:none --branch "$REPOSITORY_REF" "$REPOSITORY_URL" "$REPOSITORY_DIR"
fi

INSTALLER="${REPOSITORY_DIR}/community-server/deploy/install.sh"
[[ -f "$INSTALLER" ]] || fail "The selected repository revision does not contain ${INSTALLER}."

exec bash "$INSTALLER" --deployment-root "$DEPLOYMENT_ROOT" "$@"
