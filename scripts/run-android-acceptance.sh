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
heritage_emulator_pid=''
adb_startup_log="$output/adb-startup.log"
cleanup() {
  exit_status=$?
  printf 'exitCode=%s\n' "$exit_status" > "$output/runner-exit.txt"
  if [[ -n "$heritage_emulator_pid" ]]; then
    timeout --kill-after=5 10 adb logcat -d > "$output/logcat.txt" 2>&1 || true
    timeout --kill-after=5 10 adb pull /sdcard/Android/data/faith.heritage.app/files/native-acceptance "$output/screenshots" >/dev/null 2>&1 || true
    timeout --kill-after=5 5 adb emu kill >/dev/null 2>&1 || true
    kill -KILL "$heritage_emulator_pid" 2>/dev/null || true
    wait "$heritage_emulator_pid" || true
  fi
  # Startup can leave a partial daemon even before an emulator is launched.
  printf 'cleanup: stopping ADB server\n' >> "$adb_startup_log"
  timeout --kill-after=5 5 adb kill-server >> "$adb_startup_log" 2>&1 || true
  adb_daemon_log="${TMPDIR:-/tmp}/adb.$(id -u).log"
  if [[ -f "$adb_daemon_log" ]]; then tail -c 131072 "$adb_daemon_log" > "$output/adb-daemon.log" || true; fi
  return "$exit_status"
}
trap cleanup EXIT
printf 'adb-start-server\n' > "$output/runner-phase.txt"
if timeout --kill-after=5 15 adb start-server > "$adb_startup_log" 2>&1; then
  printf 'attempt=1 exitCode=0\n' >> "$adb_startup_log"
else
  startup_status=$?
  printf 'attempt=1 exitCode=%s\n' "$startup_status" >> "$adb_startup_log"
  # Reset unresponsive server state before one fresh attempt. Each attempt and
  # reset stays bounded: at most 50 seconds including forced-kill grace, then
  # at most 10 seconds for EXIT's server cleanup if startup fails. This never
  # retries native tests or extends their assertions.
  if timeout --kill-after=5 5 adb kill-server >> "$adb_startup_log" 2>&1; then
    printf 'reset exitCode=0\n' >> "$adb_startup_log"
  else
    reset_status=$?
    printf 'reset exitCode=%s; ADB startup cannot safely continue.\n' "$reset_status" >> "$adb_startup_log"
    cat "$adb_startup_log" >&2
    exit "$startup_status"
  fi
  if timeout --kill-after=5 15 adb start-server >> "$adb_startup_log" 2>&1; then
    printf 'attempt=2 exitCode=0\n' >> "$adb_startup_log"
  else
    startup_status=$?
    printf 'attempt=2 exitCode=%s\n' "$startup_status" >> "$adb_startup_log"
    cat "$adb_startup_log" >&2
    exit "$startup_status"
  fi
fi
printf 'avd-create\n' > "$output/runner-phase.txt"
printf 'no\n' | timeout --kill-after=5 120 "$avd_manager" create avd --force --name heritage-acceptance --path "$ANDROID_AVD_HOME/heritage-acceptance.avd" --package 'system-images;android-35;google_apis;x86_64' --device pixel_2 2>&1 | tee "$output/avd-create.log"
[[ -f "$ANDROID_AVD_HOME/heritage-acceptance.ini" ]] || { echo 'AVD creation did not write the expected emulator registration.' >&2; exit 1; }
printf 'emulator-boot\n' > "$output/runner-phase.txt"
"$ANDROID_HOME/emulator/emulator" -avd heritage-acceptance -port 5554 -no-window -no-audio -no-boot-anim -no-snapshot -no-metrics -gpu swiftshader_indirect -camera-back none -camera-front none -cores 4 -memory 4096 > "$output/emulator.log" 2>&1 &
heritage_emulator_pid=$!
timeout --kill-after=5 240 adb wait-for-device
booted=false
boot_deadline=$((SECONDS + 240))
while (( SECONDS < boot_deadline )); do
  if [[ "$(timeout --kill-after=5 10 adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]]; then booted=true; break; fi
  kill -0 "$heritage_emulator_pid" 2>/dev/null || break
  sleep 2
done
[[ "$booted" == true ]] || { echo 'Android emulator did not boot.' >&2; exit 1; }
# Unlock through WindowManager without dispatching input to the still-starting
# launcher; an early MENU key can create a launcher ANR over the tested app.
timeout --kill-after=5 10 adb shell wm dismiss-keyguard
timeout --kill-after=5 10 adb shell settings put global window_animation_scale 0
timeout --kill-after=5 10 adb shell settings put global transition_animation_scale 0
timeout --kill-after=5 10 adb shell settings put global animator_duration_scale 0
# Exercise the reader with the square/circle/triangle navigation controls. This
# changes only this disposable AVD; personal devices retain their chosen mode.
timeout --kill-after=5 10 adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.threebutton
timeout --kill-after=5 10 adb shell cmd overlay list > "$output/navigation-mode.txt"
grep -F '[x] com.android.internal.systemui.navbar.threebutton' "$output/navigation-mode.txt" >/dev/null
# Pre-acknowledge the disposable AVD's first-use full-screen tutorial, whose
# delayed native window can take focus during a held reader gesture. This is
# the exact value Android's Got it button stores (Android 15 AOSP source):
# https://android.googlesource.com/platform/frameworks/base/+/android-15.0.0_r1/services/core/java/com/android/server/wm/ImmersiveModeConfirmation.java
timeout --kill-after=5 10 adb shell settings put secure immersive_mode_confirmations confirmed
timeout --kill-after=5 10 adb shell settings get secure immersive_mode_confirmations | tr -d '\r' > "$output/immersive-mode-confirmation.txt"
grep -Fx 'confirmed' "$output/immersive-mode-confirmation.txt" >/dev/null
# The Google APIs image's first-boot setup re-enables Wi-Fi asynchronously.
# This AVD is disposable and needs no Google-account setup during offline tests.
timeout --kill-after=5 10 adb shell pm disable-user --user 0 com.google.android.googlesdksetup
timeout --kill-after=5 10 adb shell svc wifi disable
timeout --kill-after=5 10 adb shell svc data disable
timeout --kill-after=5 10 adb shell cmd connectivity airplane-mode enable
timeout --kill-after=5 10 adb emu gsm data unregistered
timeout --kill-after=5 10 adb shell dumpsys connectivity > "$output/connectivity-before-tests.txt"
# Android Auto is an external trusted media controller. Give only the test
# host's empty notification-listener component that same platform trust on
# this disposable emulator. Production permissions and focus policy stay intact.
timeout --kill-after=5 60 adb install -r "$repo_root/android/app/build/outputs/apk/debug/app-debug.apk"
timeout --kill-after=5 60 adb install -r -t "$repo_root/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
timeout --kill-after=5 10 adb shell cmd notification allow_listener faith.heritage.app.test/faith.heritage.app.CarControllerTestNotificationListener
cd "$repo_root/android"
printf 'native-tests\n' > "$output/runner-phase.txt"
# Keep the test app until cleanup has pulled its screenshots. The emulator is
# disposable; Gradle's normal uninstall removes the app's external files first.
timeout --kill-after=5 900 ./gradlew :app:connectedDebugAndroidTest -Pandroid.injected.androidTest.leaveApksInstalledAfterRun=true --stacktrace
