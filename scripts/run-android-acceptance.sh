#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
output="$repo_root/android/app/build/native-acceptance"
mkdir -p "$output"
export ANDROID_SERIAL=emulator-5554
android_user_dir=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/heritage-android-user.XXXXXX")
export ANDROID_USER_HOME="$android_user_dir"
export ANDROID_EMULATOR_HOME="$android_user_dir"
export ANDROID_AVD_HOME="$android_user_dir/avd"
mkdir -p "$ANDROID_AVD_HOME"
avd_manager="$(dirname "$(command -v sdkmanager)")/avdmanager"
printf 'avdmanager=%s\navdDirectory=%s\n' "$avd_manager" "$ANDROID_AVD_HOME" > "$output/avd-setup.txt"
timeout --kill-after=5 15 adb start-server
printf 'no\n' | timeout --kill-after=5 120 "$avd_manager" create avd --force --name heritage-acceptance --path "$ANDROID_AVD_HOME/heritage-acceptance.avd" --package 'system-images;android-35;google_apis;x86_64' --device pixel_2 2>&1 | tee "$output/avd-create.log"
[[ -f "$ANDROID_AVD_HOME/heritage-acceptance.ini" ]] || { echo 'AVD creation did not write the expected emulator registration.' >&2; exit 1; }
"$ANDROID_HOME/emulator/emulator" -avd heritage-acceptance -port 5554 -no-window -no-audio -no-boot-anim -no-snapshot -no-metrics -gpu swiftshader_indirect -camera-back none -camera-front none -cores 4 -memory 4096 > "$output/emulator.log" 2>&1 &
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
# The Google APIs image's first-boot setup re-enables Wi-Fi asynchronously.
# This AVD is disposable and needs no Google-account setup during offline tests.
timeout --kill-after=5 10 adb shell pm disable-user --user 0 com.google.android.googlesdksetup
timeout --kill-after=5 10 adb shell svc wifi disable
timeout --kill-after=5 10 adb shell svc data disable
timeout --kill-after=5 10 adb shell cmd connectivity airplane-mode enable
timeout --kill-after=5 10 adb emu gsm data unregistered
timeout --kill-after=5 10 adb shell dumpsys connectivity > "$output/connectivity-before-tests.txt"
cd "$repo_root/android"
# Keep the test app until cleanup has pulled its screenshots. The emulator is
# disposable; Gradle's normal uninstall removes the app's external files first.
timeout --kill-after=5 900 ./gradlew :app:connectedDebugAndroidTest -Pandroid.injected.androidTest.leaveApksInstalledAfterRun=true --stacktrace
