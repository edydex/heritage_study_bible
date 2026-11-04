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
**Word links**. Each distinct checked correspondence has its own tint within a
verse, plus a shared background texture: diagonal strokes, dots, horizontal or
vertical lines, crosshatching, grids or rings. Nearby matches favor different
colors and textures using the actual ordering in both translated columns and
the original. Words translated together share the same combination, including
counterparts at another verse reference. Uncertain words remain uncolored.
**Settings → B&W** retains the six monochrome underline patterns. Light and dark
fills preserve text contrast, and saved text highlights keep their own colors.
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

Each original-language occurrence includes the full selected translated verse
(**BSB**, **LSV**, **KJV**, or **Russian Synodal**, with BSB as fallback). For
checked Greek correspondences, it also says **BSB · “translated phrase”** and
highlights the actual translated wording and the matching Greek form. The same
lemma can appear as “servant,” “slaves,” or “in slavery” in different contexts;
these are the publisher's row correspondences, not generated glosses or a
Strong-number guess. Repeated occurrences in one verse retain separate marks.
Unmapped words, differing editions and Hebrew/Aramaic results show the whole translated
verse with an explicit notice that an exact word match is unavailable. Other
translations' word-form searches remain labeled as such; this change does not
invent Russian/Ukrainian word alignments.

### Romans and Colossians grammar pilot

**Word form here** describes the selected Greek occurrence, reached directly
from Original or through a checked **LSV**, **BSB** or **KJV** word link. It shows
the actual form, dictionary form (lemma), part of speech and applicable tense /
aspect, voice, mood, person, number, case and gender. A compact grid has three
columns on wider screens and two on phones. Hover, focus or tap a term for its
short explanation in **English** or **Russian**; Escape dismisses an open explanation
before closing Word Study, including when help was opened only by hovering.
The explanation language is remembered.
Grammar belongs to that exact occurrence, rather than every occurrence of its lemma.
Device volume scrolling follows the open Word Study dialog. At its end, repeated
down presses cannot advance the Bible chapter behind it; closing the dialog
restores Bible scrolling.

The pilot preserves all **8,675 source tokens** in Romans and Colossians, including
**71 occurrences with different functional and form-oriented tags**. Both analyses
remain visible in source details; they are annotations of the same printed word,
not different textual witnesses. Unknown code parts are never guessed. The
optional Strong TVM suffix is not used because the source says it is not
synchronized with its morphology.

These are published per-occurrence tags with shared definitions of the grammar
terms. For example, the aorist definition describes an event viewed as a whole
and explains what the tag itself establishes. Word Study provides forms,
dictionary resources, grammar, occurrences and translation correspondence;
passage interpretation belongs in Commentary. There are no passage-specific
interpretive notes or explanations generated on tap in this pilot. A lemma is a
dictionary form, not an assertion about a word's historical root or its meaning
in every passage.

**Common translation** beside the dictionary form is a brief sourced English
gloss from STEPBible TBESG. The match requires the actual Greek headword and
Strong identity; shared numbering alone cannot join different dictionary words.
Multiple source glosses remain general alternatives, and unavailable matches
are not guessed. Russian grammar labels explicitly identify the gloss as English.
Source credit, license and the filtering notice appear in the source details.
See [the glossary source and rebuild notes](../scripts/original-languages/GREEK-BRIEF-GLOSSES.md).

For **Russian Synodal**, unlinked words offer an explicit original-word chooser;
the reader selects a Greek form before seeing its grammar. Synodal verse wording
can accompany occurrence results, with no fabricated Russian word highlights.
Full Russian and Ukrainian word alignment is outside this pilot. User/pastor
review precedes grammar expansion beyond these two books; the NT mapping goal's
review boundary before OT work remains in place.

Rebuild the separate pilot artifact from the same pinned CSV as the concordance:

```sh
python3 scripts/original-languages/build-greek-morphology-pilot.py /path/to/Nestle1904/morph/Nestle1904.csv
npx vitest run src/services/greekMorphology.test.js src/services/wordStudyRussianContext.test.js
npx playwright test e2e/word-grammar-pilot.spec.js
```

Source code descriptions are retained under
`scripts/original-languages/morphology-sources/` with checksums in the generated
artifact. See [the source tagging guide](https://github.com/biblicalhumanities/Nestle1904/blob/713f28a3b7d4d66132f5aa809fa223fe79762e5d/morph/parsing.txt)
and [Mounce's discussion of the aorist and context](https://www.billmounce.com/newtestamentgreek1/exegetical-insight-chapter-23).

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

Case relations stay with their actual nominal or infinitival heads. For example,
Colossians 4:18 “by ... hand” selects the dative hand constituent, while “my”
retains its separate possessive anchor. Bounded corrections to accepted reviews
preserve the exact previous resource and a separate author-and-peer proof of
the changed groups; the registry then pins the reviewed replacement. Other
candidate constructions remain subject to individual review.

Word study retains every lemma in a checked phrase. For English content words,
the initial selection prefers the content head over a supporting Greek being
verb, article or other function word. In Colossians 2:8, clicking LSV “carrying”
opens the actual carrying participle, while “be” opens the actual future being
form. Original-language clicks continue to select their exact original word.
In negative-plus-verb phrases, English content words such as John 4:2's
“immersing” open the actual verb before the negative. Explicit negative words
such as “not,” “never,” “neither” and “without” retain their previous selection
order. Every original head remains available; this adjustment does not split
an inseparable phrase or change its source identities.

The source witness reference is an explicit part of an anchor. For example,
Philippians 1:16–17 is transposed between LSV and N1904; John and Romans also move
clauses across verse boundaries. The reader joins exact original token identities
across these references and shows the actual matching reference. It never changes
the named Greek source to agree with a translation. Source-lemma lookup retains
those original references, even from an English word in a different verse.

Acts 22:17–18 shares the one written accusative subject of its two coordinated
infinitives; the repeated English “I” keeps that actual 22:17 anchor. Acts 24:18
places the Asian Jews phrase before “found,” while N1904 prints those words at
24:19. Each linked word keeps its true 24:19 identity. The longer LSV passage in
24:6–8 has explicit witness notes, including the wholly absent Greek 24:7.

All 28 chapters of Acts now have full LSV author-and-peer correspondence
reviews. The double-bracketed LSV 28:29 remains explained as absent from N1904,
with no neighboring Greek borrowed to fill it. At 28:27, the second hearing
clause is printed in both Greek witnesses but omitted in the installed LSV and
its pinned publisher USFM; those actual source words remain explicitly
unpaired. These reviews preserve the named texts rather than silently editing
either witness.

All thirteen chapters of 2 Corinthians have full LSV author-and-peer reviews.
At 2:10, the two actual perfect forgiveness predicates retain their distinct
occurrences despite the English clause order. The final supplied forgiveness
resumption shares only its immediate real predicate. At 4:14, N1904's
with-Jesus relation differs from LSV's through-Jesus relation following printed
TR; the preposition stays explicitly unpaired while the actual Jesus name
retains its dative analysis. Differences in English expression do not change
the source tags. For example, 1:23's actual negative-temporal word is left
separate from LSV's “not ... yet”; the note distinguishes this translation
difference from a written N1904/TR variant.

The light/darkness question in 6:15 retains its original 6:14 identities. The two
equality nouns in English 8:14 remain distinct: its first is the genitive noun
from original 8:13, and its last is the local nominative noun. At 7:12, the
opposite personal roles in the installed English wording remain explicitly
unpaired; the pinned printed TR also differs from that English wording. At
9:10, the actual future predicates keep their source analyses under LSV's
"may ... supply and multiply ... increase" wording.

At 11:6, the actual active revealing participle remains separate from LSV's
different passive reading. At 12:9, the actual grace possessor is not duplicated
into the additional power and weakness possessors. The expanded chapter 13
review preserves its three previously accepted verse objects exactly, including
English 13:14's actual original 13:13 benediction reference.

Repeated words also retain their identities when clauses change order within a
verse. In 1 Corinthians 8:8, LSV puts the eating/being-in-advance condition before
the not-eating/being-behind condition; N1904 has the reverse order. The two actual
eating predicates, condition markers and negatives stay with their own clauses.
The unlike habit/conscience readings in 8:7 remain explicitly unpaired rather
than assigning the later conscience occurrence to both English words.

First Corinthians 11:24 keeps LSV's additional taking/eating and broken-body
wording explicitly unpaired where absent from the pinned witness. Its earlier
actual breaking predicate stays linked to “broke” and is not borrowed for the
added “broken.” In 13:3, the actual feeding/distributing verb supports the verbal
paraphrase, while the English recipient “others” remains explicitly supplied.

All 16 chapters of 1 Corinthians now have full LSV author-and-peer reviews.
The Greek body question in 15:35 is absent from both the installed LSV and its
pinned publisher USFM, so those original words remain studyable without an
invented English match. In 15:44, the three actual body nouns keep their separate
occurrences; LSV's fourth body noun remains explained as additional wording.

All twenty-two chapters of Revelation have accepted LSV reviews.
English 1:10's "saying" retains its original 1:11 participle. The received-from-
Father comparison at the end of English 2:27 keeps its actual original 2:28
identities; the unexpressed Father article stays an explained original word.
These reference differences do not move or retag the original text.
The two English "what" words in 3:3 retain their different actual Greek heads.
The having participle and later having finite in 4:8 retain separate occurrences
and their actual source forms. At 5:7, the local scroll noun added in the printed
TR reading remains explained as absent from N1904; the separately printed 5:8
scroll noun keeps its own occurrence.

At 6:11, “each one” retains its actual distributive word, without borrowing the
separate unexpressed recipient pronoun. At 7:1, N1904's singular demonstrative
and the printed TR/LSV plural expression remain an explained witness gap. The
continuous tribe list in 7:5–8 shares its real first sealing participle where
the translation repeats it, while the separately printed final Benjamin
participle keeps its own identity. At 8:7, the earth-burning clause absent from
LSV remains studyable in Original without borrowing the separate tree clause.
The eagle/messenger noun difference in 8:13 stays explicitly unpaired.

At the 12:18/13:1 chapter boundary, the sand and first sea keep their actual
original 12:18 references; the second sea retains its separate 13:1 occurrence.
The first-person English standing predicate stays unpaired against the actual
third-person original. In 13:10, the first English passive killing expression
does not borrow the separately printed passive infinitive later in the verse.
At 13:16, the changed giving predicate remains explained as unpaired while its
real recipient stays linked. The different guile/falsehood nouns in 14:5 keep
an explicit witness gap rather than an invented common source lemma.

The being-full participle in 15:7 keeps its actual stative head. In 16:3,
English “living” retains the actual life noun rather than importing a living
participle from the printed TR. The extra “another out of” frame in 16:7 remains
unpaired, while the actual altar noun and saying participle retain their forms.
The supplied plural English subject in 16:16 does not invent a source pronoun
or settle the actor from the singular Greek verb form.

The kings clause displayed in English 17:10 retains its actual 17:9 words,
including the second being occurrence. The final concessive present wording
in 17:8 stays separate from the actual coordinated future presence expression.
At 18:5, “reached up” retains the actual piling-to-height head, with the passive
source form and different TR head documented. The second “went away” and the
changed finding predicate in 18:14 remain explained gaps instead of borrowing
the first departure verb or inventing a second-person original.

The visible alternative in 19:17 keeps the actual banquet adjective attached
to the banquet, while the main English great-God modifier stays explained as
a different printed attachment. The repeated English banquet/God mentions
retain their single actual source identities. In 20:12, the second scroll
noun also supplies its immediate nominal resumption “that”; the different
throne/God reading remains unpaired.

English 21:4's continued God subject retains the actual 21:3 subject noun,
separate from the added final God title in English 21:3. At 21:6, the actual
plural perfect completion verb keeps its form under “is done,” while the
supplied singular “It” remains explicit. The spirits/holy difference in 22:6,
personal/demonstrative wording in 22:18, and tree/Scroll difference in 22:19
remain explained. Both real book nouns in 22:19 retain their own occurrences
and are not borrowed for the unlike middle Scroll wording.

All 27 New Testament books now have accepted LSV reviews. The full NT audit
accounts for all 137,779 Greek source words and 182,613 LSV words, with zero
unresolved words. Mapped words and explicitly explained unpaired words remain
separate categories; human reader verification is still pending.

Both Timothy letters have complete BSB and KJV author-and-separate-assistant
reviews across all ten chapters. Their 390 newly reviewed target records retain
the previously accepted BSB 1 Timothy 1:12 and 2 Timothy 1:3 entries exactly.
Repeated willing, qualification, instruction and personal-owner expressions
retain their actual earlier references. Shared source identities are declared
explicitly and distinguished from exclusively moved words. Supplied participants,
unprinted copulas and genuinely different witness clauses remain explained.
The installed KJV 2 Timothy 4:22 subscription is retained as English paratext;
it does not acquire Greek words absent from the pinned witness.

Galatians 1–2 now have full BSB and KJV author-and-separate-assistant reviews,
adding 89 reviewed target records and preserving the accepted BSB 1:23 entry
exactly. The co-crucifixion clause displayed in 2:20 retains its actual N1904
2:19 identities. The moved dative Christ remains separate from the local
nominative Christ; the repeated law nouns retain their distinct case roles.
The rest of Galatians remains outside these accepted reviews.

Fresh complete independent checks of LSV John 1–4 retain all original forms
and texts. Immediate Spirit and personal-all renderings have precise source
anchors. John 3's life noun and adjective, and Son noun and only-begotten
adjective, now have separate study links. The accusative infinitive subject
in 3:30 owns the English case phrase “[for] Him” without inventing a Greek
preposition. Notes retain actual adjective analyses and singular/plural witness
differences rather than retagging the original from English wording.
John 4 separates clear adjective/numeral/participle heads from their nouns,
including living/water, true/worshipers, own/country, seventh/hour and
whole/house. The bracketed “[for] Him” infinitive subject retains its actual
accusative pronoun. Notes distinguish the printed Greek future indicative
thirst form from the TR subjunctive and English wording, and keep the actual
compound coming verb separate from “here.” Existing witness gaps remain
explained.

Complete accounting does not establish the scope of a semantic review. An
inventory of older LSV evidence found retained full-chapter peer receipt gaps
in an initial ten-resource check; narrower correction reviews and preservation
lists are not counted as full-chapter reviews. Fresh complete source checks
are being added for those chapters. This evidence audit is continuing alongside
the remaining BSB and KJV work.

All four Philippians chapters have full BSB and KJV author-and-peer reviews.
KJV's 1:16 and 1:17
clauses retain their actual original 1:17 and 1:16 references, so the love clause
matches BSB 1:16 across the verse boundary. In 1:7, the notes distinguish the
translations' chosen "I have you" syntax from what the two Greek accusative
forms alone establish; the notes do not rule out the other grammatical reading.
BSB 1:16's repeated preaching expression uses only its immediately preceding
actual preaching predicate, with the retained local use and shared scope
declared explicitly.

English 2:8's appearance/fashion noun retains its actual original 2:7 reference.
KJV's repeated purpose connector in 2:11 shares the actual 2:10 connector and
stays separate from the local confession connector. At 2:28, BSB's “send” and
“eager” open their distinct actual sending and promptness heads. At 4:17,
“account” retains its actual noun head, separate from the preceding increase-
to-account construction recast as “may be credited to” in BSB. The actual active
participle remains unchanged. The full KJV chapter 3 resource preserves its
previously accepted 3:21 object and serialized entry exactly.

All six Ephesians chapters have full BSB and KJV author-and-separate-
assistant-peer reviews. BSB 1:4's single “us” retains both actual Greek pronoun
occurrences. Its first “Him” in 1:11 keeps the original 1:10 anchor and matches
KJV there. BSB 2:6's repeated God and first Christ retain their actual earlier
references; its second Christ keeps the distinct local occurrence. The repeated
remembering command in 2:12 retains the actual 2:11 imperative.

KJV's supplied opening quickening expression in 2:1 stays explicitly unpaired
where a hard correspondence to the later main predicate is uncertain. At 2:16,
the installed BSB “extinguished” and KJV “slain” retain the actual killing verb;
the note distinguishes the installed BSB wording from the pinned publisher
table and current official wording without inventing an extinguishing lemma.
The purpose connector and encoded ability subject displayed at the end of
KJV 3:17 retain their real 3:18 source words. Shared encoded-subject renderings
are declared separately from exclusive movement of words across references.

In 4:13, “mature” opens the actual adjective rather than an unexpressed man noun.
In 4:16, “builds ... up” retains the actual edification noun and matches KJV's
“edifying.” In 4:29, the negative and universal adjective jointly correspond
to “no”; Word Study initially selects the actual negative while retaining both
dictionary heads and precise Original-word choices.

KJV 5:13's active-agent “doth make manifest” remains an explicit translation-
role/form gap against the source's functional passive and formal nonactive
analyses. N1904 and the printed TR have the same word here. The note preserves
the shared middle/passive shape's ambiguity rather than asserting a textual
variant or settling contextual interpretation. The earlier real manifesting
finite keeps its separate English occurrence; the unpaired original participle
remains studyable.

In 6:8, the receiving/recompense head keeps its actual nonactive form under
BSB's reward construction, with the same giver/receiver roles traced through
the converse wording. In 6:14, the belt/buckled-around expression retains the
actual girding participle, not an invented belt noun. The repeated Pray in
6:19 retains the actual 6:18 praying participle; the later supplied Pray in
6:20 remains explained. BSB's “it” and KJV's “therein” share the actual
preposition/pronoun construction. Word Study opens the actual pronoun first
for “it,” while retaining the preposition and exact Original-word choices.

An English name can clarify a printed Greek pronoun; its link retains the actual
pronoun and identifies the naming as the translation's wording. When source
evidence instead documents a different printed noun/pronoun reading, the unlike
heads remain unpaired with a witness note. For example, Luke 6:10 has N1904
«to him» versus the named «to the man» reading documented in the pinned TR.
LSV USFM Strong tags do not establish these identities; some tags do not match
the words they annotate.

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
