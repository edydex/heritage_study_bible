# LSB and NASB passage lookup

Community's **Add slide → Scripture** palette offers **LSB** and **NASB95** alongside BSB, Russian Synodal and installed editions. The same selections work for sermon passages. No API key is needed for these public lookup sources.

Choose the edition for each screen, enter a reference such as `John 8:31-32,44`, and add it. Only the requested verses are included. Saving the service keeps the exact verse text, edition, attribution and content checksum in its existing portable document; reopening or projecting it does not fetch the passage again. Edits and omissions affect the presentation copy while the original pinned text remains intact. Source links are retained in the item's operator notes.

## Sources and integrity

- **LSB (2021):** the [official reader](https://read.lsbible.org), through its public `/ref-tagger?ref=…` page used by the [LSB website tagger](https://lsbible.org/lsb-tagger/). The adapter parses inert JSON/HTML, validates the requested reference and every canonical verse identifier, and removes footnote markers, headings and verse-number labels.
- **NASB 1995:** the full [Biblia reader](https://biblia.com/bible/nasb95) linked by [Logos RefTagger](https://www.logos.com/reftagger). The tooltip service truncates ranges and even long individual verses, so the importer uses the full reader pages. Nonsequential selections are fetched as separate contiguous ranges. Edition, book, chapter, every verse marker and completeness are checked. Footnotes, headings, parallel-version teasers and Expand buttons are excluded. Small-cap LORD is preserved.
- An installed authorized edition with the same identifier takes precedence. An integrity failure in an installed edition never silently switches it to an online source.

These are adapters to public reader responses, not a claim of a separately supported or guaranteed JSON API. No provider script executes in the app. Requests are bounded by a deadline and response-size limit; canonical redirects must stay on the same provider origin. Missing, reordered, substituted or truncated text fails the entire addition. Existing service slides are unchanged. Upstream markup changes require updating the adapter and its contract tests.

Tests use synthetic text. Live rehearsal fetches only small selected passages; full Bible data, accounts and keys are not included in the repository. This browser-server change does not require building a new SyncShow installer because it uses the existing pinned-passage format.

## Attribution and quotation terms

The planner exposes the full notices under **Scripture sources & copyright**, with links to the publishers. Projected passages retain the edition abbreviation. NASB95 is explicitly the 1995 edition, not NASB 2020.

The [LSB quotation policy](https://lsbible.org/permission-to-quote-the-lsb/) and [NASB quotation policy](https://www.lockman.org/permission-to-quote-copyright-trademark-information/) permit limited slide quotations. Their general allowance is up to 1,000 verses, excludes an entire Bible book, limits the quoted proportion of the work, and limits storage in an electronic retrieval system. Online lookup does not install a whole translation. Wider use and accumulated archives beyond the general allowance need the publisher's permission. The original authorized full-edition import workflow remains available separately.

API.Bible and its account-based licensing are not used by these adapters. The earlier foolishandweak.org setup uses NASB95 RefTagger; that helped identify the public reader route.
