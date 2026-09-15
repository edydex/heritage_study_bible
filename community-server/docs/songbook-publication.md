# Church songbook

The church workspace menu is available throughout the admin. The planner retains its compact menu; other pages use the full sidebar with the current section highlighted.

In **Song library**, click the publication dropdown in a song's row and choose a setting. It saves immediately and shows **Saving…**, then **Saved**. If the request fails, the previous choice returns with an error. You can also open a song, choose **Songbook publication**, then **Save**:

- **Published**: the public church songbook and Heritage Bible's Songs catalog show the song. English/Russian lyrics and chord text are published together.
- **Unlisted**: hidden from public browsing and search; readable by anyone with its direct link. Use **Open public copy / sharing link** to get the address, for example for choir songs.
- **Private**: neither title nor lyrics appears publicly. Existing anonymous SyncShow sharing links are revoked when this is saved. Church managers can still plan and present the song.

To change several songs, select their rows, choose **Edit → Songbook publication**, select the desired setting and save. Archived songs keep a disabled Private dropdown; open the song and restore its library status before publishing it. Publishing is a church decision; adding rights/source notes is optional. It does not upload files or private notes.

Existing songs default to Private during migration. The older SyncShow member-sharing controls remain separate. An ordinary SyncShow edit preserves the last public copy; save Published or Unlisted in the song editor to publish the revised words. Archiving withdraws the song and its existing public links. Revoked links do not reactivate when a song is published again; use the song's current public address or issue a new sharing link.

The public page searches both languages, alternate titles and authors. The Russian/English switch selects the displayed titles and alphabet. Search and language remain in the URL when opening a song and returning. Heritage Bible uses the existing `/catalogs/songs` and `/content/songs/:id` contract; refresh church resources to get publication changes. Previously downloaded offline copies cannot be recalled by the server.

Verification includes the real PostgreSQL publication/withdrawal test in `tests/songbook-publication-payload.test.ts`, plus browser checks for mobile navigation, bilingual search, individual saving and bulk editing. CI runs the isolated PostgreSQL test on every Community workflow run.
