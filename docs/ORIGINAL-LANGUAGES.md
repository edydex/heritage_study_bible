# Original languages in parallel reading

Choose **Original languages** in the Parallel Bible selector. This first source
package contains the complete Greek New Testament (27 books, 260 chapters,
7,943 verse records), from **Nestle 1904**, as transcribed by Diego Renato dos
Santos and supplied by Biblical Humanities. The source edition is visible in the
reader. This is not the Septuagint and is not a claim to possess the lost
physical manuscripts written by the biblical authors.

The product direction is Hebrew where Hebrew, Aramaic where Aramaic, and Greek
where Greek. Hebrew and Aramaic text are not installed in this increment. Their
future import needs an explicit edition, right-to-left rendering, language
boundaries, and checked mapping from Hebrew verse numbering to the app’s
canonical references. Do not fill those books with a Greek OT translation as a
substitute. The Septuagint can be a separate named translation later.

## Romans word links

With BSB as the main text and Original languages as the parallel, Romans offers
**Word links**. Six small underline patterns repeat. Hovering, keyboard focus or
tapping identifies the exact corresponding Greek word and English phrase on
both sides. Switching off Word links restores ordinary word taps for verse
notes; selecting multiple verses pauses interactive links. The link display
does not alter Scripture text, note/highlight offsets or saved annotations.

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

Current pinned data has **5,187 word/phrase groups across 376 Romans verses**.
**56 Greek-source verses have no links** because an edition’s wording differs.
No mapping is guessed in those cases. Other NT books display the Greek text
without word links. Changing BSB text or the Greek source requires regenerating
and reviewing the alignment artifact.

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
  --berean /path/to/bsb_tables.tsv
npx vitest run src/data/originalLanguages.test.js src/components/WordLinks.test.jsx src/components/VerseText.test.jsx
npm run build
```

The Greek input hash must match the pinned source. A deliberate source upgrade
requires reviewing and updating the generator’s commit/hash, not merely passing
a different file. The generated files are in `public/data/original-languages`.
