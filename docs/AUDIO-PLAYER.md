# Internal audio playback and downloads

Heritage now owns its audiobook player rather than embedding the Archive player.
The player stays mounted across routes. It saves the recording ID, position in
seconds and playback speed locally; reopening offers Resume without autoplay.
Each of the ten existing LibriVox books has a bundled track catalog (384 tracks),
including separate identities for all four Antiquities volumes. At the end of a
track, playback advances within that book, including across volumes, then stops.
Browser Media Session supplies supported lock-screen/headset controls.

On Android, a Media3 `MediaLibraryService` owns playback, its queue and saved
position. The app, notification, headset and car controls all connect to that
same player. Closing the reader releases its controller but keeps playing audio
alive. Reopening adopts the service's latest position; an old WebView cache cannot
overwrite progress made from the car. Loading the library never starts audio.
Speech audio focus, headphone-disconnection handling and the playback foreground
service use Android's media APIs. While audio plays, volume buttons adjust audio
volume even if side-button page scrolling is enabled.

## Android Auto

The Android app declares media support and exposes **Continue listening**,
**Downloaded** and **Audiobooks** through both modern and legacy media-browser
interfaces. The same bundled catalog loads without opening the reader or signing
in. Antiquities volumes remain separate browse folders. Tracks play in book
order; the car can pause, seek and move between tracks. Search matches catalog
book, author and recording titles. This is phone-connected Android Auto support;
a separately installable Android Automotive OS app is not provided.

Only bundled recording IDs can be played. A browser client's supplied URL or
metadata is ignored; the service resolves either the validated private download
or that recording's catalog URL. Private file paths do not appear in library
listings. App-only commands require the application's UID. Deleting the active
download waits for the service to release playback before deleting the file;
the saved position remains and a later Play uses the online recording.

For a GitHub-installed test APK, Android Auto can hide apps installed outside
Google Play. Enable its developer mode, then **Unknown sources**, as described in
[Google's test instructions](https://developer.android.com/training/cars/testing#unknown-sources).
Do this setup while parked. The implementation follows the standard
[Android media service architecture](https://developer.android.com/media/implement/surfaces/cars).

Device acceptance still required before calling car support fully verified:

1. Install the matching APK, start a recording, seek and change speed. Lock the
   phone, use its notification/headset controls, close the reader, and reopen it.
   Playback and the displayed position must agree throughout.
2. Download a recording, switch to airplane mode and restart the app. Play it
   from Downloaded; verify seeking works. Delete it in Internal Storage and check
   that its position stays saved while the offline file disappears.
3. While parked, connect Android Auto before opening Heritage. Browse all three
   roots, play and pause a downloaded track, move to the next track, and disconnect
   and reconnect. The phone and car must show the same recording and position.
4. Check interruption by another audio app, headset disconnection and a phone
   restart. A normal app launch must offer Resume without starting audio itself.

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
highlight/autoscroll and additional authorized Bible recordings remain separate
implementation work. No Whisper alignment or model charges were incurred here.

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
- The published audio foundation passed all seven Android packaged tests in
  GitHub Actions, including the two real private-storage/deletion tests.
- Native adapter tests cover shared state, stale-response rejection, StrictMode
  listener cleanup and failed unload acknowledgement before deletion.
- Four new tests passed on an isolated offline Android 15 arm64 emulator using
  real Media3, the packaged WebView and a generated PCM recording. They verify
  car browsing before any Activity, legacy browse compatibility, saved queue and
  speed without autoplay, path-traversal rejection, caller URL replacement,
  shared app/car controls and playback after the reader closes.
- The complete packaged Android regression run then passed all eleven tests in
  the offline emulator, including the existing Community/Keystore/sync checks.
  Release verification requires all ten named Community and audio checks and
  byte-for-byte agreement between the native and web catalog sources.

Emulator evidence is separate from physical phone/headset, car head-unit and
real network-download acceptance. The new native playback increment has not yet
been published as an Android release.
