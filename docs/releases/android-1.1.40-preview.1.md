The audio library now uses Heritage's internal player. Resume the last recording
at its saved timestamp, change playback speed, and keep listening while
navigating. Download individual recordings or a book for offline listening, and
manage saved files under **Settings → More settings → Internal Storage**.

This preview also adds:

- Background playback, notification/headset controls and an Android Auto media
  library. Native emulator checks cover browsing and controls; a real car/head
  unit still needs testing.
- All 1,189 chapters of the BSB recording by Barry Hays. Optional verse following
  uses a temporary gray marker and can scroll the current chapter. Checked
  automatic timing data currently covers 14,912 of 31,102 verses; unmatched
  verses keep playing without a guessed highlight.
- **Go to nearby text** for 54 audiobook recordings in Confessions, Enchiridion,
  First Apology, Martyrdom of Polycarp and Tertullian's Apology. These are checked
  phrase-to-paragraph matches, not word-perfect timing. Coverage is sparse where
  the recording uses a different translation. Other books still open their text
  normally while their recordings are processed.
- Named original-language sources in parallel reading: Hebrew/Aramaic from
  WLC/OSHB, and Greek from Nestle 1904. Romans includes attested links between
  Greek and BSB words; unmatched passages are deliberately left unlinked.

Saved reading notes, highlights and progress are preserved. Opening the app or
returning to the player does not automatically start audio. Failed timing loads
do not interrupt playback or remove saved listening progress.

Keep the app open for whole-book downloads. Recordings remain large files, so
check available storage before downloading a long book. Russian and Ukrainian
Bible recordings are not bundled in this release; their recording permissions
and exact edition identity still need to be established.

This is a development preview for testing. Use the attached verified APK to
update the existing app; its application identity and signer are checked against
the previous release. The normal Android update checker will discover it.
