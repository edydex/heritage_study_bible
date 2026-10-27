# Song authoring and workspace activity

Song creation is a single page: Russian and English titles, matching lyric columns, then authors. Lyric and chord fields grow with their text. Blank lines separate projected slides; a named refrain must be defined before its name is used on its own to repeat it.

**Add Chords** reveals the two chord sheets. Existing sheets use **Show chords**; hiding them preserves their contents. **More** contains alternate titles, description, default presentation language, tags, music settings, files and source/permission notes. Permission notes remain informational.

The church is assigned from the installation and checked against the manager’s membership. New web address names follow the English title until edited manually. Renaming an existing song preserves its link and sync identity.

**Songbook publication** offers Published, Unlisted, Private and Archived. Restoring an archived song uses the same menu. Public content still uses the explicit publication snapshot; ordinary lyric edits do not silently replace an earlier public copy.

Migration `20261002_000000_retire_song_member_sharing` clears retired visibility and receipt pointers, retains the current Songbook publication choice and snapshot, preserves song content and identities, and increments affected sync versions. Immutable historical receipts stay private. Rollback restores only unchanged normalized rows. Cached clients receive a retirement response from the old endpoint; discovery no longer advertises it.

Workspace home includes **Recent workspace activity**. Signed-in workspace managers record coarse screen names and server timestamps on navigation, with a throttled heartbeat during visible, recent interaction. Hidden tabs stop immediately; five minutes without interaction stops heartbeats. One current record per person/church keeps storage bounded. Authentication pages, URLs, document IDs, search queries, field values and document text are excluded. Activity failure does not block authoring. The panel shows the last hour and reports failures explicitly; a lack of records alone cannot prove that all clients are idle.

Activity is stored on the church server. This does not connect Heritage to a PostHog project or enable session recordings.

## Verification

- `npm run typecheck`
- `npm run test:editor`
- `npm run test:syncshow`
- `npm run test:song-editor-live`: opt-in actual Payload/PostgreSQL rehearsal. Requires `DATABASE_URL` and `HERITAGE_SONG_EDITOR_TEST_DATABASE` to equal a loopback `heritage_song_editor_test` URL, and `HERITAGE_DISPOSABLE_CI=song-editor-rehearsal`. Bootstrap the `song-editor-ci` installation in that disposable database first. The test rehearses normalization and guarded rollback and must never target an existing church database.
- Browser acceptance: create/save/reopen bilingual lyrics, manual/automatic addresses, authors, hidden chords, archive/restore, More, Russian menus and narrow-screen layout. Confirm navigation appears in the home activity panel.
