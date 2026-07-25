#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd -P)"
BASE_ISO=${1:-/tmp/debian-13.6.0-amd64-netinst.iso}
OUTPUT_ISO=${2:-${SCRIPT_DIR}/output/heritage-community-debian-13.6.0-amd64.iso}
EXPECTED_SHA512=ce0eeee7b51fdcdbed1e5116668c1fee27e528767bdf488e5f115a67b225e5dfd0afca1d456aaa9408ceb6b8527521ff7b6b5d62fdbe6f8c5faaf8df56a96292
XORRISO=${XORRISO:-$(command -v xorriso || true)}

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
command -v git >/dev/null 2>&1 || fail 'git is required.'
command -v shasum >/dev/null 2>&1 || fail 'shasum is required.'
[[ -n $XORRISO && -x $XORRISO ]] || fail 'xorriso is required (Homebrew: brew install xorriso).'
[[ -f $BASE_ISO ]] || fail "Base ISO not found: $BASE_ISO"
[[ ! -e $OUTPUT_ISO ]] || fail "Output already exists: $OUTPUT_ISO"

actual_sha=$(shasum -a 512 "$BASE_ISO" | awk '{print $1}')
[[ $actual_sha == "$EXPECTED_SHA512" ]] || fail 'The Debian ISO SHA-512 does not match Debian 13.6.0 amd64.'

status=$(git -C "$REPOSITORY_ROOT" status --porcelain --untracked-files=all)
[[ -z $status ]] || fail 'Commit or preserve repository changes before baking the appliance; the image contains committed code only.'
branch=$(git -C "$REPOSITORY_ROOT" branch --show-current)
[[ -n $branch ]] || fail 'The repository must be on a named branch.'
revision=$(git -C "$REPOSITORY_ROOT" rev-parse HEAD)

work=$(mktemp -d "${TMPDIR:-/tmp}/heritage-appliance.XXXXXX")
cleanup() { rm -rf -- "$work"; }
trap cleanup EXIT
mkdir -p "$work/heritage"

git -C "$REPOSITORY_ROOT" bundle create "$work/heritage/heritage-study-bible.bundle" "refs/heads/$branch"
git -C "$REPOSITORY_ROOT" bundle verify "$work/heritage/heritage-study-bible.bundle"
printf '%s\n' "$branch" >"$work/heritage/source-branch"
printf '%s\n' "$revision" >"$work/heritage/source-revision"
cp "$SCRIPT_DIR/late-command.sh" "$work/heritage/late-command.sh"
cp "$SCRIPT_DIR/heritage-community-setup" "$work/heritage/heritage-community-setup"
cp "$SCRIPT_DIR/heritage-community-first-login.sh" "$work/heritage/heritage-community-first-login.sh"
cp "$SCRIPT_DIR/motd" "$work/heritage/motd"
cp "$SCRIPT_DIR/preseed.cfg" "$work/preseed.cfg"

CONTENT_REPOSITORY="${REPOSITORY_ROOT}/content-server"
if [[ -d ${CONTENT_REPOSITORY}/.git ]] \
  && [[ -z $(git -C "$CONTENT_REPOSITORY" status --porcelain --untracked-files=all) ]]; then
  git -C "$CONTENT_REPOSITORY" archive --format=tar.gz \
    --output="$work/heritage/content-server-template.tar.gz" HEAD
fi

"$XORRISO" -osirrox on -indev "$BASE_ISO" \
  -extract /boot/grub/grub.cfg "$work/grub-original.cfg" \
  -extract /isolinux/txt.cfg "$work/txt-original.cfg" >/dev/null

cat >"$work/grub-entry.cfg" <<'EOF'
menuentry --hotkey=h 'Heritage Community Server guided install' {
    set background_color=black
    linux    /install.amd/vmlinuz vga=788 priority=high preseed/file=/cdrom/preseed.cfg --- quiet
    initrd   /install.amd/initrd.gz
}
EOF

awk -v snippet="$work/grub-entry.cfg" '
  !inserted && /^menuentry / {
    while ((getline line < snippet) > 0) print line
    close(snippet)
    inserted=1
  }
  { print }
' "$work/grub-original.cfg" >"$work/grub.cfg"

cat >"$work/txt.cfg" <<'EOF'
label heritage
	menu label ^Heritage Community Server guided install
	kernel /install.amd/vmlinuz
	append vga=788 initrd=/install.amd/initrd.gz priority=high preseed/file=/cdrom/preseed.cfg --- quiet

EOF
cat "$work/txt-original.cfg" >>"$work/txt.cfg"

mkdir -p "$(dirname -- "$OUTPUT_ISO")"
"$XORRISO" -indev "$BASE_ISO" -outdev "$OUTPUT_ISO" \
  -map "$work/preseed.cfg" /preseed.cfg \
  -map "$work/heritage" /heritage \
  -map "$work/grub.cfg" /boot/grub/grub.cfg \
  -map "$work/txt.cfg" /isolinux/txt.cfg \
  -volid HERITAGE_COMMUNITY_13_6 \
  -append_partition all revoke - \
  -boot_image any replay \
  -commit

"$XORRISO" -indev "$OUTPUT_ISO" -report_el_torito plain -report_system_area plain
"$XORRISO" -osirrox on -indev "$OUTPUT_ISO" \
  -extract /preseed.cfg "$work/check-preseed.cfg" \
  -extract /boot/grub/grub.cfg "$work/check-grub.cfg" \
  -extract /isolinux/txt.cfg "$work/check-txt.cfg" \
  -extract /heritage/source-revision "$work/check-revision" >/dev/null

cmp "$work/preseed.cfg" "$work/check-preseed.cfg"
cmp "$work/grub.cfg" "$work/check-grub.cfg"
cmp "$work/txt.cfg" "$work/check-txt.cfg"
cmp "$work/heritage/source-revision" "$work/check-revision"
grep -q 'Heritage Community Server guided install' "$work/check-grub.cfg"
grep -q 'Heritage Community Server guided install' "$work/check-txt.cfg"

shasum -a 256 "$OUTPUT_ISO" >"${OUTPUT_ISO}.sha256"
printf '\nVerified appliance ISO: %s\n' "$OUTPUT_ISO"
cat "${OUTPUT_ISO}.sha256"
