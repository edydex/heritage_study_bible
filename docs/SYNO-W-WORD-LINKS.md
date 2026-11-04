# Russian Synodal word links

Russian Synodal (`SYNO-W`) is included in the ongoing New Testament mapping
work. Reviewed passages connect the actual Russian wording to exact printed
Nestle 1904 Greek occurrences. The same occurrences connect Russian to BSB,
LSV and KJV, with shared colors and textures. This is phrase correspondence,
not a claim that every Russian word is a separate Greek word.

The accepted chapters are **Romans 1–6 and Colossians 1, all 190 verses**. Remaining passages
stay unreviewed and unlinked. The per-book files and manifest record the current
accepted coverage; the reader shows a chapter-specific review count. Unreviewed
words can still open the original-word chooser without guessing a match.

Each accepted resource has a full source-author review and a distinct full
semantic peer review. Reviews retain the actual Greek forms, both published
morphological analyses, Russian words, reference boundaries and documented
source-witness differences. Dictionary forms are not inferred by translating
Russian back into Greek. For example, Romans 1:17's **правда** retains the actual
righteousness lemma, and the Russian **Христова** addition in 1:16 is unpaired
where the installed Greek has no corresponding name. The whisperer word in
Greek 1:29 links to its actual Russian rendering **злоречивы** at 1:30.
Romans 2:22's opening preaching clause retains its actual Greek 2:21 reference.
In 3:26, **явится** opens the printed being infinitive, rather than an invented
appearing verb. In 4:21, **обещанное** opens the actual finite promising verb;
the translated word does not change the source's grammatical form. Other
dictionary choices within each checked phrase remain available.
Romans 5's four **более** occurrences open the actual comparative adverb while
retaining the accompanying degree adjective. The **Никак** at the end of 6:1
keeps its two actual Greek 6:2 words; Word Study opens the negative first and
retains the optative becoming verb and its own Greek grammar as a separate choice.

The Romans/Colossians grammar pilot also works through reviewed Russian links.
It describes the Greek occurrence, with Russian grammar labels available;
it does not assign Greek grammar to an unlinked Russian surface form. Grammar
expansion beyond those two books still awaits user/pastor review. Old Testament
translation-word matching has not started.

## Source and reference repair

The public-domain Russian text is the retained eBible `russyn` native source:
[edition information](https://ebible.org/find/details.php?id=russyn) and
[copyright notice](https://ebible.org/russyn/copyright.htm). The installed source
does not supply reusable occurrence-level Greek links. Restricted annotated
modules and different Russian editions are not used to manufacture these links.

Before adding word links, the NT verse remapping was corrected. The former
converter spread unequal verse counts proportionally, shifting or duplicating
text. The reviewed NT policy now uses identity references plus ten explicit
source-piece overrides. Three native verses split at exact clause boundaries;
the Romans doxology moves from native 14:24–26 to 16:25–27 without merging the
Tertius greeting. Revelation 12:18 remains explicitly absent in this source;
native 13:1 remains whole. This repair changes 89 displayed references while
preserving all 7,955 native NT verses and every source word. The 39 OT books and
both OT reference maps are preserved.

Both reference-map artifacts contain NT `sourcePieces` with exact offsets into
`SYNO-W-native.json`. Offsets are UTF-16 code units, start inclusive and end
exclusive. A reference map does not itself establish word correspondence.

## Rebuild and checks

```sh
node scripts/convert-translations.cjs --synodal-only
python3 scripts/original-languages/build-synodal-links.py \
  --reviews scripts/original-languages/reviewed-syno-w \
  --registry scripts/original-languages/syno-w-review-status.json \
  --output public/data/original-languages/syno-w-word-links
python3 -m unittest discover -s scripts/original-languages -p 'test_*.py'
node --test tests/synodal-nt-versification.test.mjs tests/synodal-converter.test.mjs
```

The builder validates the entire Russian NT against the reviewed source-piece
policy before writing. Only hash-approved resources create links. Every other
verse has an explicit unreviewed status, without inferred links or fabricated
gap explanations. Greek text, concordance metadata, and source ownership are
checked separately. Clean-checkout tests require committed review sources;
ignored local review artifacts are not build dependencies.
