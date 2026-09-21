# Automatic personal sync

Settings → Sync has a device-local, opt-in Automatic Sync switch (default off). The native app stores the preference in Capacitor Preferences as well as its local mirror. It is not itself a synchronized account record or an exported preference.

Once the Bible text and local annotations have rendered, the app lazily starts a foreground scheduler. Its first attempt is delayed by 10 seconds and uses an idle callback when available. Successful attempts are spaced 3 minutes apart, measured from completion. Manual Sync now and automatic sync share one in-flight operation. Conflict decisions and account sign-out/revocation/erase are serialized with sync; supported browsers also use a Web Lock across tabs.

The scheduler makes no new attempts when the page is hidden, Android reports an inactive activity, the device is offline, or a text editor has focus. Returning or reconnecting allows at least 10 seconds for the interface to settle. Failures back off to 6, 12, 24, then 30 minutes; an expired or absent sign-in waits for a session change. Disabling stops future attempts; an already-running request can finish. No mobile background service is installed.

## Cost and interval

A normal small sync checks the account, pulls changes since the saved revision, and posts local changes (three requests; larger histories use additional 500-record pages). It hashes local records to detect changes and writes only affected local groups. Unchanged Bible/resource files are never transferred. The initial reconciliation also saves a local rollback export and may transfer the entire personal history.

Three minutes is an engineering choice to balance responsiveness and phone/server work. It is not based on a measured phone battery benchmark. A minute is unnecessary polling for the present scan-and-request implementation; five minutes would make changes slower to reach another open device.

## Safety and acceptance

Incoming storage changes use a three-way merge against the pre-request snapshot. Local edits, additions and deletions made during network I/O survive, and remain pending against the acknowledged server revision for the next attempt. Note/highlight/bookmark React state receives the same merge, preserving edits that have not yet flushed to storage. Sync does not change the reader URL or chapter. Pulled-only revisions are remembered so unchanged remote notes are not uploaded again.

Local regression tests cover timing, offline/hidden/native lifecycle, backoff, sign-in expiry, overlapping requests, concurrent record edits, editor deferral, and switch persistence. Android package acceptance checks native preference persistence after activity restart and Bible opening offline with the option enabled. Physical-phone energy use and a signed-in two-device automatic cycle remain separate acceptance work.
