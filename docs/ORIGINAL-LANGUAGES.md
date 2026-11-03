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

With BSB, LSV or KJV compared with Original languages—or with each other—the Greek New Testament offers
**Word links**. Six subtle background tints repeat. **Settings → B&W word links**
replaces them with patterns, including diagonal strokes distinct from dots.
Tap a word to emphasize its counterpart in both columns. **Study word**, a hold
(450 ms), or **Shift+Enter** opens occurrences while retaining the selection.
Moving a finger cancels a pending hold so scrolling is not mistaken for a word
action. The release click from a completed hold cannot immediately dismiss its
new study dialog. A reading note explains documented witness or grammar differences.

For verse-boundary differences, **Show Original / BSB / LSV / KJV** identifies the
actual matching reference rather than forcing a same-number pairing. Greek words use the source's
actual lemma metadata, including inflected forms throughout all 27 NT books.
BSB/LSV phrases with an installed correspondence look up those same Greek
lemmas. Multiple source lemmas remain separate choices. Hebrew and Aramaic
source words now use the pinned OSHB lexical identifiers across the entire OT,
including inflected and attached-prefix forms. Other English words use explicitly
labeled matching word forms. For an unlinked English word, **Study original words
in this verse** opens the complete source verse and lets the reader choose a source
word; it does not guess which source word translates the selected English word.
Tap a result to navigate to that verse.

Each original-language occurrence includes the full selected English verse
(**BSB**, **LSV** or **KJV**, with BSB as fallback). For
checked Greek correspondences, it also says **BSB · “translated phrase”** and
highlights the actual translated wording and the matching Greek form. The same
lemma can appear as “servant,” “slaves,” or “in slavery” in different contexts;
these are the publisher's row correspondences, not generated glosses or a
Strong-number guess. Repeated occurrences in one verse retain separate marks.
Unmapped words, differing editions and Hebrew/Aramaic results show the whole translated
verse with an explicit notice that an exact word match is unavailable. Other
translations' word-form searches remain labeled as such; this change does not
invent Russian/Ukrainian word alignments.

### Old Testament lemma concordance

`hebrew-concordance.json` indexes all **305,507 written source words** in all 39
books, including the 63 separately displayed Psalm headings. Its **9,521 distinct
language-specific lemma identities** preserve OSHB's homograph suffixes and
Hebrew/Aramaic distinctions. Strong's numbers use the **H** prefix; OSHB's more
specific identifiers remain visible. Attached grammatical prefix codes are omitted
when a lexical identifier exists; standalone prefix-only words retain their source
codes. These are source identifiers and occurrence matches, not invented dictionary
definitions or English word alignments.

The generator uses the same pinned, unmodified OSHB XML and reference mapping as
the reader. It checks every source word exactly once. The index keeps the exact
displayed pointing, cantillation, maqqef, written readings and source references.
Traditional qere alternatives remain separate and are not indexed as though both
written and read forms were separate written words. Nehemiah 7:68 remains absent
from this witness. Unit checks compare every indexed verse/heading and word range
against the installed source, including the reviewed verse splits and merges.
The index loads only when an OT source lemma is opened and is bundled for offline
Android use. Regenerate it with `generateHebrewOriginal.py` above.

Mappings load by book for the visible results (40 verses at a time), reuse the
parallel reader's cache and are bundled in Android. Loading failure keeps source
verses available and offers **Retry translations**. Turning off link colors or
patterns does not disable the underlying Greek lemma lookup.

No verse notes are displayed or opened by ordinary parallel taps.
Turning off correspondence colors/patterns retains word lookup. Multi-verse
selection temporarily pauses word interactions. Saved annotations are unchanged.

The generated Greek concordance has 137,779 source-word records and 5,402 distinct
lemma labels. The generator checks every word range against the exact installed
verse text and pins the same morphology file SHA-256 as the reader. Three exact
occurrence corrections in `greek-nt-metadata-errata.json` distinguish the place
name Assos (Acts 20:13–14) and the possessive pronoun in John 11:32 from lookalike
adverbs. The generated concordance retains their original annotations, corrected
annotations, reasons and primary-source citations. Raw Greek text and its source
checksum remain unchanged; unrelated lemma indexes remain stable:

```sh
python3 scripts/original-languages/build-concordance.py /path/to/Nestle1904/morph/Nestle1904.csv
npx vitest run src/services/wordStudy.test.js
```

The links come from the [publisher’s BSB translation tables](https://berean.bible/downloads.htm),
not generated translations or a Strong-number lookup. A source word may
correspond to several English words, including translator-supplied syntax.
Patterns show the publisher’s correspondence, not an assertion of one-to-one
lexical equivalence.

The importer transfers only token correspondences present in every optimal exact
sequence alignment across the publisher and installed editions. A changed verse
can retain its unambiguous phrases; ambiguous repeated words remain unlinked.
Every publisher English phrase must survive whole and contiguous. Greek matching
ignores accents, punctuation and case, with two reviewed spelling pairs:
Δαυεὶδ/Δαυὶδ and συνπαρακληθῆναι/συμπαρακληθῆναι. Accepted semantic corrections
then replace misleading publisher edges, including the three Mark 4 cases where
accent removal had confused the preposition ἐν with the numeral ἕν.

The per-book manifests record current counts, source hashes and artifact hashes.
Runtime checks require exact displayed texts and valid source/target ranges.
Tests check every shipped mapping against both editions, alongside contextual,
repeated-word and independently reviewed correction examples. Mechanical checks
and publisher provenance do not establish human review of every interpretation.
Changing BSB text or the Greek source requires regeneration and review.

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
python3 scripts/original-languages/build-concordance.py /path/to/Nestle1904/morph/Nestle1904.csv
python3 scripts/original-languages/build-kjv-links.py --osis /path/to/kjv.osis.xml
python3 scripts/original-languages/build-lsv-links.py
python3 scripts/original-languages/audit-nt-word-links.py --output /tmp/nt-word-accounting.json
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

## LSV correspondence reviews

LSV mappings are being completed chapter by chapter across all 27 New Testament
books. This work remains in progress; neither a linked-verse count nor a high
color percentage establishes complete or correct correspondence.

The reproducible base transfers exact shared BSB phrases, and preserves all
publisher correspondences when the complete displayed English word sequences
are identical. It does not guess synonyms or trust the defective eBible LSV
Strong tags. A broader lexical-scoring experiment was withheld after independent
samples found wrong articles, pronouns and repeated verbs; its proposals are not
part of the installed corpus.

`/scripts/original-languages/reviewed-lsv/` holds explicit verse reviews. Each
source token is either linked to exact English wording, accounted for at its
actual neighboring translated reference, or given a specific explanation for a
real witness difference or unexpressed grammatical word. Supplied English words
also have explicit explanations. Source and English phrase offsets are compiled
from the unchanged displayed corpora. Disjoint source and target segments remain
separate; intervening words are not swept into a highlight.

`lsv-review-status.json` admits a resource to the canonical build only after
mechanical validation and a separate assistant semantic review. Accepted source
files are hash-pinned; editing one requires renewing that review entry. New draft
chapters are excluded. This is assistant review, with the reader's review still
pending, rather than a claim of human scholarly certification. The generated
index records the current accepted resources and reviewed-entry count, including
source-only boundary records whose English counterpart is at another reference.
The compiler also uses the exact occurrence's article identity to reject a sole
Greek article linked to English `is`, `are`, `was` or `were`. Such an auxiliary
belongs with an actual predicate or needs a supplied-copula explanation. Complete
nominal constituents remain supported; this guard does not invent a substitute
verb or replace semantic review.

The source witness reference is an explicit part of an anchor. For example,
Philippians 1:16–17 is transposed between LSV and N1904; John and Romans also move
clauses across verse boundaries. The reader joins exact original token identities
across these references and shows the actual matching reference. It never changes
the named Greek source to agree with a translation. Source-lemma lookup retains
those original references, even from an English word in a different verse.

The generic compiler also supports hash-pinned `reviewed-bsb/` and `reviewed-kjv/`
corrections. The LSV build stages accepted BSB corrections before deriving shared
phrases and promotes them only after review validation succeeds. The KJV builder
applies its own accepted registry. KJV Philippians
3:21 corrects a publisher's pronoun assignment: the actual genitive **His** is
linked to **his**, while the longer witness's **that it may be** is explicitly
unpaired. Publisher data is source evidence, not a guarantee against semantic
annotation errors. See [KJV sources and reproduction](KJV-WORD-LINKS.md).

`audit-nt-word-links.py` counts actual original identities and every English
word across the entire NT, including references with no same-numbered Greek
verse. Each word is mapped, explicitly explained as unpaired, or unresolved.
Moved clauses count at their actual source reference. Linked verses, mapped word
percentages, and fully reviewed verses are reported separately. An unresolved
word is not automatically classified as a witness difference or omitted grammar.

All mappings retain Covenant Press attribution and CC BY-SA 4.0 for the LSV
adaptation. The Old Testament phrase-mapping phase has not started; it follows
the reader's New Testament review.

### LSV paragraph source audit

The existing importer uses `englsv_vpl`. Its bundled `englsv_about.htm` explicitly
says formatting and paragraph breaks were removed. The richer archive at
<https://ebible.org/Scriptures/englsv_usfm.zip>, inspected October 7, 2026, has
66 book files, 1,189 chapters and 1,189 `\p` markers, each at a chapter start.
It contains no paragraph markers within chapters and no `\q`, `\m` or `\b`
markers. Archive SHA-256:
`1944530ca36074c5666060ad8ba9345c2db4a9b841c318cc14446539a58e4618`.
There are no recoverable source paragraph breaks to import. This change does
not infer paragraph divisions from another translation or alter LSV wording.
