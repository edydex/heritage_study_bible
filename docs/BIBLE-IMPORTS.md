# Church Bible translation imports

Church managers can open **Bible translations** in the workspace sidebar, choose a UTF-8 JSON file, inspect its sample verses and edition details, record their permission, and install it. **Scripture** in both service and sermon preparation then offers installed editions independently for English and Russian/stage outputs. Already saved slides keep their selected words and attribution.

The public `/bible-import-format.html` guide includes the format and a downloadable public-domain BSB sample containing Romans 1:1–3. This is a partial test edition, not a substitute for a complete Bible. Requesting a missing verse returns an error; the importer never fills it from another edition.

## Storage and access

- The full text and private permission reference live in the church database and its normal backups. Public collection REST/GraphQL access is denied, including for signed-in managers; only scoped manager endpoints can import or retrieve a selected passage. Paired SyncShow devices cannot install editions.
- Uploads require the configured church origin, an authenticated manager, a bounded request and strict version-1 validation. Source URLs are metadata and are not fetched. Imported plain text is rendered as text.
- Installed editions are immutable and identified by a canonical SHA-256 digest. Reinstalling the same edition is idempotent; changing its contents requires a new ID. Built-in BSB, LSV and SYNO-W IDs cannot be replaced. The database enforces per-church ID uniqueness.
- Service documents contain the chosen excerpts and their credits, not the complete translation. Those excerpts can travel in offline SyncShow packages, so the church's permission must cover that use and any intended streaming or distribution.

Version 1 accepts at most 24 MiB, conventional 66-book chapter numbering, explicit numeric verses and required edition/source/permission metadata. It does not read encrypted/proprietary modules, USFM or OSIS directly. The importer preserves verse strings; existing service-document normalization trims outer whitespace when pinning a passage.

## Legacy Standard Bible

The [publisher FAQ](https://lsbible.org/faqs/) directs software agreements to `info@316publishing.com`. Ask Three Sixteen Publishing for an authorized structured source and permission for Heritage Community/SyncShow, including church projection, local storage, offline service packages and livestream use as needed. No general-purpose retail LSB JSON/USFM download has been verified. A [ProPresenter purchase](https://support.renewedvision.com/hc/en-us/articles/360041814913-Installing-Bibles-in-ProPresenter) is not an established portable import source. See also the [publisher's quotation permissions](https://lsbible.org/permission-to-quote-the-lsb/). Sources checked September 21, 2026.

No LSB purchase, publisher email or copyrighted LSB import was performed. The working upload test uses public-domain BSB text.

## Verification and delivery boundaries

Local acceptance used actual migrations and a disposable PostgreSQL database. Tests cover manager/member/anonymous/device/origin boundaries, preview without writes, permission and digest checks, immutable installs, edition conflicts, hidden full text, tenant isolation, exact lookup and missing verses. The focused 25-test regression group, TypeScript and production build passed.

Chrome and Firefox exercised the production local server: upload → preview → permission → install → select edition → `Rom 1 1-3` → add slides → save. Both retained the selected words and attribution, denied anonymous catalog access, and had no narrow-screen overflow or page errors. This is local acceptance, not a WOTBC deployment receipt.

SyncShow's matching expansion adds separate Scripture credits to audience/stage native scenes and raster previews. Update SyncShow before making new credited packages; older strict scene readers reject the added credit field. Existing uncredited packages remain readable in the updated app. Standalone desktop module installation is a separate remaining step; Community-prepared excerpts already use the normal pinned passage contract.
