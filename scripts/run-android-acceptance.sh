#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
output="$repo_root/android/app/build/native-acceptance"
mkdir -p "$output"
export ANDROID_SERIAL=emulator-5554
timeout --kill-after=5 15 adb start-server
printf 'no\n' | timeout --kill-after=5 120 avdmanager create avd --force --name heritage-acceptance --package 'system-images;android-35;google_apis;x86_64' --device pixel_2
"$ANDROID_HOME/emulator/emulator" -avd heritage-acceptance -port 5554 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -camera-back none -camera-front none -cores 2 -memory 2048 > "$output/emulator.log" 2>&1 &
heritage_emulator_pid=$!
cleanup() {
  timeout --kill-after=5 10 adb logcat -d > "$output/logcat.txt" 2>&1 || true
  timeout --kill-after=5 10 adb pull /sdcard/Android/data/faith.heritage.app/files/native-acceptance "$output/screenshots" >/dev/null 2>&1 || true
  timeout --kill-after=5 5 adb emu kill >/dev/null 2>&1 || true
  kill -KILL "$heritage_emulator_pid" 2>/dev/null || true
  wait "$heritage_emulator_pid" || true
}
trap cleanup EXIT
timeout --kill-after=5 240 adb wait-for-device
booted=false
boot_deadline=$((SECONDS + 240))
while (( SECONDS < boot_deadline )); do
  if [[ "$(timeout --kill-after=5 10 adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]]; then booted=true; break; fi
  kill -0 "$heritage_emulator_pid" 2>/dev/null || break
  sleep 2
done
[[ "$booted" == true ]] || { echo 'Android emulator did not boot.' >&2; exit 1; }
timeout --kill-after=5 10 adb shell input keyevent 82
timeout --kill-after=5 10 adb shell settings put global window_animation_scale 0
timeout --kill-after=5 10 adb shell settings put global transition_animation_scale 0
timeout --kill-after=5 10 adb shell settings put global animator_duration_scale 0
timeout --kill-after=5 10 adb shell svc wifi disable
timeout --kill-after=5 10 adb shell svc data disable
cd "$repo_root/android"
timeout --kill-after=5 900 ./gradlew :app:connectedDebugAndroidTest --stacktrace
