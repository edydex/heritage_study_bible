#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE=${1:-}
DISK=${2:-}

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
[[ -f $IMAGE ]] || fail 'Usage: write-usb-macos.sh IMAGE.iso /dev/diskN'
[[ $DISK =~ ^/dev/disk[0-9]+$ ]] || fail 'Use a whole macOS disk such as /dev/disk6, never a partition such as disk6s1.'
command -v diskutil >/dev/null 2>&1 || fail 'This writer requires macOS diskutil.'

info=$(diskutil info "$DISK")
grep -Eq 'Whole:[[:space:]]+Yes' <<<"$info" || fail "$DISK is not a whole disk."
grep -Eq 'Device Location:[[:space:]]+External' <<<"$info" || fail "$DISK is not an external disk."
grep -Eq 'Virtual:[[:space:]]+No' <<<"$info" || fail "$DISK is virtual."

image_size=$(stat -f '%z' "$IMAGE")
disk_size=$(diskutil info -plist "$DISK" | plutil -extract TotalSize raw -)
(( image_size < disk_size )) || fail 'The image is larger than the selected disk.'

diskutil list "$DISK"
printf '\nThis permanently erases every partition on %s.\n' "$DISK"
printf 'Type ERASE %s to continue: ' "${DISK#/dev/}"
IFS= read -r confirmation </dev/tty
[[ $confirmation == "ERASE ${DISK#/dev/}" ]] || fail 'Confirmation did not match; nothing was changed.'

diskutil unmountDisk "$DISK"
raw="/dev/r${DISK#/dev/}"
sudo dd if="$IMAGE" of="$raw" bs=4m
sync
sudo cmp -n "$image_size" "$IMAGE" "$raw"
diskutil eject "$DISK"
printf '\nUSB write and byte-for-byte verification completed.\n'
