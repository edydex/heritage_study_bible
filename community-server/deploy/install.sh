#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

INSTALLER_VERSION="1.0.0"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SOURCE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

DEPLOYMENT_ROOT="${HERITAGE_DEPLOYMENT_ROOT:-/opt/heritage-community}"
CONFIG_DIR=""
STATE_DIR=""
BACKUP_DIR=""
ENV_FILE=""
STATE_FILE=""
COMPOSE_FILE="${SOURCE_DIR}/docker-compose.production.yml"
PHASE="starting"
DRY_RUN=false
NON_INTERACTIVE=false
ASSUME_YES=false
RECONFIGURE=false
REUSE_CONFIG=false
SECRET_TEMP_FILES=()
PREVIOUS_TUNNEL_MODE=''
PUBLIC_READY=true
REMOVE_ORIGIN_CERT_ON_EXIT=false

ORIGINAL_ARGS=("$@")
PRESERVED_ENV_NAMES='HERITAGE_DEPLOYMENT_ROOT,HERITAGE_BACKUP_DIR,HERITAGE_COMMUNITY_NAME,HERITAGE_COMMUNITY_ID,HERITAGE_COMMUNITY_DESCRIPTION,HERITAGE_COMMUNITY_TIME_ZONE,HERITAGE_PUBLIC_HOSTNAME,HERITAGE_APP_URL,HERITAGE_APP_ORIGINS,HERITAGE_ADMIN_NAME,HERITAGE_ADMIN_EMAIL,HERITAGE_ADMIN_PASSWORD,HERITAGE_COMMUNITY_AUTH_ENABLED,HERITAGE_SMTP_HOST,HERITAGE_SMTP_PORT,HERITAGE_SMTP_USER,HERITAGE_SMTP_PASSWORD,HERITAGE_SMTP_FROM,HERITAGE_SMTP_FROM_NAME,HERITAGE_TUNNEL_MODE,HERITAGE_TUNNEL_NAME,HERITAGE_TUNNEL_TOKEN,HERITAGE_LOCAL_PORT,HERITAGE_BACKUP_RETENTION_DAYS,HERITAGE_BACKUP_SCHEDULE,HERITAGE_DISABLE_SLEEP,HERITAGE_TEST_EMAIL'

usage() {
  cat <<'EOF'
Heritage Community Server guided installer

Usage: sudo bash install.sh [options]

Options:
  --deployment-root PATH  Deployment root (default: /opt/heritage-community)
  --reconfigure           Ask the setup questions again; preserve core secrets
  --non-interactive       Read answers from HERITAGE_* environment variables
  --yes                   Accept the final non-secret summary
  --dry-run               Show host changes without making them
  -h, --help              Show this help

Useful non-interactive variables:
  HERITAGE_COMMUNITY_NAME, HERITAGE_COMMUNITY_ID,
  HERITAGE_COMMUNITY_DESCRIPTION, HERITAGE_COMMUNITY_TIME_ZONE,
  HERITAGE_PUBLIC_HOSTNAME, HERITAGE_APP_URL, HERITAGE_APP_ORIGINS,
  HERITAGE_ADMIN_NAME, HERITAGE_ADMIN_EMAIL, HERITAGE_ADMIN_PASSWORD,
  HERITAGE_COMMUNITY_AUTH_ENABLED (true or false), HERITAGE_SMTP_HOST,
  HERITAGE_SMTP_PORT, HERITAGE_SMTP_USER,
  HERITAGE_SMTP_PASSWORD, HERITAGE_SMTP_FROM, HERITAGE_SMTP_FROM_NAME,
  HERITAGE_TUNNEL_MODE (local, token, or none), HERITAGE_TUNNEL_TOKEN,
  HERITAGE_LOCAL_PORT, HERITAGE_BACKUP_RETENTION_DAYS,
  HERITAGE_BACKUP_SCHEDULE, HERITAGE_DISABLE_SLEEP (true or false).
EOF
}

while (($#)); do
  case "$1" in
    --deployment-root)
      [[ $# -ge 2 ]] || { printf 'Missing value for --deployment-root\n' >&2; exit 2; }
      DEPLOYMENT_ROOT="$2"
      shift 2
      ;;
    --reconfigure) RECONFIGURE=true; shift ;;
    --non-interactive) NON_INTERACTIVE=true; shift ;;
    --yes) ASSUME_YES=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

canonicalize_missing_path() {
  local input=$1 current suffix='' component resolved
  while [[ $input == *//* ]]; do
    input=${input//\/\//\/}
  done

  if realpath -m -- "$input" >/dev/null 2>&1; then
    realpath -m -- "$input"
    return
  fi

  current=$input
  while [[ ! -e $current && ! -L $current ]]; do
    component=${current##*/}
    suffix="/${component}${suffix}"
    current=${current%/*}
    [[ -n $current ]] || current=/
  done
  if [[ -d $current ]]; then
    resolved=$(cd -- "$current" && pwd -P)
  else
    resolved=$(realpath "$current" 2>/dev/null || printf '%s' "$current")
  fi
  if [[ $resolved == / ]]; then
    printf '/%s\n' "${suffix#/}"
  else
    printf '%s%s\n' "${resolved%/}" "$suffix"
  fi
}

[[ $DEPLOYMENT_ROOT == /* ]] || { printf 'Deployment root must be an absolute path.\n' >&2; exit 1; }
if [[ -n ${HERITAGE_BACKUP_DIR:-} && $HERITAGE_BACKUP_DIR != /* ]]; then
  printf 'Backup folder must be an absolute path.\n' >&2
  exit 1
fi
DEPLOYMENT_ROOT=$(canonicalize_missing_path "$DEPLOYMENT_ROOT")
BACKUP_DIR=$(canonicalize_missing_path "${HERITAGE_BACKUP_DIR:-${DEPLOYMENT_ROOT}/backups}")
CONFIG_DIR=$(canonicalize_missing_path "${DEPLOYMENT_ROOT}/config")
STATE_DIR=$(canonicalize_missing_path "${DEPLOYMENT_ROOT}/state")
if [[ $CONFIG_DIR != "${DEPLOYMENT_ROOT}/config" || $STATE_DIR != "${DEPLOYMENT_ROOT}/state" ]]; then
  printf 'Configuration and state directories must not be symlinks.\n' >&2
  exit 1
fi
ENV_FILE="${CONFIG_DIR}/community.env"
STATE_FILE="${STATE_DIR}/install.env"

say() { printf '\n%s\n' "$*"; }
note() { printf '  %s\n' "$*"; }
warn() { printf '\nWarning: %s\n' "$*" >&2; }
fail() { printf '\nError during %s: %s\n' "$PHASE" "$*" >&2; exit 1; }

cloudflared_login_with_qr() {
  local login_log login_pid login_url='' attempt
  login_log=$(mktemp "${STATE_DIR}/cloudflare-login.XXXXXX")
  SECRET_TEMP_FILES+=("$login_log")

  HOME=/root cloudflared tunnel login \
    > >(tee -a "$login_log") \
    2> >(tee -a "$login_log" >&2) &
  login_pid=$!

  for attempt in {1..100}; do
    login_url=$(grep -Eo 'https://dash\.cloudflare\.com/argotunnel[^[:space:]]+' "$login_log" | tail -n 1 || true)
    if [[ -n $login_url ]]; then
      say "Scan this QR code with a phone camera instead of typing the address:"
      if ! qrencode -t ANSIUTF8 -m 1 "$login_url"; then
        warn "The QR code could not be drawn. Use the printed Cloudflare address above."
      fi
      note "The printed address remains available if scanning is not convenient."
      break
    fi
    kill -0 "$login_pid" 2>/dev/null || break
    sleep 0.1
  done

  wait "$login_pid"
}

on_error() {
  local code=$?
  printf '\nInstallation stopped during: %s\n' "$PHASE" >&2
  printf 'Nothing is automatically deleted. Fix the message above and rerun the same command.\n' >&2
  exit "$code"
}
trap on_error ERR

cleanup_secret_files() {
  ((${#SECRET_TEMP_FILES[@]} == 0)) || rm -f -- "${SECRET_TEMP_FILES[@]}"
  if $REMOVE_ORIGIN_CERT_ON_EXIT; then
    rm -f /root/.cloudflared/cert.pem
  fi
}
trap cleanup_secret_files EXIT

tty_read() {
  local __name=$1 prompt=$2
  if [[ -t 0 && -r /dev/tty ]]; then
    IFS= read -r -p "$prompt" "$__name" </dev/tty
  else
    IFS= read -r -p "$prompt" "$__name"
  fi
}

ask_value() {
  local __name=$1 label=$2 default_value=${3-} value=''
  if $NON_INTERACTIVE; then
    value="${!__name:-$default_value}"
  else
    local suffix=''
    [[ -n $default_value ]] && suffix=" [${default_value}]"
    tty_read value "${label}${suffix}: "
    value="${value:-$default_value}"
  fi
  printf -v "$__name" '%s' "$value"
}

ask_secret() {
  local __name label value entered prompt
  __name=$1
  label=$2
  value="${!__name:-}"
  if ! $NON_INTERACTIVE; then
    prompt="${label}: "
    [[ -z $value ]] || prompt="${label} (press Enter to keep the current value): "
    if [[ -t 0 && -r /dev/tty ]]; then
      IFS= read -r -s -p "$prompt" entered </dev/tty
      printf '\n' >/dev/tty
    else
      IFS= read -r -s -p "$prompt" entered
      printf '\n'
    fi
    [[ -z $entered && -n $value ]] || value=$entered
  fi
  printf -v "$__name" '%s' "$value"
}

confirm() {
  local label=$1 default=${2:-yes} answer=''
  if $NON_INTERACTIVE || $ASSUME_YES; then
    [[ $default == yes ]]
    return
  fi
  local suffix='[Y/n]'
  [[ $default == no ]] && suffix='[y/N]'
  tty_read answer "${label} ${suffix} "
  answer=${answer:-$default}
  [[ $answer =~ ^[Yy]([Ee][Ss])?$ ]]
}

require_no_newlines() {
  local name=$1 value=$2
  [[ $value != *$'\n'* && $value != *$'\r'* ]] || fail "${name} cannot contain a newline."
}

validate_slug() {
  [[ $1 =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]
}

validate_hostname() {
  [[ $1 =~ ^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]]
}

validate_url() {
  [[ $1 =~ ^https?://[^[:space:]]+$ ]]
}

validate_email() {
  [[ $1 =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]
}

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed -E 's/^-+|-+$//g'
}

env_value() {
  local key=$1 file=${2:-$ENV_FILE} line value
  [[ -f $file ]] || return 1
  line=$(grep -m 1 -E "^${key}=" "$file" || true)
  [[ -n $line ]] || return 1
  value=${line#*=}
  if [[ $value == \"*\" && $value == *\" ]]; then
    value=${value:1:${#value}-2}
    value=${value//\$\$/\$}
    value=${value//\\\"/\"}
    value=${value//\\\\/\\}
  elif [[ $value == \'*\' && $value == *\' ]]; then
    value=${value:1:${#value}-2}
    value=${value//\\\'/\'}
  fi
  printf '%s' "$value"
}

dotenv_quote() {
  local value=$1
  require_no_newlines "configuration value" "$value"
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//\$/\$\$}
  printf '"%s"' "$value"
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

set_phase() {
  PHASE=$1
  say "==> ${PHASE}"
  if ! $DRY_RUN && [[ -d $STATE_DIR ]]; then
    printf '%s\n' "$PHASE" >"${STATE_DIR}/last-phase"
  fi
}

validate_system_path() {
  local label=$1 value=$2
  [[ $value == /* && $value != / ]] || fail "${label} must be an absolute path other than /."
  [[ $value =~ ^/[A-Za-z0-9._/-]+$ ]] \
    || fail "${label} may contain only letters, numbers, slash, dot, underscore, and hyphen."
  [[ $value != *'/../'* && $value != */.. && $value != *'/./'* && $value != */. ]] \
    || fail "${label} must not contain . or .. path segments."
}

validate_backup_location() {
  validate_system_path "Backup folder" "$BACKUP_DIR"
  if [[ $DEPLOYMENT_ROOT == "$BACKUP_DIR" || $DEPLOYMENT_ROOT == "$BACKUP_DIR/"* ]]; then
    fail "Backup folder must not be the deployment root or one of its parent directories."
  fi
  local protected_path
  for protected_path in "$CONFIG_DIR" "$STATE_DIR" "$SOURCE_DIR"; do
    if [[ $BACKUP_DIR == "$protected_path" || $BACKUP_DIR == "$protected_path/"* \
      || $protected_path == "$BACKUP_DIR/"* ]]; then
      fail "Backup folder must not overlap configuration, state, or application source directories."
    fi
  done
}

validate_system_path "Deployment root" "$DEPLOYMENT_ROOT"
validate_system_path "Source directory" "$SOURCE_DIR"
validate_backup_location

if [[ ${EUID} -ne 0 ]] && ! $DRY_RUN; then
  command -v sudo >/dev/null 2>&1 || fail "Run this installer as root, or install sudo."
  exec sudo --preserve-env="$PRESERVED_ENV_NAMES" bash "$0" "${ORIGINAL_ARGS[@]}"
fi

if ! $DRY_RUN; then
  install -d -m 0700 "$CONFIG_DIR" "$STATE_DIR"
  exec 9>"${STATE_DIR}/installer.lock"
  command -v flock >/dev/null 2>&1 || fail "The util-linux flock command is required."
  flock -n 9 || fail "Another Heritage installer or update is already running."
fi

set_phase "checking the Debian host"
if ! $DRY_RUN; then
  [[ -r /etc/os-release ]] || fail "Cannot identify this operating system."
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ ${ID:-} == debian ]] || fail "Debian 12 or 13 is required; detected ${PRETTY_NAME:-unknown}."
  [[ ${VERSION_ID:-} == 12 || ${VERSION_ID:-} == 13 ]] || fail "Debian 12 or 13 is required; detected ${PRETTY_NAME:-unknown}."
  [[ -d /run/systemd/system ]] || fail "systemd must be running (containers and scheduled backups depend on it)."
  case "$(dpkg --print-architecture)" in
    amd64|arm64) ;;
    *) fail "Only Debian amd64 and arm64 hosts are supported." ;;
  esac

  available_kb=$(df -Pk "$(dirname "$DEPLOYMENT_ROOT")" 2>/dev/null | awk 'NR==2 {print $4}' || true)
  [[ -n ${available_kb:-} ]] || available_kb=$(df -Pk / | awk 'NR==2 {print $4}')
  if ((available_kb < 10485760)); then
    warn "Less than 10 GB is free. Container builds, uploads, and the first backup can fill this machine."
    confirm "Continue anyway?" no || exit 1
  fi
  total_memory_kb=$(awk '/^(MemTotal|SwapTotal):/ { total += $2 } END { print total + 0 }' /proc/meminfo)
  if ((total_memory_kb < 3145728)); then
    warn "Less than 3 GB of RAM plus swap is available. The Payload/Next container build can be killed by the kernel."
    confirm "Continue anyway?" no || exit 1
  fi
fi

say "Heritage Community Server — guided Debian setup"
cat <<'EOF'
This wizard installs Docker, PostgreSQL, the Heritage server, automatic
backups, and (optionally) a Cloudflare Tunnel. It never opens PostgreSQL or
the web application to the LAN/Internet directly.

Have these ready:
  • a domain managed by Cloudflare (for the guided public setup)
  • SMTP credentials from an email provider (for public/member sign-in links;
    optional in local-only mode)
EOF

if [[ -f $ENV_FILE ]] && ! $RECONFIGURE; then
  if confirm "Existing configuration found. Reuse it and safely repair/update the installation?" yes; then
    REUSE_CONFIG=true
  else
    RECONFIGURE=true
  fi
fi

PREVIOUS_TUNNEL_MODE=$(env_value TUNNEL_MODE "$STATE_FILE" 2>/dev/null || true)

COMMUNITY_NAME=''
COMMUNITY_ID=''
COMMUNITY_DESCRIPTION=''
COMMUNITY_TIME_ZONE='UTC'
PUBLIC_HOSTNAME=''
COMMUNITY_PUBLIC_URL=''
APP_URL=''
APP_ORIGINS=''
ADMIN_NAME=''
ADMIN_EMAIL=''
ADMIN_PASSWORD=''
SMTP_HOST=''
SMTP_PORT='587'
SMTP_USER=''
SMTP_PASSWORD=''
SMTP_FROM=''
SMTP_FROM_NAME=''
AUTH_ENABLED='true'
TUNNEL_MODE='local'
TUNNEL_TOKEN=''
TUNNEL_NAME='heritage-community'
LOCAL_PORT='3000'
BACKUP_RETENTION_DAYS='30'
BACKUP_SCHEDULE='*-*-* 02:30:00'
DISABLE_SLEEP='true'

if $REUSE_CONFIG; then
  COMMUNITY_NAME=$(env_value COMMUNITY_NAME)
  COMMUNITY_ID=$(env_value COMMUNITY_ID)
  COMMUNITY_DESCRIPTION=$(env_value COMMUNITY_DESCRIPTION || true)
  COMMUNITY_TIME_ZONE=$(env_value COMMUNITY_TIME_ZONE || printf 'UTC')
  COMMUNITY_PUBLIC_URL=$(env_value COMMUNITY_PUBLIC_URL)
  PUBLIC_HOSTNAME=${COMMUNITY_PUBLIC_URL#*://}
  PUBLIC_HOSTNAME=${PUBLIC_HOSTNAME%%/*}
  APP_URL=$(env_value HERITAGE_APP_URL)
  ADMIN_NAME=$(env_value BOOTSTRAP_ADMIN_NAME || true)
  ADMIN_EMAIL=$(env_value BOOTSTRAP_ADMIN_EMAIL || true)
  ADMIN_PASSWORD=$(env_value BOOTSTRAP_ADMIN_PASSWORD || true)
  AUTH_ENABLED=$(env_value COMMUNITY_AUTH_ENABLED || printf 'true')
  SMTP_HOST=$(env_value SMTP_HOST || true)
  SMTP_PORT=$(env_value SMTP_PORT || printf '587')
  SMTP_USER=$(env_value SMTP_USER || true)
  SMTP_PASSWORD=$(env_value SMTP_PASS || true)
  SMTP_FROM=$(env_value SMTP_FROM || true)
  SMTP_FROM_NAME=$(env_value SMTP_FROM_NAME || true)
  TUNNEL_TOKEN=$(env_value TUNNEL_TOKEN || true)
  if [[ -z $ADMIN_EMAIL && -f ${STATE_DIR}/admin-email ]]; then
    ADMIN_EMAIL=$(<"${STATE_DIR}/admin-email")
  fi
  LOCAL_PORT=$(env_value COMMUNITY_LOCAL_PORT || printf '3000')
  BACKUP_RETENTION_DAYS=$(env_value BACKUP_RETENTION_DAYS || printf '30')
  if [[ -f $STATE_FILE ]]; then
    TUNNEL_MODE=$(env_value TUNNEL_MODE "$STATE_FILE" || printf 'local')
    TUNNEL_NAME=$(env_value TUNNEL_NAME "$STATE_FILE" || printf 'heritage-community')
    BACKUP_DIR=$(env_value BACKUP_DIR "$STATE_FILE" || printf '%s' "$BACKUP_DIR")
    BACKUP_SCHEDULE=$(env_value BACKUP_SCHEDULE "$STATE_FILE" || printf '*-*-* 02:30:00')
    DISABLE_SLEEP=$(env_value DISABLE_SLEEP "$STATE_FILE" || printf 'true')
  fi
else
  set_phase "collecting setup choices"
  COMMUNITY_NAME=${HERITAGE_COMMUNITY_NAME:-$(env_value COMMUNITY_NAME 2>/dev/null || true)}
  ask_value COMMUNITY_NAME "Church/community name" "${COMMUNITY_NAME:-Local Church}"
  [[ -n $COMMUNITY_NAME ]] || fail "Community name is required."

  default_slug=$(slugify "$COMMUNITY_NAME")
  COMMUNITY_ID=${HERITAGE_COMMUNITY_ID:-$(env_value COMMUNITY_ID 2>/dev/null || true)}
  ask_value COMMUNITY_ID "Stable community ID (lowercase letters, numbers, hyphens)" "${COMMUNITY_ID:-$default_slug}"
  validate_slug "$COMMUNITY_ID" || fail "Community ID must contain only lowercase letters, numbers, and internal hyphens."
  if [[ -f $ENV_FILE ]]; then
    old_id=$(env_value COMMUNITY_ID || true)
    [[ -z $old_id || $old_id == "$COMMUNITY_ID" ]] || fail "Changing an existing community ID is unsafe. Keep '${old_id}'."
  fi

  COMMUNITY_DESCRIPTION=${HERITAGE_COMMUNITY_DESCRIPTION:-$(env_value COMMUNITY_DESCRIPTION 2>/dev/null || true)}
  ask_value COMMUNITY_DESCRIPTION "Short description" "${COMMUNITY_DESCRIPTION:-Resources and community life for ${COMMUNITY_NAME}.}"

  detected_timezone='UTC'
  if command -v timedatectl >/dev/null 2>&1; then
    detected_timezone=$(timedatectl show -p Timezone --value 2>/dev/null || printf 'UTC')
  fi
  COMMUNITY_TIME_ZONE=${HERITAGE_COMMUNITY_TIME_ZONE:-$(env_value COMMUNITY_TIME_ZONE 2>/dev/null || true)}
  ask_value COMMUNITY_TIME_ZONE "Time zone" "${COMMUNITY_TIME_ZONE:-$detected_timezone}"
  if ! $DRY_RUN; then
    [[ -e "/usr/share/zoneinfo/${COMMUNITY_TIME_ZONE}" ]] || fail "Unknown time zone '${COMMUNITY_TIME_ZONE}'."
  fi

  existing_public_url=$(env_value COMMUNITY_PUBLIC_URL 2>/dev/null || true)
  existing_public_hostname=${existing_public_url#*://}
  existing_public_hostname=${existing_public_hostname%%/*}
  [[ $existing_public_hostname != 127.0.0.1:* ]] || existing_public_hostname=''
  PUBLIC_HOSTNAME=${HERITAGE_PUBLIC_HOSTNAME:-$existing_public_hostname}
  ask_value PUBLIC_HOSTNAME "Public hostname (for example, community.yourchurch.org)" "$PUBLIC_HOSTNAME"
  if [[ -n $PUBLIC_HOSTNAME ]]; then
    validate_hostname "$PUBLIC_HOSTNAME" || fail "Enter a hostname such as community.example.org (without https://)."
    COMMUNITY_PUBLIC_URL="https://${PUBLIC_HOSTNAME}"
  fi

  APP_URL=${HERITAGE_APP_URL:-$(env_value HERITAGE_APP_URL 2>/dev/null || true)}
  ask_value APP_URL "Heritage app URL" "${APP_URL:-https://heritage.faith}"
  validate_url "$APP_URL" || fail "Heritage app URL must begin with http:// or https://."

  APP_ORIGINS=${HERITAGE_APP_ORIGINS:-$(env_value HERITAGE_APP_ORIGINS 2>/dev/null || true)}
  APP_ORIGINS=${APP_ORIGINS:-"${APP_URL},https://localhost,capacitor://localhost,http://localhost"}

  if [[ -f ${STATE_DIR}/bootstrap-complete ]]; then
    note "The first administrator already exists; its password is not changed during server reconfiguration."
    ADMIN_NAME=''
    ADMIN_EMAIL=''
    [[ ! -f ${STATE_DIR}/admin-email ]] || ADMIN_EMAIL=$(<"${STATE_DIR}/admin-email")
    ADMIN_PASSWORD=''
  else
    ADMIN_NAME=${HERITAGE_ADMIN_NAME:-}
    ask_value ADMIN_NAME "First administrator name" "${ADMIN_NAME:-Administrator}"
    ADMIN_EMAIL=${HERITAGE_ADMIN_EMAIL:-}
    while :; do
      ask_value ADMIN_EMAIL "First administrator email" "$ADMIN_EMAIL"
      if validate_email "$ADMIN_EMAIL"; then
        break
      fi
      if $NON_INTERACTIVE; then
        fail "Enter a valid administrator email address."
      fi
      warn "That email address is not valid. Please try again."
      ADMIN_EMAIL=''
    done
    ADMIN_PASSWORD=${HERITAGE_ADMIN_PASSWORD:-}
    while :; do
      ask_secret ADMIN_PASSWORD "First administrator password (12+ characters)"
      if ((${#ADMIN_PASSWORD} < 12)); then
        if $NON_INTERACTIVE; then
          fail "Administrator password must contain at least 12 characters."
        fi
        warn "That password is too short. Please use at least 12 characters."
        ADMIN_PASSWORD=''
        continue
      fi
      if $NON_INTERACTIVE; then
        break
      fi
      ADMIN_PASSWORD_CONFIRM=''
      ask_secret ADMIN_PASSWORD_CONFIRM "Confirm administrator password"
      if [[ $ADMIN_PASSWORD != "$ADMIN_PASSWORD_CONFIRM" ]]; then
        warn "Those passwords did not match. Please enter both again."
        ADMIN_PASSWORD=''
        unset ADMIN_PASSWORD_CONFIRM
        continue
      fi
      unset ADMIN_PASSWORD_CONFIRM
      break
    done
  fi

  say "Public connection"
  cat <<'EOF'
  1) Guided Cloudflare login — the script creates DNS and a dedicated tunnel
  2) Existing Cloudflare tunnel token — dashboard setup, then paste the token
  3) Local/SSH access only — no public Community URL
EOF
  existing_tunnel_mode=$(env_value TUNNEL_MODE "$STATE_FILE" 2>/dev/null || printf 'local')
  if $NON_INTERACTIVE; then
    TUNNEL_MODE=${HERITAGE_TUNNEL_MODE:-$existing_tunnel_mode}
  else
    case $existing_tunnel_mode in local) default_tunnel_choice=1 ;; token) default_tunnel_choice=2 ;; none) default_tunnel_choice=3 ;; *) default_tunnel_choice=1 ;; esac
    tunnel_choice=''
    tty_read tunnel_choice "Choose 1, 2, or 3 [${default_tunnel_choice}]: "
    case ${tunnel_choice:-$default_tunnel_choice} in
      1) TUNNEL_MODE=local ;;
      2) TUNNEL_MODE=token ;;
      3) TUNNEL_MODE=none ;;
      *) fail "Choose 1, 2, or 3." ;;
    esac
  fi
  case $TUNNEL_MODE in local|token|none) ;; *) fail "HERITAGE_TUNNEL_MODE must be local, token, or none." ;; esac
  if $NON_INTERACTIVE && ! $DRY_RUN && [[ $TUNNEL_MODE == local ]]; then
    fail "Guided Cloudflare login needs browser authorization. Use HERITAGE_TUNNEL_MODE=token or run interactively."
  fi
  if [[ $TUNNEL_MODE != none ]]; then
    validate_hostname "$PUBLIC_HOSTNAME" || fail "A public Cloudflare mode requires a hostname such as community.yourchurch.org."
    COMMUNITY_PUBLIC_URL="https://${PUBLIC_HOSTNAME}"
  fi
  existing_tunnel_name=$(env_value TUNNEL_NAME "$STATE_FILE" 2>/dev/null || printf 'heritage-%s' "$COMMUNITY_ID")
  TUNNEL_NAME=${HERITAGE_TUNNEL_NAME:-$existing_tunnel_name}
  if [[ $TUNNEL_MODE == token ]]; then
    say "In Cloudflare: Networking → Tunnels → create/select a remotely managed tunnel."
    note "Add '${PUBLIC_HOSTNAME}' as a Published application whose service is http://community:3000."
    TUNNEL_TOKEN=${HERITAGE_TUNNEL_TOKEN:-$(env_value TUNNEL_TOKEN 2>/dev/null || true)}
    ask_secret TUNNEL_TOKEN "Paste the tunnel token"
    [[ -n $TUNNEL_TOKEN ]] || fail "A tunnel token is required for token mode."
    if [[ $TUNNEL_TOKEN == *--token* ]]; then
      parsed_tunnel_token=$(printf '%s\n' "$TUNNEL_TOKEN" \
        | sed -nE "s/.*--token(=|[[:space:]]+)[\"']?([^\"'[:space:]]+).*/\2/p")
      [[ -n $parsed_tunnel_token ]] \
        || fail "Could not find the token after --token. Paste only that token value."
      TUNNEL_TOKEN=$parsed_tunnel_token
      unset parsed_tunnel_token
      note "Extracted the token from the copied Cloudflare command."
    fi
    [[ $TUNNEL_TOKEN != *[[:space:]]* ]] \
      || fail "Paste only the tunnel token after --token, not the whole command."
  elif [[ $TUNNEL_MODE == none ]]; then
    warn "Local-only mode is for testing or SSH port forwarding; church members cannot join it over the Internet."
  fi

  LOCAL_PORT=${HERITAGE_LOCAL_PORT:-$(env_value COMMUNITY_LOCAL_PORT 2>/dev/null || printf '3000')}
  ask_value LOCAL_PORT "Loopback troubleshooting port" "$LOCAL_PORT"
  if [[ ! $LOCAL_PORT =~ ^[0-9]+$ ]] || ((LOCAL_PORT < 1024 || LOCAL_PORT > 65535)); then
    fail "Local port must be between 1024 and 65535."
  fi
  if [[ $TUNNEL_MODE == none ]]; then
    COMMUNITY_PUBLIC_URL="http://127.0.0.1:${LOCAL_PORT}"
  fi

  say "Email sign-in"
  existing_auth_enabled=$(env_value COMMUNITY_AUTH_ENABLED 2>/dev/null || true)
  if [[ $TUNNEL_MODE == none ]]; then
    if [[ ${HERITAGE_COMMUNITY_AUTH_ENABLED:-} =~ ^(true|false)$ ]]; then
      AUTH_ENABLED=$HERITAGE_COMMUNITY_AUTH_ENABLED
    elif $NON_INTERACTIVE; then
      AUTH_ENABLED=${existing_auth_enabled:-false}
    elif confirm "Enable member email sign-in on this local-only server?" "$([[ ${existing_auth_enabled:-false} == true ]] && printf yes || printf no)"; then
      AUTH_ENABLED=true
    else
      AUTH_ENABLED=false
    fi
  else
    AUTH_ENABLED=true
  fi

  if [[ $AUTH_ENABLED == true ]]; then
    note "Members receive one-time sign-in links through SMTP. Port 465 uses implicit TLS; other ports use STARTTLS when offered."
    SMTP_HOST=${HERITAGE_SMTP_HOST:-$(env_value SMTP_HOST 2>/dev/null || true)}
    ask_value SMTP_HOST "SMTP hostname" "$SMTP_HOST"
    [[ -n $SMTP_HOST ]] || fail "SMTP is required when member email sign-in is enabled. Ask your email provider for SMTP settings."
    SMTP_PORT=${HERITAGE_SMTP_PORT:-$(env_value SMTP_PORT 2>/dev/null || printf '587')}
    ask_value SMTP_PORT "SMTP port" "$SMTP_PORT"
    if [[ ! $SMTP_PORT =~ ^[0-9]+$ ]] || ((SMTP_PORT < 1 || SMTP_PORT > 65535)); then
      fail "SMTP port is invalid."
    fi
    SMTP_USER=${HERITAGE_SMTP_USER:-$(env_value SMTP_USER 2>/dev/null || true)}
    ask_value SMTP_USER "SMTP username (blank only if your relay needs none)" "$SMTP_USER"
    SMTP_PASSWORD=${HERITAGE_SMTP_PASSWORD:-$(env_value SMTP_PASS 2>/dev/null || true)}
    if [[ -n $SMTP_USER ]]; then
      ask_secret SMTP_PASSWORD "SMTP password"
      [[ -n $SMTP_PASSWORD ]] || fail "SMTP password is required when a username is set."
    fi
    SMTP_FROM=${HERITAGE_SMTP_FROM:-$(env_value SMTP_FROM 2>/dev/null || true)}
    SMTP_FROM=${SMTP_FROM:-$ADMIN_EMAIL}
    ask_value SMTP_FROM "Sender email" "$SMTP_FROM"
    validate_email "$SMTP_FROM" || fail "Sender email is invalid."
    SMTP_FROM_NAME=${HERITAGE_SMTP_FROM_NAME:-$(env_value SMTP_FROM_NAME 2>/dev/null || true)}
    SMTP_FROM_NAME=${SMTP_FROM_NAME:-$COMMUNITY_NAME}
    ask_value SMTP_FROM_NAME "Sender name" "$SMTP_FROM_NAME"
  else
    note "Member sign-in is disabled. You can still administer content through the SSH-forwarded Admin page."
    SMTP_HOST=''
    SMTP_PORT='587'
    SMTP_USER=''
    SMTP_PASSWORD=''
    SMTP_FROM=''
    SMTP_FROM_NAME="$COMMUNITY_NAME"
  fi

  existing_backup_dir=$(env_value BACKUP_DIR "$STATE_FILE" 2>/dev/null || printf '%s' "$BACKUP_DIR")
  BACKUP_DIR=${HERITAGE_BACKUP_DIR:-$existing_backup_dir}
  ask_value BACKUP_DIR "Backup folder" "$BACKUP_DIR"
  validate_system_path "Backup folder" "$BACKUP_DIR"

  BACKUP_RETENTION_DAYS=${HERITAGE_BACKUP_RETENTION_DAYS:-$(env_value BACKUP_RETENTION_DAYS 2>/dev/null || printf '30')}
  ask_value BACKUP_RETENTION_DAYS "Days of local backups to retain" "$BACKUP_RETENTION_DAYS"
  if [[ ! $BACKUP_RETENTION_DAYS =~ ^[0-9]+$ ]] || ((BACKUP_RETENTION_DAYS < 1)); then
    fail "Backup retention must be at least one day."
  fi
  BACKUP_SCHEDULE=${HERITAGE_BACKUP_SCHEDULE:-$(env_value BACKUP_SCHEDULE "$STATE_FILE" 2>/dev/null || printf '*-*-* 02:30:00')}
  if ! $NON_INTERACTIVE; then
    default_backup_time=$(printf '%s' "$BACKUP_SCHEDULE" | sed -nE 's/^\*-\*-\* ([0-2][0-9]:[0-5][0-9]):[0-5][0-9]$/\1/p')
    default_backup_time=${default_backup_time:-02:30}
    BACKUP_TIME=''
    ask_value BACKUP_TIME "Nightly backup time (24-hour local time)" "$default_backup_time"
    [[ $BACKUP_TIME =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || fail "Backup time must look like 02:30 or 23:15."
    BACKUP_SCHEDULE="*-*-* ${BACKUP_TIME}:00"
  fi

  existing_disable_sleep=$(env_value DISABLE_SLEEP "$STATE_FILE" 2>/dev/null || printf 'true')
  if [[ ${HERITAGE_DISABLE_SLEEP:-} =~ ^(true|false)$ ]]; then
    DISABLE_SLEEP=$HERITAGE_DISABLE_SLEEP
  elif $NON_INTERACTIVE; then
    DISABLE_SLEEP=$existing_disable_sleep
  elif confirm "Is this a laptop that should keep serving with its lid closed?" "$([[ $existing_disable_sleep == true ]] && printf yes || printf no)"; then
    DISABLE_SLEEP=true
  else
    DISABLE_SLEEP=false
  fi
fi

[[ -n $COMMUNITY_NAME ]] || fail "Community name is required."
validate_slug "$COMMUNITY_ID" || fail "Community ID must contain only lowercase letters, numbers, and internal hyphens."
validate_url "$COMMUNITY_PUBLIC_URL" || fail "Community public URL must begin with http:// or https://."
validate_url "$APP_URL" || fail "Heritage app URL must begin with http:// or https://."
case $TUNNEL_MODE in
  local|token|none) ;;
  *) fail "Tunnel mode must be local, token, or none." ;;
esac
case $AUTH_ENABLED in
  true|false) ;;
  *) fail "COMMUNITY_AUTH_ENABLED must be true or false." ;;
esac
case $DISABLE_SLEEP in
  true|false) ;;
  *) fail "DISABLE_SLEEP must be true or false." ;;
esac
if [[ ! $LOCAL_PORT =~ ^[0-9]+$ ]] || ((LOCAL_PORT < 1024 || LOCAL_PORT > 65535)); then
  fail "Local port must be between 1024 and 65535."
fi
validate_system_path "Backup folder" "$BACKUP_DIR"
BACKUP_DIR=$(canonicalize_missing_path "$BACKUP_DIR")
validate_backup_location
if [[ ! $BACKUP_RETENTION_DAYS =~ ^[0-9]+$ ]] || ((BACKUP_RETENTION_DAYS < 1)); then
  fail "Backup retention must be at least one day."
fi
backup_schedule_pattern='^\*-\*-\* ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'
[[ $BACKUP_SCHEDULE =~ $backup_schedule_pattern ]] \
  || fail "Backup schedule must use the form *-*-* HH:MM:SS."
if [[ $TUNNEL_MODE != none ]]; then
  validate_hostname "$PUBLIC_HOSTNAME" || fail "A public Cloudflare mode requires a valid hostname."
  [[ $COMMUNITY_PUBLIC_URL == https://* ]] || fail "Public Community URLs must use HTTPS."
fi
if [[ $TUNNEL_MODE == token && -z $TUNNEL_TOKEN ]]; then
  fail "A tunnel token is required for token mode."
fi
if [[ $AUTH_ENABLED == true ]]; then
  [[ -n $SMTP_HOST ]] || fail "SMTP is required when member email sign-in is enabled."
  if [[ ! $SMTP_PORT =~ ^[0-9]+$ ]] || ((SMTP_PORT < 1 || SMTP_PORT > 65535)); then
    fail "SMTP port is invalid."
  fi
  [[ -z $SMTP_USER || -n $SMTP_PASSWORD ]] \
    || fail "SMTP password is required when a username is set."
  validate_email "$SMTP_FROM" || fail "Sender email is invalid."
fi
[[ $COMMUNITY_TIME_ZONE =~ ^[A-Za-z0-9._+-]+(/[A-Za-z0-9._+-]+)*$ \
  && $COMMUNITY_TIME_ZONE != .. && $COMMUNITY_TIME_ZONE != ../* \
  && $COMMUNITY_TIME_ZONE != */../* && $COMMUNITY_TIME_ZONE != */.. ]] \
  || fail "Time zone must be a named zone such as America/Los_Angeles."
if ! $DRY_RUN; then
  [[ -e /usr/share/zoneinfo/${COMMUNITY_TIME_ZONE} ]] \
    || fail "Unknown time zone '${COMMUNITY_TIME_ZONE}'."
fi

say "Setup summary (secrets are intentionally hidden)"
note "Community:       ${COMMUNITY_NAME} (${COMMUNITY_ID})"
note "Public URL:      ${COMMUNITY_PUBLIC_URL}"
note "Heritage app:    ${APP_URL}"
note "Local port:      127.0.0.1:${LOCAL_PORT}"
note "Public method:   ${TUNNEL_MODE}"
note "Member sign-in:  ${AUTH_ENABLED}"
note "Backups:         ${BACKUP_DIR} (${BACKUP_RETENTION_DAYS} days)"
note "Keep awake:      ${DISABLE_SLEEP}"
note "Deployment root: ${DEPLOYMENT_ROOT}"

if ! $REUSE_CONFIG; then
  confirm "Install with these settings?" yes || { say "Application packages, containers, and existing data were not changed after the summary. The downloaded checkout and setup directories remain."; exit 0; }
fi

if [[ $PREVIOUS_TUNNEL_MODE == local && $TUNNEL_MODE == token ]] \
  || [[ $PREVIOUS_TUNNEL_MODE == token && $TUNNEL_MODE == local ]]; then
  fail "Switch through local-only mode first, remove the old hostname route in Cloudflare, then reconfigure again. Direct local/token switching could strand or overwrite DNS."
fi

[[ -f $COMPOSE_FILE ]] || fail "Production Compose file is missing: ${COMPOSE_FILE}"
[[ -f ${SOURCE_DIR}/Dockerfile ]] || fail "Community server Dockerfile is missing."

set_phase "saving private configuration for safe resume"
if ! $DRY_RUN && command -v docker >/dev/null 2>&1 \
  && docker volume inspect heritage-community-postgres >/dev/null 2>&1; then
  [[ -f $ENV_FILE ]] || fail "A Heritage PostgreSQL volume exists but ${ENV_FILE} is missing. Restore it from a recovery backup."
  existing_database_password=$(env_value POSTGRES_PASSWORD || true)
  existing_payload_secret=$(env_value PAYLOAD_SECRET || true)
  [[ -n $existing_database_password ]] || fail "The existing PostgreSQL volume has no recoverable POSTGRES_PASSWORD in ${ENV_FILE}. Restore configuration before continuing."
  [[ -n $existing_payload_secret ]] || fail "The existing installation has no PAYLOAD_SECRET in ${ENV_FILE}. Restore configuration before continuing."
fi
if ! $REUSE_CONFIG; then
  old_postgres_password=''
  old_payload_secret=''
  if [[ -f $ENV_FILE ]]; then
    old_postgres_password=$(env_value POSTGRES_PASSWORD || true)
    old_payload_secret=$(env_value PAYLOAD_SECRET || true)
  fi
  POSTGRES_PASSWORD=${old_postgres_password:-$(generate_secret)}
  PAYLOAD_SECRET=${old_payload_secret:-$(generate_secret)}

  if $DRY_RUN; then
    note "Would atomically write ${ENV_FILE} with mode 0600 before package installation so a retry can safely resume (generated secrets hidden)."
  else
    env_tmp=$(mktemp "${CONFIG_DIR}/community.env.XXXXXX")
    SECRET_TEMP_FILES+=("$env_tmp")
    {
      printf '# Generated by Heritage installer %s. Keep this file private.\n' "$INSTALLER_VERSION"
      printf 'POSTGRES_DB=heritage_community\n'
      printf 'POSTGRES_USER=heritage\n'
      printf 'POSTGRES_PASSWORD=%s\n' "$POSTGRES_PASSWORD"
      printf 'DATABASE_URL=postgresql://heritage:%s@postgres:5432/heritage_community\n' "$POSTGRES_PASSWORD"
      printf 'PAYLOAD_SECRET=%s\n' "$PAYLOAD_SECRET"
      printf 'COMMUNITY_PUBLIC_URL=%s\n' "$(dotenv_quote "$COMMUNITY_PUBLIC_URL")"
      printf 'COMMUNITY_ID=%s\n' "$COMMUNITY_ID"
      printf 'COMMUNITY_NAME=%s\n' "$(dotenv_quote "$COMMUNITY_NAME")"
      printf 'COMMUNITY_DESCRIPTION=%s\n' "$(dotenv_quote "$COMMUNITY_DESCRIPTION")"
      printf 'COMMUNITY_TIME_ZONE=%s\n' "$(dotenv_quote "$COMMUNITY_TIME_ZONE")"
      printf 'HERITAGE_APP_URL=%s\n' "$(dotenv_quote "$APP_URL")"
      printf 'HERITAGE_APP_ORIGINS=%s\n' "$(dotenv_quote "$APP_ORIGINS")"
      printf 'COMMUNITY_AUTH_ENABLED=%s\n' "$AUTH_ENABLED"
      printf 'SMTP_HOST=%s\n' "$(dotenv_quote "$SMTP_HOST")"
      printf 'SMTP_PORT=%s\n' "$SMTP_PORT"
      printf 'SMTP_USER=%s\n' "$(dotenv_quote "$SMTP_USER")"
      printf 'SMTP_PASS=%s\n' "$(dotenv_quote "$SMTP_PASSWORD")"
      printf 'SMTP_FROM=%s\n' "$(dotenv_quote "$SMTP_FROM")"
      printf 'SMTP_FROM_NAME=%s\n' "$(dotenv_quote "$SMTP_FROM_NAME")"
      printf 'COMMUNITY_LOCAL_PORT=%s\n' "$LOCAL_PORT"
      printf 'BACKUP_RETENTION_DAYS=%s\n' "$BACKUP_RETENTION_DAYS"
      printf 'TUNNEL_TOKEN=%s\n' "$(dotenv_quote "$TUNNEL_TOKEN")"
      if [[ -n $ADMIN_PASSWORD && ! -f ${STATE_DIR}/bootstrap-complete ]]; then
        printf 'BOOTSTRAP_ADMIN_NAME=%s\n' "$(dotenv_quote "$ADMIN_NAME")"
        printf 'BOOTSTRAP_ADMIN_EMAIL=%s\n' "$(dotenv_quote "$ADMIN_EMAIL")"
        printf 'BOOTSTRAP_ADMIN_PASSWORD=%s\n' "$(dotenv_quote "$ADMIN_PASSWORD")"
      fi
    } >"$env_tmp"
    chmod 0600 "$env_tmp"
    mv -f "$env_tmp" "$ENV_FILE"
  fi
fi

if ! $DRY_RUN; then
  ln -sfn "$ENV_FILE" "${SOURCE_DIR}/.env.production"
  preserved_tunnel_uuid=$(env_value TUNNEL_UUID "$STATE_FILE" 2>/dev/null || true)
  preserved_tunnel_dns=$(env_value TUNNEL_DNS_CONFIGURED "$STATE_FILE" 2>/dev/null || true)
  state_tmp=$(mktemp "${STATE_DIR}/install.env.XXXXXX")
  {
    printf 'INSTALLER_VERSION=%s\n' "$INSTALLER_VERSION"
    printf 'TUNNEL_MODE=%s\n' "$TUNNEL_MODE"
    printf 'TUNNEL_NAME=%s\n' "$TUNNEL_NAME"
    printf 'BACKUP_SCHEDULE=%s\n' "$(dotenv_quote "$BACKUP_SCHEDULE")"
    printf 'DISABLE_SLEEP=%s\n' "$DISABLE_SLEEP"
    printf 'SOURCE_DIR=%s\n' "$(dotenv_quote "$SOURCE_DIR")"
    printf 'BACKUP_DIR=%s\n' "$(dotenv_quote "$BACKUP_DIR")"
    [[ -z $preserved_tunnel_uuid ]] || printf 'TUNNEL_UUID=%s\n' "$(dotenv_quote "$preserved_tunnel_uuid")"
    [[ -z $preserved_tunnel_dns ]] || printf 'TUNNEL_DNS_CONFIGURED=%s\n' "$(dotenv_quote "$preserved_tunnel_dns")"
  } >"$state_tmp"
  chmod 0600 "$state_tmp"
  mv -f "$state_tmp" "$STATE_FILE"
fi

set_phase "installing system dependencies"
if $DRY_RUN; then
  note "Would install base tools, Docker Engine/Compose from Docker's official Debian repository, and enable Docker."
  [[ $TUNNEL_MODE != local ]] || note "Would install cloudflared from Cloudflare's official Debian repository."
else
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl dnsutils git gnupg jq openssl qrencode unattended-upgrades util-linux

  docker_ready=false
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker_ready=true
  fi

  if ! $docker_ready; then
    conflicting_packages=$(dpkg-query -W -f='${binary:Package}\n' docker.io docker-compose docker-doc podman-docker containerd runc 2>/dev/null || true)
    if [[ -n $conflicting_packages ]]; then
      fail "Conflicting distro container packages are installed: ${conflicting_packages//$'\n'/, }. Remove them deliberately, then rerun; the installer will not remove a working container stack automatically."
    fi

    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: ${VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  systemctl enable --now docker.service
  docker info >/dev/null
  docker compose version >/dev/null

  if [[ $TUNNEL_MODE == local ]]; then
    install -d -m 0755 /usr/share/keyrings
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
    chmod a+r /usr/share/keyrings/cloudflare-main.gpg
    cat >/etc/apt/sources.list.d/cloudflared.list <<'EOF'
deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main
EOF
    apt-get update
    apt-get install -y cloudflared
  fi
fi

if [[ $PREVIOUS_TUNNEL_MODE != "$TUNNEL_MODE" && -n $PREVIOUS_TUNNEL_MODE ]]; then
  set_phase "retiring the previous public connector"
  if $DRY_RUN; then
    note "Would stop and remove the previous ${PREVIOUS_TUNNEL_MODE} Cloudflare connector before recording the new mode."
  elif [[ $PREVIOUS_TUNNEL_MODE == token ]]; then
    stale_token_output=$(docker ps --all --quiet \
      --filter label=com.docker.compose.project=heritage-community \
      --filter label=com.docker.compose.service=cloudflared) \
      || fail "Could not inspect the previous token-based Cloudflare connector."
    stale_token_containers=()
    if [[ -n $stale_token_output ]]; then
      readarray -t stale_token_containers <<<"$stale_token_output"
    fi
    if ((${#stale_token_containers[@]})); then
      docker rm --force "${stale_token_containers[@]}" >/dev/null \
        || fail "Could not remove the previous token-based Cloudflare connector. Public exposure may still be active."
    fi
    running_token_output=$(docker ps --quiet \
      --filter label=com.docker.compose.project=heritage-community \
      --filter label=com.docker.compose.service=cloudflared) \
      || fail "Could not verify that the previous token-based Cloudflare connector stopped."
    if [[ -n $running_token_output ]]; then
      fail "The previous token-based Cloudflare connector is still running. Stop it before changing tunnel mode."
    fi
    warn "The old Cloudflare hostname route may still exist, but its connector is removed. Remove that route in Cloudflare before reusing it."
  elif [[ $PREVIOUS_TUNNEL_MODE == local ]]; then
    if systemctl is-active --quiet heritage-community-tunnel.service \
      || systemctl list-unit-files heritage-community-tunnel.service --no-legend 2>/dev/null | grep -q '^heritage-community-tunnel.service'; then
      systemctl disable --now heritage-community-tunnel.service \
        || fail "Could not stop the previous locally managed Cloudflare connector."
    fi
    rm -f /etc/systemd/system/heritage-community-tunnel.service
    systemctl daemon-reload
    if systemctl is-active --quiet heritage-community-tunnel.service; then
      fail "The previous locally managed Cloudflare connector is still active."
    fi
    warn "The old Cloudflare DNS route is still present but its connector is removed. Remove that hostname route in Cloudflare before reusing it."
  fi
fi

set_phase "configuring the Debian host"
if ! $DRY_RUN; then
  install -d -m 0750 "$BACKUP_DIR"
  timedatectl set-timezone "$COMMUNITY_TIME_ZONE"
  timedatectl set-ntp true || warn "Could not enable systemd time synchronization; verify the clock manually."

  cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

  if [[ $DISABLE_SLEEP == true ]]; then
    install -d -m 0755 /etc/systemd/logind.conf.d
    cat >/etc/systemd/logind.conf.d/heritage-community.conf <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
EOF
    systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
    note "Sleep targets are disabled. The lid policy is guaranteed after the next reboot."
  elif [[ -f /etc/systemd/logind.conf.d/heritage-community.conf ]]; then
    rm -f /etc/systemd/logind.conf.d/heritage-community.conf
    systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target
    note "The Heritage closed-lid override was removed; reboot to apply the normal lid policy."
  fi
fi

if ! $DRY_RUN && command -v ss >/dev/null 2>&1; then
  existing_community_id=$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q community 2>/dev/null || true)
  existing_local_port=$(env_value COMMUNITY_LOCAL_PORT 2>/dev/null || true)
  port_in_use=$(ss -H -ltn | awk -v port=":${LOCAL_PORT}" '$4 ~ port "$" { print; exit }')
  if [[ -n $port_in_use && ( -z $existing_community_id || $existing_local_port != "$LOCAL_PORT" ) ]]; then
    fail "127.0.0.1:${LOCAL_PORT} is already in use. Rerun with a different HERITAGE_LOCAL_PORT."
  fi
fi

compose() {
  local profile_args=()
  [[ $TUNNEL_MODE != token ]] || profile_args=(--profile cloudflare-token)
  docker compose --project-name heritage-community --env-file "$ENV_FILE" --file "$COMPOSE_FILE" "${profile_args[@]}" "$@"
}

wait_for_local_server() {
  local elapsed=0 max_wait=${1:-180}
  while ((elapsed < max_wait)); do
    if curl -fsS --max-time 5 "http://127.0.0.1:${LOCAL_PORT}/.well-known/heritage-community.json" >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    printf '.'
  done
  printf '\n'
  return 1
}

set_phase "building and migrating the Community server"
if $DRY_RUN; then
  note "Would validate Compose, pull PostgreSQL, build immutable app/migration images, run migrations, and start the app."
else
  compose config --quiet
  if compose ps --status running --services 2>/dev/null | grep -qx community && [[ -x ${SCRIPT_DIR}/backup.sh ]]; then
    note "A running installation was found; creating a safety backup before migrations."
    HERITAGE_INSTALL_DIR="$SOURCE_DIR" HERITAGE_ENV_FILE="$ENV_FILE" HERITAGE_BACKUP_DIR="$BACKUP_DIR" \
      "${SCRIPT_DIR}/backup.sh" --retention-days "$BACKUP_RETENTION_DAYS" --label pre-install
  fi

  compose pull postgres
  [[ $TUNNEL_MODE != token ]] || compose pull cloudflared
  compose build --pull community migrate
  compose up -d postgres
  compose --profile operations run --rm -T migrate
  compose up -d community
  if [[ $TUNNEL_MODE == token ]]; then
    compose up -d cloudflared
  fi

  wait_for_local_server 240 || {
    compose logs --tail 120 community postgres >&2 || true
    fail "The local Community server did not become healthy."
  }
  printf '\n'
fi

if [[ -n $ADMIN_PASSWORD && ! -f ${STATE_DIR}/bootstrap-complete ]]; then
  set_phase "verifying the first administrator"
  if $DRY_RUN; then
    note "Would verify the new administrator through the loopback API, remove the bootstrap password, and recreate the container."
  else
    login_request=$(mktemp "${CONFIG_DIR}/admin-login.XXXXXX")
    login_response=$(mktemp "${CONFIG_DIR}/admin-response.XXXXXX")
    SECRET_TEMP_FILES+=("$login_request" "$login_response")
    jq -n --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" \
      '{email: $email, password: $password}' >"$login_request"
    if ! curl -fsS --max-time 15 -H 'Content-Type: application/json' \
      --data-binary "@${login_request}" \
      "http://127.0.0.1:${LOCAL_PORT}/api/users/login" >"$login_response"; then
      rm -f "$login_request" "$login_response"
      compose logs --tail 120 community >&2 || true
      fail "The first administrator could not sign in; bootstrap credentials remain in the root-only configuration for a safe rerun."
    fi
    jq -e '.user.systemRole == "system-admin"' "$login_response" >/dev/null || {
      rm -f "$login_request" "$login_response"
      fail "The bootstrapped account is not a system administrator."
    }
    rm -f "$login_request" "$login_response"

    cleaned_env=$(mktemp "${CONFIG_DIR}/community.env.XXXXXX")
    SECRET_TEMP_FILES+=("$cleaned_env")
    grep -Ev '^BOOTSTRAP_ADMIN_(NAME|EMAIL|PASSWORD)=' "$ENV_FILE" >"$cleaned_env"
    chmod 0600 "$cleaned_env"
    mv -f "$cleaned_env" "$ENV_FILE"
    : >"${STATE_DIR}/bootstrap-complete"
    chmod 0600 "${STATE_DIR}/bootstrap-complete"
    printf '%s\n' "$ADMIN_EMAIL" >"${STATE_DIR}/admin-email"
    chmod 0600 "${STATE_DIR}/admin-email"
    unset ADMIN_PASSWORD
    compose up -d --force-recreate community
    wait_for_local_server 120 || fail "The server did not recover after removing bootstrap credentials."
  fi
fi

state_set() {
  local key=$1 value=$2 tmp
  tmp=$(mktemp "${STATE_DIR}/install.env.XXXXXX")
  awk -v key="$key" '$0 !~ "^" key "=" { print }' "$STATE_FILE" >"$tmp"
  printf '%s=%s\n' "$key" "$(dotenv_quote "$value")" >>"$tmp"
  chmod 0600 "$tmp"
  mv -f "$tmp" "$STATE_FILE"
}

set_phase "connecting the public hostname"
if [[ $TUNNEL_MODE == local ]]; then
  if $DRY_RUN; then
    note "Would open a Cloudflare authorization URL, create/reuse '${TUNNEL_NAME}', route ${PUBLIC_HOSTNAME}, validate ingress, and start a dedicated system service."
  else
    command -v cloudflared >/dev/null 2>&1 || fail "cloudflared was not installed."
    install -d -m 0700 /root/.cloudflared
    tunnel_uuid=$(env_value TUNNEL_UUID "$STATE_FILE" || true)
    tunnel_credentials=''
    remove_origin_cert=false

    if [[ -n $tunnel_uuid && -f ${CONFIG_DIR}/cloudflared-${tunnel_uuid}.json ]]; then
      tunnel_credentials="${CONFIG_DIR}/cloudflared-${tunnel_uuid}.json"
    else
      say "Cloudflare will print a one-time web address."
      note "Open it on any phone/computer, sign in, choose the domain for ${PUBLIC_HOSTNAME}, then return here."
      if [[ ! -f /root/.cloudflared/cert.pem ]]; then
        remove_origin_cert=true
        REMOVE_ORIGIN_CERT_ON_EXIT=true
      fi
      cloudflared_login_with_qr

      matching_tunnel=$(HOME=/root cloudflared tunnel list --output json \
        | jq -r --arg name "$TUNNEL_NAME" '[.[] | select(.name == $name and (.deletedAt == null))] | if length == 1 then .[0].id elif length > 1 then "duplicate" else "" end')
      [[ $matching_tunnel != duplicate ]] || fail "Cloudflare has more than one active tunnel named '${TUNNEL_NAME}'. Rename one and rerun."
      if [[ -n $matching_tunnel ]]; then
        fail "Tunnel '${TUNNEL_NAME}' already exists, but this machine has no tunnel credentials. Recover its JSON credential or choose a new HERITAGE_TUNNEL_NAME; it cannot be downloaded again."
      fi

      if ! create_output=$(HOME=/root cloudflared tunnel create "$TUNNEL_NAME" 2>&1); then
        printf '%s\n' "$create_output" >&2
        fail "Cloudflare could not create tunnel '${TUNNEL_NAME}'."
      fi
      printf '%s\n' "$create_output"
      tunnel_uuid=$(printf '%s\n' "$create_output" | grep -Eo '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' | tail -n 1)
      [[ -n $tunnel_uuid ]] || fail "Cloudflare created a tunnel but its UUID could not be read. Inspect 'cloudflared tunnel list'."
      generated_credentials="/root/.cloudflared/${tunnel_uuid}.json"
      [[ -f $generated_credentials ]] || fail "Tunnel credential was not created at ${generated_credentials}."
      tunnel_credentials="${CONFIG_DIR}/cloudflared-${tunnel_uuid}.json"
      install -m 0600 "$generated_credentials" "$tunnel_credentials"
      rm -f "$generated_credentials"
      state_set TUNNEL_UUID "$tunnel_uuid"
    fi

    tunnel_user=heritage-tunnel
    if ! id "$tunnel_user" >/dev/null 2>&1; then
      useradd --system --home-dir /var/lib/heritage-community-tunnel --create-home --shell /usr/sbin/nologin "$tunnel_user"
    fi
    chown root:"$tunnel_user" "$CONFIG_DIR"
    chmod 0710 "$CONFIG_DIR"
    chown "$tunnel_user":"$tunnel_user" "$tunnel_credentials"
    chmod 0600 "$tunnel_credentials"

    cloudflared_config="${CONFIG_DIR}/cloudflared.yml"
    cat >"$cloudflared_config" <<EOF
tunnel: ${tunnel_uuid}
credentials-file: ${tunnel_credentials}
ingress:
  - hostname: ${PUBLIC_HOSTNAME}
    service: http://127.0.0.1:${LOCAL_PORT}
  - service: http_status:404
EOF
    chown root:"$tunnel_user" "$cloudflared_config"
    chmod 0640 "$cloudflared_config"

    cloudflared --config "$cloudflared_config" tunnel ingress validate
    cloudflared --config "$cloudflared_config" tunnel ingress rule "https://${PUBLIC_HOSTNAME}" \
      | grep -q "http://127.0.0.1:${LOCAL_PORT}" \
      || fail "Cloudflare ingress validation did not select the local Community server."

    dns_configured=$(env_value TUNNEL_DNS_CONFIGURED "$STATE_FILE" || true)
    if [[ $dns_configured != "$PUBLIC_HOSTNAME" ]]; then
      if [[ ! -f /root/.cloudflared/cert.pem ]]; then
        remove_origin_cert=true
        REMOVE_ORIGIN_CERT_ON_EXIT=true
        say "Cloudflare authorization is needed to create the new DNS hostname."
        note "Open the printed URL on any device, approve the domain, then return here."
        HOME=/root cloudflared tunnel login
      fi
      if ! route_output=$(HOME=/root cloudflared tunnel route dns "$tunnel_uuid" "$PUBLIC_HOSTNAME" 2>&1); then
        expected_target="${tunnel_uuid}.cfargotunnel.com."
        existing_target=$(dig +short CNAME "$PUBLIC_HOSTNAME" | tail -n 1)
        if [[ ${existing_target,,} != "${expected_target,,}" ]]; then
          printf '%s\n' "$route_output" >&2
          fail "DNS for ${PUBLIC_HOSTNAME} already belongs to something else (${existing_target:-no matching CNAME}). The installer will not overwrite it."
        fi
      else
        printf '%s\n' "$route_output"
      fi
      if [[ -n $dns_configured ]]; then
        warn "The previous DNS hostname ${dns_configured} was not deleted automatically. Remove it from Cloudflare if it is no longer used."
      fi
      state_set TUNNEL_DNS_CONFIGURED "$PUBLIC_HOSTNAME"
    fi

    cat >/etc/systemd/system/heritage-community-tunnel.service <<EOF
[Unit]
Description=Cloudflare Tunnel for Heritage Community
Documentation=https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=simple
User=${tunnel_user}
Group=${tunnel_user}
ExecStart=/usr/bin/cloudflared --no-autoupdate --config ${cloudflared_config} tunnel run
Restart=on-failure
RestartSec=5s
TimeoutStopSec=30s
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable --now heritage-community-tunnel.service
    systemctl restart heritage-community-tunnel.service

    # cert.pem authorizes account-wide tunnel management and is not needed by
    # the service. Do not leave that long-lived credential on an appliance.
    if $remove_origin_cert; then
      rm -f /root/.cloudflared/cert.pem
      REMOVE_ORIGIN_CERT_ON_EXIT=false
    elif [[ -f /root/.cloudflared/cert.pem ]]; then
      warn "A Cloudflare account certificate existed before this install, so it was not deleted. Store it as an account-wide credential."
    fi
  fi
elif [[ $TUNNEL_MODE == token ]]; then
  note "The remotely managed tunnel container is enabled. Its dashboard origin must remain http://community:3000."
else
  note "Public tunnel skipped. Use SSH forwarding to reach 127.0.0.1:${LOCAL_PORT}."
fi

if [[ $TUNNEL_MODE != none ]]; then
  if $DRY_RUN; then
    note "Would wait for and verify ${COMMUNITY_PUBLIC_URL}/.well-known/heritage-community.json over HTTPS."
  else
    public_ready=false
    for _ in $(seq 1 40); do
      if curl -fsS --max-time 10 "${COMMUNITY_PUBLIC_URL}/.well-known/heritage-community.json" \
        | jq -e --arg id "$COMMUNITY_ID" '.kind == "heritage-community" and .id == $id' >/dev/null 2>&1; then
        public_ready=true
        break
      fi
      sleep 3
      printf '.'
    done
    printf '\n'
    if ! $public_ready; then
      PUBLIC_READY=false
      [[ $TUNNEL_MODE != local ]] || state_set TUNNEL_DNS_CONFIGURED ''
      warn "The local server is healthy, but the public HTTPS manifest is not reachable yet. Setup will continue so backup and diagnostic commands are available."
    fi
  fi
fi

set_phase "installing backups and operator commands"
if $DRY_RUN; then
  note "Would install the nightly backup timer and the heritage-community lifecycle command."
else
  for script in heritage-community backup.sh restore.sh status.sh update.sh uninstall.sh; do
    [[ -f ${SCRIPT_DIR}/${script} ]] || fail "Operator tool is missing: ${SCRIPT_DIR}/${script}"
    chmod 0755 "${SCRIPT_DIR}/${script}"
  done
  chmod 0755 "${SCRIPT_DIR}/bootstrap.sh" "${SCRIPT_DIR}/install.sh"

  cat >/etc/default/heritage-community <<EOF
HERITAGE_INSTALL_DIR=${SOURCE_DIR}
HERITAGE_ENV_FILE=${ENV_FILE}
HERITAGE_BACKUP_DIR=${BACKUP_DIR}
HERITAGE_BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS}
HERITAGE_DEPLOYMENT_ROOT=${DEPLOYMENT_ROOT}
EOF
  chmod 0600 /etc/default/heritage-community

  ln -sfn "${SCRIPT_DIR}/heritage-community" /usr/local/sbin/heritage-community
  # Older development installs exposed direct script symlinks that could not
  # locate lib/common.sh. Keep one dependable, discoverable dispatcher.
  rm -f /usr/local/sbin/heritage-community-backup \
    /usr/local/sbin/heritage-community-restore \
    /usr/local/sbin/heritage-community-status \
    /usr/local/sbin/heritage-community-update

  sed \
    -e "s|@INSTALL_DIR@|${SOURCE_DIR}|g" \
    -e "s|@BACKUP_DIR@|${BACKUP_DIR}|g" \
    -e "s|@RETENTION_DAYS@|${BACKUP_RETENTION_DAYS}|g" \
    "${SCRIPT_DIR}/systemd/heritage-community-backup.service.in" \
    >/etc/systemd/system/heritage-community-backup.service
  cat >/etc/systemd/system/heritage-community-backup.timer <<EOF
[Unit]
Description=Nightly Heritage Community backup

[Timer]
OnCalendar=${BACKUP_SCHEDULE}
RandomizedDelaySec=30m
Persistent=true
Unit=heritage-community-backup.service

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now heritage-community-backup.timer

  if ! find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'backup-20*' -print -quit | grep -q .; then
    HERITAGE_INSTALL_DIR="$SOURCE_DIR" HERITAGE_ENV_FILE="$ENV_FILE" HERITAGE_BACKUP_DIR="$BACKUP_DIR" \
      "${SCRIPT_DIR}/backup.sh" --retention-days "$BACKUP_RETENTION_DAYS" --label initial
  fi
fi

set_phase "testing email delivery"
if [[ $AUTH_ENABLED != true ]]; then
  note "Member email sign-in is disabled, so no SMTP delivery test is needed."
elif $DRY_RUN; then
  note "Would ask the server to send a real one-time sign-in email to the administrator."
else
  test_email=${HERITAGE_TEST_EMAIL:-$ADMIN_EMAIL}
  if [[ -z $test_email ]]; then
    warn "No administrator test email is recorded, so the SMTP delivery test was skipped. Set HERITAGE_TEST_EMAIL and rerun reconfigure to test it."
    test_email=''
  fi
  if [[ -n $test_email ]]; then
    wait_for_local_server 120 \
      || fail "The community app did not become ready after the initial backup. Inspect 'heritage-community logs', then rerun the installer."
    email_request=$(mktemp "${CONFIG_DIR}/email-test.XXXXXX")
    SECRET_TEMP_FILES+=("$email_request")
    jq -n --arg email "$test_email" '{email: $email}' >"$email_request"
    if curl -fsS --max-time 30 -H 'Content-Type: application/json' --data-binary "@${email_request}" \
      "http://127.0.0.1:${LOCAL_PORT}/api/community/auth/magic-link" >/dev/null; then
      note "SMTP accepted a real sign-in message for ${test_email}."
      if ! $NON_INTERACTIVE && ! confirm "Did that email arrive?" yes; then
        warn "The SMTP server accepted the message, but delivery was not confirmed. Check spam, SPF, DKIM, and DMARC with your email provider."
      fi
    else
      rm -f "$email_request"
      fail "SMTP rejected the sign-in test. Inspect 'heritage-community logs' and correct the SMTP settings with 'heritage-community reconfigure'."
    fi
    rm -f "$email_request"
  fi
fi

set_phase "final verification"
if $DRY_RUN; then
  say "Dry run complete. No packages, files, containers, DNS records, or services were changed."
  exit 0
else
  HERITAGE_INSTALL_DIR="$SOURCE_DIR" HERITAGE_ENV_FILE="$ENV_FILE" HERITAGE_BACKUP_DIR="$BACKUP_DIR" \
    "${SCRIPT_DIR}/status.sh" --wait 30 --verify-backup
  rm -f "${STATE_DIR}/last-phase"
fi

if ! $PUBLIC_READY; then
  say "Heritage Community is installed and healthy locally, but public access is not verified."
  note "Run: sudo heritage-community status"
  note "Then check the Cloudflare tunnel/DNS instructions above and rerun the installer."
  exit 1
fi

if [[ $TUNNEL_MODE == none ]]; then
  say "Heritage Community is ready for local administration."
  note "On your computer, open an SSH tunnel and leave that terminal running:"
  note "ssh -L ${LOCAL_PORT}:127.0.0.1:${LOCAL_PORT} your-user@server-address"
  note "Then open: http://127.0.0.1:${LOCAL_PORT}/admin"
  [[ -z $ADMIN_EMAIL ]] || note "Admin email: ${ADMIN_EMAIL} (use the password you chose)"
  note "Backups:  ${BACKUP_DIR}"
  cat <<'EOF'

This local-only server is not reachable from a phone or the Heritage app over
the Internet. Run "sudo heritage-community reconfigure" when you are ready to
add a public Cloudflare tunnel and member email sign-in.

Next:
  1. Use the SSH-forwarded Admin page to add or test church content.
  2. Reboot once before relying on closed-lid laptop operation, then run
     sudo heritage-community status.
  3. Copy the first verified backup to encrypted storage off this laptop.

Daily commands:
  sudo heritage-community status
  sudo heritage-community logs
  sudo heritage-community backup
  sudo heritage-community update
  sudo heritage-community restore --latest

Keep an encrypted copy of the backup folder on another physical device. A
backup stored only on this laptop will not survive theft or disk failure.
EOF
else
  say "Heritage Community is ready."
  note "Admin:    ${COMMUNITY_PUBLIC_URL}/admin"
  [[ -z $ADMIN_EMAIL ]] || note "Admin email: ${ADMIN_EMAIL} (use the password you chose)"
  note "Server URL to join: ${COMMUNITY_PUBLIC_URL}"
  note "Backups:  ${BACKUP_DIR}"
  cat <<'EOF'

Next:
  1. Open the Admin URL and add your church's plans, songs, books, sermons,
     commentaries, events, and member roles.
  2. In Heritage, open Communities, choose Join Community, and paste the
     server URL shown above.
  3. Reboot once before relying on closed-lid laptop operation, then run
     sudo heritage-community status.
  4. Copy the first verified backup to encrypted storage off this laptop.

Daily commands:
  sudo heritage-community status
  sudo heritage-community logs
  sudo heritage-community backup
  sudo heritage-community update
  sudo heritage-community restore --latest

Keep an encrypted copy of the backup folder on another physical device. A
backup stored only on this laptop will not survive theft or disk failure.
EOF
fi
