#!/bin/sh

PENDING=/opt/heritage-community/state/appliance-setup-pending
test -t 0 || return 0
test -f "$PENDING" || return 0
test -z "${HERITAGE_FIRST_LOGIN_SHOWN:-}" || return 0
export HERITAGE_FIRST_LOGIN_SHOWN=1

cat <<'EOF'

Heritage Community Server still needs its short setup wizard.
It will ask plain-language questions and show a summary before installing.
EOF

printf 'Start the Heritage setup now? [Y/n] '
IFS= read -r answer
case ${answer:-y} in
  y|Y|yes|YES|Yes)
    if command -v sudo >/dev/null 2>&1; then
      sudo heritage-community-setup
    elif test "$(id -u)" -eq 0; then
      heritage-community-setup
    else
      printf 'Sign in as root and run: heritage-community-setup\n'
    fi
    ;;
  *) printf 'Later, run: sudo heritage-community-setup\n' ;;
esac
