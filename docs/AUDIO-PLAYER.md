# Internal audio playback and downloads

Heritage now owns its audiobook player rather than embedding the Archive player.
The player stays mounted across routes. It saves the recording ID, position in
seconds and playback speed locally; reopening offers Resume without autoplay.
Each of the ten existing LibriVox books has a bundled track catalog (384 tracks),
including separate identities for all four Antiquities volumes. At the end of a
track, playback advances within that book, including across volumes, then stops.
Browser Media Session supplies supported lock-screen/headset controls.

Find the library from **Resources → Books → Audio library**. Each book also has
its own listening panel and track picker. The compact player expands to show
seeking, previous/next, speed, the book's text, and the audio library.

## Offline storage

Android uses Capacitor's official File Transfer plugin and private app storage.
Download individual tracks or the selected book/volume. **Settings → More
settings → Internal Storage** lists saved recordings and deletes selected tracks
or all audio with confirmation. Deletion keeps notes, text and resume positions.
A browser streams audio; it does not claim to save recordings offline.

Downloads are serialized and repeated requests for a track are deduplicated. A
new file gets a unique temporary path, must match the publisher's byte count and
have an MP3 header, and is renamed before the index is committed. The previous
copy remains indexed until that commit succeeds. A failed transfer, short file,
HTML error page, or failed index write leaves the previous recording intact.
Existing downloads are adopted by exact recording URL/filename where possible;
unmatched legacy files remain listed for removal. Files outside the dedicated
audio directory are never adopted/deleted by this feature. A failed filesystem
deletion is shown as an error, rather than reporting that space was freed.

An interrupted app/process can leave a temporary or superseded file. Internal
Storage lists these under Unfinished or older downloads so they can be removed.
Active transfers and newly committed recordings are protected from this cleanup.
Keep the app open for a whole-book download; this is not yet an Android background
download service.

## Catalog and source fidelity

`scripts/generateAudioCatalog.mjs` reads the existing resource definitions and the
[Internet Archive metadata API](https://archive.org/developers/md-read.html).
The checked-in catalog records the source page, metadata URL, metadata-response
SHA-256, license link, track filename/URL, duration and byte count. For a local
reproduction, set `AUDIO_METADATA_DIR` to saved `<archiveId>.json` responses.
The recordings are the existing LibriVox selections, with their original readers
credited on the linked [LibriVox source pages](https://librivox.org/pages/public-domain/).
The Polycarp and Maximus selections include only their respective tracks, not all
works in the source anthologies. Catalog regeneration does not rewrite audio.

The current **Open book text** control opens the book. It does **not** claim to
know the sentence being spoken. Exact text alignment, Bible verse timing/gray
highlight/autoscroll, additional authorized Bible recordings, native Android
background playback and Android Auto browsing remain separate implementation and
acceptance work. No Whisper alignment or model charges were incurred here.

## Verification

- Transaction tests cover concurrent downloads, duplicate clicks, short/non-audio
  responses, index write failure, filesystem delete failure and legacy adoption.
- Player tests cover exact resume, no launch autoplay, per-track positions,
  delayed lookup races, canceled loads and React StrictMode startup preservation.
- Playwright exercises actual HTML media playback with a local range-capable WAV,
  route changes, reload/resume, failed audio fetching and a 390 px phone layout.
- The public Archive source supports HTTP byte ranges. Real recording playback
  in Chromium and Firefox resumed from 73 seconds and reached 74, then sought to
  125 and reached 126, with no page errors.
- The full reader suite passed: 255 unit tests, 124 protocol tests and 45 Chromium
  browser tests; the three audio browser tests also passed in Firefox.
- The Android debug APK and instrumentation APK compiled with Java 21 / SDK 36.
  Two packaged storage/deletion tests are included; emulator execution is pending.

The web checks and mocked native-storage contract do not constitute Android
hardware, car/headset, background-lifecycle or real offline-download acceptance.
Those must pass before an Android release is described as ready.
