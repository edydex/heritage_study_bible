The BSB text imported from Scrollmapper contained joined poetry lines in Zechariah 9–13 and one joined sentence in Judges 16:14. This was present in the stored text, so it affected reading, copying, searching, and spoken-text matching.

The October 27, 2026 audit compared all 31,102 bundled BSB verses with the official [Berean Standard Bible text download](https://bereanbible.com/bsb.txt), listed on the [publisher's downloads page](https://berean.bible/downloads.htm). It found 37 verses needing 127 inserted spaces: Zechariah 9:1–17, 10:1–12, 11:1–3, 11:17, 13:7–9, and Judges 16:14. Both the combined translation and per-book downloads are corrected.

The official download is a newer printing. The audit also found 1,286 verses whose non-whitespace characters differ and 2,225 other verses with harmless spacing differences. These are preserved as the installed edition. The repair process only inserts spaces when every non-whitespace character matches the official text; it does not guess word boundaries or replace translation wording. This also keeps the existing New Testament word links and source-backed paragraph layout compatible.

The audit of sentence punctuation and lower-to-uppercase boundaries found no other joined-word candidates in the bundled English BSB, KJV, or LSV text. Comparing matching passages in edition-differing BSB verses found no further missing-space candidates. These checks cannot prove that every typographical issue in every translation has been eliminated.

To reproduce the source comparison, download `https://bereanbible.com/bsb.txt`, then run:

```sh
node scripts/auditBsbSpacing.mjs /path/to/bsb.txt /tmp/BSB-spacing-repairs.json
```

The audited download's SHA-256 is `2ac3af1de52d4e68261cba91d85c320b7eadc6560e830d99e591767b8ff5ca96`. The committed manifest at `scripts/bible-sources/BSB-spacing-repairs.json` pins that source and every corrected verse. Compare regenerated output before replacing the manifest if the publisher updates its download.

`npm run convert-translations` reapplies the reviewed corrections. It refuses to apply them when the source wording changes. `node --test tests/bible-text-integrity.test.mjs` checks all 31,102 BSB verses against the installed source, the combined/per-book copies, all 37 corrections, and the English punctuation/word-boundary regression scan.

`node scripts/bible-audio/repair-spacing.mjs` applies the corresponding normalized-text corrections to 20 accepted Zechariah audio verse spans. It keeps all verse start/end times, coverage counts, recording identities, and original forced-alignment receipts unchanged. The separate `scripts/bible-audio/spacing-repair-audit.json` records the original and corrected text with the retained boundaries; no character offsets are present in these verse-level timings.
