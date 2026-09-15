# Android update feed

Published Android APKs, including labelled development previews, must be available through the installed Heritage **Check for updates** control. This is the publishing policy from September 14, 2026 onward.

- Publish verified APKs as normal GitHub releases with `prerelease: false`, then explicitly make the intended upgrade Latest. Keep development status clear in its title and notes; a GitHub channel flag is not a claim of physical-device acceptance.
- The installed app requests `/repos/edydex/heritage_study_bible/releases/latest`. A separate preview flag would hide an APK from it.
- Increase the **numeric** version for every new update. From `1.1.33-preview.2`, use at least `1.1.34` or `1.1.34-preview.1`, not `1.1.33-preview.3` or `1.1.33`. Existing checkers ignore the suffix. Also increase Android `versionCode` beyond the latest APK and preserve application ID/signing identity.
- The verified publisher stages assets in a draft, verifies them, promotes it, and checks the actual Latest response. Old builds and incompatible versions must not replace the feed. Retries may complete an identical release, but cannot replace different published bytes or move a tag.
- Build-only CI artifacts are not published releases. Integration branch publication remains an explicit `publish: true` workflow choice. This policy controls discoverability when publishing, not automatic distribution of every work-in-progress build.

Use `scripts/publish-android-release.mjs` after native package verification. Its regression suite is `node --test tests/android-release-publishing.test.mjs` and is run before Android builds. Validate the anonymous Latest response and execute the app's unchanged updater against that endpoint; a successful upload alone is insufficient.

## Current repair

`v1.1.33-preview.2` was promoted to the normal Latest feed without rebuilding or replacing its APK. Source remains `3f30bdb1dd9002a4d9a50b7545fe6bbc6a5b7697`, version code 36, SHA-256 `c65220771fd4b66b72cb3742e96a16064ae486ec904e85af2f2b31a6972c3abd`. The old checker, given installed version `1.1.32`, returned `update-available` against the public GitHub endpoint.

An already installed `1.1.33-preview.1` still has the old same-numeric-version limitation and needs the direct Preview 2 APK or the next numeric-version release. That is why future publication rejects suffix-only bumps. No app data or server/provider settings change when the GitHub release metadata changes.
