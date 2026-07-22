#!/bin/sh
set -eu

MEDIA=/cdrom/heritage
TARGET=/target
DEPLOYMENT_ROOT=/opt/heritage-community

test -f "$MEDIA/heritage-study-bible.bundle"
test -f "$MEDIA/source-branch"

install -d -m 0755 "$TARGET$DEPLOYMENT_ROOT"
install -m 0644 "$MEDIA/heritage-study-bible.bundle" "$TARGET$DEPLOYMENT_ROOT/source.bundle"
install -m 0644 "$MEDIA/source-revision" "$TARGET$DEPLOYMENT_ROOT/source-revision"

BRANCH=$(cat "$MEDIA/source-branch")
in-target git clone --branch "$BRANCH" "$DEPLOYMENT_ROOT/source.bundle" "$DEPLOYMENT_ROOT/app"
in-target git -C "$DEPLOYMENT_ROOT/app" remote set-url origin https://github.com/edydex/heritage_study_bible.git
in-target git -C "$DEPLOYMENT_ROOT/app" config "branch.$BRANCH.remote" origin
in-target git -C "$DEPLOYMENT_ROOT/app" config "branch.$BRANCH.merge" "refs/heads/$BRANCH"

install -m 0755 "$MEDIA/heritage-community-setup" "$TARGET/usr/local/sbin/heritage-community-setup"
install -m 0644 "$MEDIA/heritage-community-first-login.sh" "$TARGET/etc/profile.d/heritage-community-first-login.sh"
install -m 0644 "$MEDIA/motd" "$TARGET/etc/motd"
install -d -m 0755 "$TARGET$DEPLOYMENT_ROOT/state"
touch "$TARGET$DEPLOYMENT_ROOT/state/appliance-setup-pending"

if test -f "$MEDIA/content-server-template.tar.gz"; then
  install -d -m 0755 "$TARGET/opt/heritage-content-server"
  tar -xzf "$MEDIA/content-server-template.tar.gz" -C "$TARGET/opt/heritage-content-server"
fi

in-target systemctl enable ssh.service
