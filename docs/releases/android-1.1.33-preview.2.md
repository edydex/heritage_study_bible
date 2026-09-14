This preview adds **Automatic Sync** under **Settings → Sync**.

- Enable it on each device where you want automatic synchronization. It starts off.
- After the Bible and local annotations open, Heritage waits 10 seconds and starts quietly. It then tries every 3 minutes while the app is in the foreground and online.
- Sync pauses while you type in an editor, avoids overlapping requests, and backs off after connection failures. An expired sign-in waits for you to sign in again.
- New notes, deletions, highlights and reading progress made during a request stay intact. Incoming changes do not navigate away from the current Bible chapter.
- Sync sends changed personal records. It does not upload Bible downloads, sermon recordings or other resource files. The first sync may transfer more history than later ones.

The APK uses the same development signer as the earlier releases and version code 36, so it can update Preview 1 while keeping local reading data. Do not uninstall the old app first.

This remains a development preview. Automated checks cover sync scheduling and concurrent edits; Android acceptance checks the setting, native preference persistence across activity restart, and offline Bible opening. Real phone battery use and a two-device automatic-sync session still need acceptance.
