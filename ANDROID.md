# Heritage Android APK

This app uses Capacitor to package the existing Vite/React web app as an Android APK.

## Prerequisites

- Android Studio installed
- Android SDK installed
- `ANDROID_HOME` or `android/local.properties` pointing at the SDK, for example:

```properties
sdk.dir=/Users/your-name/Library/Android/sdk
```

`android/local.properties` is intentionally gitignored.

## Common Commands

```bash
npm run build
npx cap sync android
npm run android:run
npm run android:build:debug
```

The debug APK will be created under:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Android Reader Controls

The app includes a native `HeritageControls` Capacitor plugin. When the in-app setting `Side Buttons` is enabled and the route is a reader screen, Android volume keys are consumed and sent to the web app as `heritage:native-scroll` events.

- Volume Up scrolls up.
- Volume Down scrolls down.
- Outside reader screens, volume keys are left alone.

## Persistence

Verse bookmarks, commentary bookmarks, notes, reader progress, resource section bookmarks, and key settings are mirrored through the app persistence layer. The `More > Backup / Export` tool can export/import JSON backups and export readable Markdown notes/bookmarks.

## Offline Content + Audio

The APK bundles the current app shell and data. `public/data/content-manifest.json` is the starting manifest for future hosted content refreshes from `https://heritage.faith`.

Direct LibriVox MP3 resources can be downloaded in the Android app and played from local app storage. Archive embeds remain available for web/streaming playback.

## GitHub Actions APK Build

A debug APK can also be built without setting up the Android SDK locally:

1. Push the branch to GitHub.
2. Open **Actions**.
3. Run **Android Debug APK** manually, or let it run after a matching push to `main`.
4. Download the `heritage-study-bible-debug-apk` artifact.

This is the easiest path for regular installable builds. Local Android Studio is still useful when debugging native Android behavior, inspecting logs, or testing directly on a connected device.
