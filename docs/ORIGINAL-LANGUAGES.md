# Original languages in parallel reading

Choose **Original languages** in the Parallel Bible selector. The reader names the actual source witness: **Westminster Leningrad Codex / Open Scriptures Hebrew Bible** for Hebrew and Aramaic, and **Nestle 1904** for the Greek New Testament. These are named textual editions, not a claim to possess the authors' lost physical manuscripts. The Septuagint is an ancient Greek translation of the Old Testament and can be a separate named option later.

The NT package contains 27 books, 260 chapters and 7,943 verse records. The OT package contains all 39 books and 23,144 mapped verse records, with Hebrew/Aramaic language labels from OSHB morphology and right-to-left display. The exact written reading remains in the verse; traditional read-aloud alternatives (**qere**) appear separately, never concatenated as though both were spoken text. Pointing and cantillation are preserved without Unicode normalization; morphological slashes are display separators and are removed.

## Hebrew and Aramaic source

Pinned source: [Open Scriptures Hebrew Bible](https://github.com/openscriptures/morphhb/tree/3d15126fb1ef74867fc1434be1942e837932691f/wlc), commit `3d15126fb1ef74867fc1434be1942e837932691f`. The XML identifies WLC 4.20. WLC text is public domain; OSHB metadata is CC BY 4.0. **Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb**. Our adaptation removes morphology slashes, separates reading notes, labels languages and maps references for BSB comparison. The source license is retained in `scripts/original-languages/OSHB-LICENSE.md`.

The generator validates the pinned, unmodified source and records every source-file hash. It accounts for all **305,507 written source words** exactly once across mapped verses and separate headings. The 269 verse records containing Aramaic include mixed Hebrew/Aramaic boundaries, such as Daniel 2:4 and Genesis 31:47. Mixed verses retain both labels.

OSHB's VerseMap supplies full WLC-to-KJV mappings; BSB's different partial boundaries are explicitly handled rather than assuming KJV numbering is identical. Full merge cases are 1 Samuel 20:42, 1 Kings 22:43, 1 Chronicles 12:4 and Numbers 26:1. BSB keeps WLC's full boundaries at 1 Kings 18:33–34, 20:2–3 and 22:21–22. Isaiah 63:19 / 64:1 splits before source word `23sJ1` (לוּא); Psalm 13:5–6 splits before אָשִׁירָה. Source references remain visible. Hebrew title verses in 63 Psalms are displayed separately, not folded into English verse 1. Where a title and body share one source verse, the witness's complete verse is preserved.

**Nehemiah 7:68 is absent from this WLC witness.** The parallel shows that absence; it does not copy Hebrew from Ezra or invent a replacement. Other source verses are checked against the app's BSB chapter/verse reference set. This reference mapping supports comparison, not word-level Hebrew-to-English equivalence. Primary editions marked with Western numbering (including SYNO-W) use the same mapped references. With a different numbering system such as UKRK, the primary text remains visible but the source column is left empty with an explanation; no unverified mapping is implied.

OT books load individually when opened, so enabling Genesis does not fetch the entire Hebrew Bible. Failed source loading leaves the primary text readable and does not substitute Greek. The APK bundles the static source files for offline use.

To reproduce from an unmodified pinned OSHB clone:

```sh
python3 scripts/generateHebrewOriginal.py --oshb /path/to/morphhb
npx vitest run src/data/hebrewOriginal.test.js
```

## Greek New Testament word links and occurrences

With BSB as the main text and Original languages as the parallel, the Greek New Testament offers
**Word links**. Six subtle background tints repeat. **Settings → B&W word links**
replaces them with patterns, including diagonal strokes distinct from dots.
Hold a word (450 ms) or press **Shift+Enter** to identify its checked counterpart.
Moving a finger cancels the hold so scrolling is not mistaken for a word action.

Tap or press Enter on a word to open occurrences. Greek words use the source's
actual lemma metadata, including inflected forms throughout all 27 NT books.
BSB phrases with an installed correspondence look up those same Greek
lemmas. Multiple source lemmas remain separate choices. Other translations use
explicitly labeled matching word forms; Hebrew/Aramaic currently searches the
open book, not an unimplemented whole-OT lemma index. Tap a result to navigate to
that verse.

Each original-language occurrence now includes its full **BSB** verse. For
checked Greek correspondences, it also says **BSB · “translated phrase”** and
highlights the actual translated wording and the matching Greek form. The same
lemma can appear as “servant,” “slaves,” or “in slavery” in different contexts;
these are the publisher's row correspondences, not generated glosses or a
Strong-number guess. Repeated occurrences in one verse retain separate marks.
Unmapped words, differing editions and Hebrew/Aramaic results show the whole BSB
verse with an explicit notice that an exact word match is unavailable. Other
translations' word-form searches remain labeled as such; this change does not
invent Russian/Ukrainian word alignments.

Mappings load by book for the visible results (40 verses at a time), reuse the
parallel reader's cache and are bundled in Android. Loading failure keeps source
verses available and offers **Retry translations**. Turning off link colors or
patterns does not disable the underlying Greek lemma lookup.

No verse notes are displayed or opened by ordinary parallel taps.
Turning off correspondence colors/patterns retains word lookup. Multi-verse
selection temporarily pauses word interactions. Saved annotations are unchanged.

The generated Greek concordance has 137,779 source-word records and 5,401 distinct
source lemma labels. The generator checks every word range against the exact
installed verse text and pins the same morphology file SHA-256 as the reader:

```sh
python3 scripts/original-languages/build-concordance.py /path/to/Nestle1904/morph/Nestle1904.csv
npx vitest run src/services/wordStudy.test.js
```

The links come from the [publisher’s BSB translation tables](https://berean.bible/downloads.htm),
not generated translations or a Strong-number lookup. A source word may
correspond to several English words, including translator-supplied syntax.
Patterns show the publisher’s correspondence, not an assertion of one-to-one
lexical equivalence.

The importer requires the entire verse’s Greek token sequence to match the
chosen Nestle edition (ignoring accents, punctuation and case), and the entire
English token sequence to match the bundled BSB wording (ignoring case and
punctuation). It leaves differing verses unlinked. Runtime checks also require
exact displayed texts and valid character ranges before showing any links.

Current pinned data has **94,788 word/phrase groups across 6,596 NT verses**.
**1,347 Greek-source verse records have no links** because a Greek or English
edition's wording differs. The original Romans subset remains byte-identical:
5,187 groups across 376 verses, with 56 unlinked verses. No mapping is guessed
in these cases. The per-book files and index include counts, source hashes and
artifact hashes. Tests check every shipped mapping against both installed texts,
plus contextual and repeated-word examples. These checks establish source
correspondence, not a human review of every lexical interpretation. Changing
BSB text or the Greek source requires regenerating and reviewing the artifacts.

## Sources and licensing

- [Nestle 1904 morphology dataset](https://github.com/biblicalhumanities/Nestle1904/tree/713f28a3b7d4d66132f5aa809fa223fe79762e5d/morph),
  commit `713f28a3b7d4d66132f5aa809fa223fe79762e5d`. The base text is public
  domain; this morphology dataset is dedicated under CC0. Credit: Eberhard
  Nestle; Diego Renato dos Santos; Ulrik Sandborg-Petersen; Maurice A. Robinson;
  Biblical Humanities. Only its `morph/Nestle1904.csv` is used, not the separately
  licensed XML markup or glosses. This pins the repository’s edition, rather
  than implying it is the latest transcription on the author’s website.
- [BSB translation tables](https://bereanbible.com/bsb_tables.tsv).
  [Berean’s public-domain terms](https://berean.bible/terms.htm) apply to the
  published tables/text. The generated artifact records the source download’s
  SHA-256 and the exact bundled BSB file hash.
- [Diego Santos’s source description](https://sites.google.com/site/nestle1904/).

The data files contain source/rights metadata and cryptographic hashes. They
are fetched only when the parallel is opened; no source text is sent to an AI
service. The website’s existing data cache can retain them after use, and the
Android build bundles the static data.

## Rebuild

Download the pinned repository and the publisher TSV. Then, from this repo:

```sh
python3 scripts/generateOriginalLanguages.py \
  --nestle /path/to/Nestle1904/morph/Nestle1904.csv \
  --berean /path/to/bsb_tables.tsv --all-nt-links
npx vitest run src/data/originalLanguages.test.js src/services/wordStudyTranslations.test.js src/components/WordLinks.test.jsx src/components/VerseText.test.jsx
npm run build
```

The Greek input hash must match the pinned source. A deliberate source upgrade
requires reviewing and updating the generator’s commit/hash, not merely passing
a different file. The generated files are in `public/data/original-languages`.

## Verification of the Hebrew/Aramaic increment

All 271 reader unit tests and 124 protocol tests passed. Chromium and Firefox
each passed five focused browser cases covering book/source switching, Hebrew
and Aramaic direction, Psalm headings, qere notes, missing Nehemiah 7:68, and
the visible BSB audio marker in phone parallel mode. The production web build
passed. The generator checks all written source-word identities and output
hashes; these checks do not establish word alignment with every translation.
Physical-phone and e-ink acceptance, deployment and a new APK remain separate.
