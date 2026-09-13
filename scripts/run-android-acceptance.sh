#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
output="$repo_root/android/app/build/native-acceptance"
mkdir -p "$output"
export ANDROID_SERIAL=emulator-5554
adb start-server
printf 'no\n' | avdmanager create avd --force --name heritage-acceptance --package 'system-images;android-35;google_apis;x86_64' --device pixel_2
"$ANDROID_HOME/emulator/emulator" -avd heritage-acceptance -port 5554 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -camera-back none -camera-front none -cores 2 -memory 2048 > "$output/emulator.log" 2>&1 &
heritage_emulator_pid=$!
cleanup() {
  adb logcat -d > "$output/logcat.txt" 2>&1 || true
  adb pull /sdcard/Android/data/faith.heritage.app/files/native-acceptance "$output/screenshots" >/dev/null 2>&1 || true
  adb emu kill >/dev/null 2>&1 || true
  wait "$heritage_emulator_pid" || true
}
trap cleanup EXIT
timeout 240 adb wait-for-device
booted=false
for attempt in $(seq 1 90); do
  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]]; then booted=true; break; fi
  sleep 2
done
[[ "$booted" == true ]] || { echo 'Android emulator did not boot.' >&2; exit 1; }
adb shell input keyevent 82
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell svc wifi disable
adb shell svc data disable
cd "$repo_root/android"
./gradlew :app:connectedDebugAndroidTest --stacktrace
