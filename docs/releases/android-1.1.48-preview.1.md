Fixes delayed Bible audio verse highlighting on Android. The reader now receives
updates at the recording's verse boundaries, scheduled from the same native
playback service clock that supplies its displayed position. It no longer waits
for the next one-second general progress update.

The boundary scheduler checks the actual player position again when it wakes,
handles seeking and playback-speed changes, and stops while the reader is in
the background. Applying the reading marker happens before the next paint.
No recording timestamps were shifted or regenerated for this fix.

Includes an Android regression test using Ezekiel 42's shipped boundaries,
the real ExoPlayer service, and the packaged reader. It checks highlight latency
at multiple boundaries, pausing, backward seeking, and 0.75x, 1x and 2x playback.
The test is required before an APK can be published. This verifies playback
and display synchronization; it does not certify every speech-alignment mark.

Install through Settings → Check for updates. This uses the existing app identity
and signer, so notes, reading progress and downloaded audio are retained.
