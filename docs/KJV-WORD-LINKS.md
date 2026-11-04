KJV New Testament links come directly from CrossWire's KJV OSIS word markup. The publisher's `src` positions, inflected `lemma.TR` Greek forms and Strong identities identify the actual source words behind each English phrase. The generator compares that ordered TR witness with the app's pinned Nestle 1904 witness. It accepts a correspondence only when the exact Greek form and Strong identity agree and the pair occurs in every optimal monotone sequence alignment. Accents, breathing marks and iota subscripts are normalized before case folding; different inflected forms remain distinct.

The installed KJV is retained. Exact English words are aligned by the same mandatory sequence rule, allowing unchanged phrases through minor printing differences while refusing changed words or ambiguous repetitions. Supplied English words outside publisher word tags, colophons, next-book headings, cross-verse source positions and unmatched textual variants do not gain invented Greek links. A publisher phrase with separated English or Greek pieces uses `targetRanges` or `sourceRanges`; its intervening words keep their own correspondence. `target` and `source` retain their first segments for schema-1 compatibility. A single Greek compound/numeral may retain several component Strong identities. A genuinely inconsistent Strong array is skipped individually, with neighboring links required to agree across every compatible missing identity assignment and an unmatched-witness possibility.

The manifests record current groups and linked references across all 27 NT books. Hash-pinned reviews correct publisher annotation errors, including swapped pronoun occurrences; the original publisher baseline is not semantic certification. The word-accounting audit includes **all** installed KJV NT references, including those without a same-numbered N1904 verse. It distinguishes mapped words, explicitly explained unpaired words and unresolved words. Missing same-numbered verses such as 3 John 1:15 and Revelation 12:18 require review of the actual neighboring English counterpart. They are not evidence that the words are absent from the translation. Genuine witness differences must remain explicitly unpaired.

The concordance applies three documented occurrence-specific annotation errata before positional matching. Its artifact hash and errata hash are pinned in KJV provenance in addition to the unchanged raw Greek source checksum. The accepted correction registry is `scripts/original-languages/kjv-review-status.json`; unreviewed drafts are excluded.

Philemon has a complete verse-by-verse review in both BSB and KJV, including
existing publisher links, missing counterparts and all unpaired wording. The
review keeps such differences as KJV's plural “we have” versus N1904's singular
“I had,” and its closing “Lord” versus the printed “Christ.” Shared recipients,
repayment objects and greeting predicates retain their actual original
references across verse boundaries. The KJV subscription after the closing
verse is explicitly explained as absent from the pinned Greek; its Rome and
Onesimus wording does not acquire invented source anchors. Browser cases check
these differences and the word-study paths through the actual shipped data.

James has a complete assistant author-and-peer review in both BSB and KJV;
reader review remains pending. In James 4:5, N1904's causative κατοικίζω and
KJV's intransitive dwelling reading remain separate despite sharing Strong's
2730 ([causative entry](https://www.billmounce.com/greek-dictionary/katoikizo),
[dwelling entry](https://www.billmounce.com/greek-dictionary/katoikeo)). In
James 2:16, BSB's singular him/his retains the two distinct original plural
recipient occurrences, with the number and grammatical-role changes recorded.
The affliction/mourning/weeping words displayed at 4:9 retain their actual
N1904 4:8 references. None of these reviews adds a passage interpretation.

The complete reviews of 1 Peter cover both BSB and KJV. KJV's repeated “let it be”
in 3:4 retains the one actual Greek imperative in 3:3, shared across the
immediate contrast. The gentleness and fear qualification displayed at the end
of 3:15 retains its actual N1904 3:16 references. The Christ/God difference in
3:15 remains unpaired. Browser checks exercise the repeated predicate, that
named-reading difference, and the moved qualification's word-study source.
In 4:15, one actual comparison word governs the three repeated English “as”
phrases; the following contrast retains the earlier actual suffering predicate.
Grammar notes distinguish the pinned analyses from a homographic reading where
needed, including the command in 5:12, without changing the Greek source data.

The complete reviews of 2 Peter cover both BSB and KJV. In 2:17, KJV “mist”
matches BSB “Blackest” through the actual gloom noun, keeping the separate
weather “mists” occurrence distinct. In 3:10, N1904's finding predicate under
BSB “laid bare” remains separate from KJV's burning reading. All supplied words
and source differences retain explicit explanations.

All five chapters of 1 Thessalonians also have separate author and peer reviews
in both translations. The continual-remembering adverb displayed
at 1 Thessalonians 1:3 retains its actual N1904 1:2 occurrence. A browser case
checks BSB “continually” against KJV “without ceasing,” preserves that reference
in word study, and keeps the distinct “always” occurrence separate. Another case
checks the actual walking subject behind BSB “urging you to walk” against KJV
“ye,” without selecting the distinct encouragement or calling recipients.
The KJV subscription and trailing next-book heading remain explicitly unpaired
paratext; these words receive no invented Greek anchors.

All three chapters of 2 Thessalonians have complete author and separate assistant
peer reviews in both translations. The actual power noun behind “mighty” and
activity/efficacy noun behind KJV “strong” and BSB “powerful” retain separate
study anchors from “angels” and “delusion.” The one recompense predicate in 1:6
also supplies BSB's coordinated “grant” in 1:7, preserving its actual reference.
In 2:7, KJV's “letteth” and immediate “will let” resumption share the actual
present restraining participle; BSB's added “continue” remains explained as
supplied wording. Neither rendering changes the Greek tags to future. The
unlike receiving participants in 3:6 and closing KJV subscription remain
explicitly unpaired. Browser checks cover these distinct heads, shared
predicates, matching colors and finger tap/hold word study.

The source is [CrossWire KJV](https://gitlab.com/crosswire-bible-society/kjv) revision `d490be7e34762deb2c76cb2c1306d4808e27890d`, file [`kjv.osis.xml`](https://gitlab.com/crosswire-bible-society/kjv/-/blob/d490be7e34762deb2c76cb2c1306d4808e27890d/kjv.osis.xml), SHA-256 `4bcbfe45722fca396adbeac9c81025bbb173cb1e30296da90864f0400cb0e3f5`. Its [module configuration](https://gitlab.com/crosswire-bible-society/kjv/-/blob/d490be7e34762deb2c76cb2c1306d4808e27890d/kjv.conf) identifies version 3.1, credits the KJV2003 Project, CrossWire Bible Society and Maurice A. Robinson's TR data, records `DistributionLicense=GPL`, and grants use of the project text for any purpose. The generated provenance retains those terms and credits; it does not relabel the source as CC0.

To rebuild, download the pinned OSIS file and N1904 morphology, then run:

```sh
python3 scripts/original-languages/build-concordance.py /path/to/Nestle1904.csv
python3 scripts/original-languages/build-kjv-links.py \
  --osis /path/to/kjv.osis.xml --audit /tmp/kjv-links-audit.json
python3 scripts/original-languages/audit-nt-word-links.py --output /tmp/nt-word-accounting.json
node --test tests/kjv-word-links.test.mjs
```

The generator refuses an unreviewed source hash. Tests check all installed texts, artifact hashes, offsets and split ranges, plus repeated words in John 1:1, the differing book/tree reading in Revelation 22:19, cross-verse Romans 1:3 markup, a split verb in Matthew 1:19, an actual inflection difference in Mark 14:44, publisher-array errors, and exhaustive short-sequence ambiguity cases.

During this work, Romans 8:1 was found empty in both generated KJV formats and the vendor KJVPCE source. It was restored from the pinned CrossWire verse in all three locations, so regeneration preserves it. The N1904-absent ending remains unpaired. [`KJV-text-repairs.json`](../scripts/bible-sources/KJV-text-repairs.json) records the repair and three remaining OT empty verses (Joshua 15:1, Job 7:1 and Hosea 8:1), which are reserved for the separate OT source review.
