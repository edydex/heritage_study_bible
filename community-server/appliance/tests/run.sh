#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
APPLIANCE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
PRESEED="${APPLIANCE_DIR}/preseed.cfg"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$*"; }

for script in \
  "$APPLIANCE_DIR/build-installer.sh" \
  "$APPLIANCE_DIR/write-usb-macos.sh" \
  "$APPLIANCE_DIR/heritage-community-setup"; do
  bash -n "$script" || fail "shell syntax: $script"
done
sh -n "$APPLIANCE_DIR/late-command.sh"
sh -n "$APPLIANCE_DIR/heritage-community-first-login.sh"
pass 'appliance scripts have valid shell syntax'

grep -q 'preseed/late_command' "$PRESEED" || fail 'late command is not configured'
grep -q 'openssh-server sudo ca-certificates curl git' "$PRESEED" || fail 'required first-boot packages are missing'
grep -q '^d-i passwd/root-login boolean false$' "$PRESEED" ||
  fail 'first user will not reliably receive sudo access'
if grep -Eq 'passwd/(root|user)-password|partman-auto|partman/confirm|grub-installer/bootdev' "$PRESEED"; then
  fail 'preseed contains a password, automatic partitioning, or automatic boot-disk choice'
fi
pass 'preseed creates one sudo administrator and leaves its password and disk choices interactive'

grep -q 'adduser .* sudo' "$APPLIANCE_DIR/heritage-community-setup" ||
  fail 'setup command does not explain how to recover missing sudo access'
grep -q 'id -nG | grep -qw sudo' "$APPLIANCE_DIR/heritage-community-first-login.sh" ||
  fail 'first-login prompt does not verify sudo-group membership'
pass 'first-login setup detects and explains missing administrator access'

grep -q 'Device Location:.*External' "$APPLIANCE_DIR/write-usb-macos.sh" || fail 'USB writer does not require an external disk'
grep -q 'Whole:.*Yes' "$APPLIANCE_DIR/write-usb-macos.sh" || fail 'USB writer does not require a whole disk'
grep -q 'Type ERASE' "$APPLIANCE_DIR/write-usb-macos.sh" || fail 'USB writer has no typed erase confirmation'
grep -q 'sudo cmp' "$APPLIANCE_DIR/write-usb-macos.sh" || fail 'USB writer does not verify written bytes'
pass 'USB writer identifies, confirms, and verifies the whole external disk'

printf '\nAppliance safety tests passed.\n'
