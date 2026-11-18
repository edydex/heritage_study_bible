# Greek brief English glosses

This separate dictionary resource supplies a brief **general English gloss**
beside an actual Greek lemma. It does not choose the meaning of a verse,
translate the current inflection, generate an explanation, or rank contextual
translation frequencies. The original morphology and word correspondences are
unchanged. No Russian lexical gloss has been sourced; the resource explicitly
declares `language: "en"`, including when used by a Russian interface.

## Publisher and licence

- **STEPBible**, *Translators Brief Lexicon of Extended Strongs for Greek*
  (TBESG), [pinned publisher file](https://github.com/STEPBible/STEPBible-Data/blob/5de0a47f35f0fc13dfe1430d104e5db8a4285f9c/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt).
- Revision: `5de0a47f35f0fc13dfe1430d104e5db8a4285f9c`.
- Publisher bytes SHA-256:
  `734a5b64a1152f67604bf09d32f15c0ba537151961752fcf168087b41b4d93ea`.
- **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.
- Required attribution is retained in the public asset and returned by the
  loader: **Tyndale House, Cambridge and STEPBible.org**, with links to
  [STEPBible](https://www.stepbible.org) and the
  [publisher data repository](https://STEPBible.github.io/STEPBible-Data).

The publisher credits its brief `Gloss` field to Tyndale scholars. The longer
brief-lexicon definitions derive from edited Abbott-Smith, supplemented by
Middle Liddell or STEPBible scholars. Only the `Gloss` column is extracted;
definitions, biographical material and unrelated concept descriptions are not
included. The source file is retained in ignored audit storage rather than
committed as a second complete lexicon. The publisher permits filtering and
reformatting for applications and requests attribution, links and a notice of
changes. Those requirements are recorded in the asset's `source` object.

## Exact identity and coverage

`build-brief-glosses.py` iterates all **5,402 actual N1904 concordance lemmas** in
their existing order. It matches a publisher headword and at least one of that
lemma's actual base Strong numbers. Headwords use **Unicode NFC only**: no
accent stripping, lowercasing, homograph-suffix removal, spelling substitution,
or first-Strong fallback. Comma-separated publisher headword alternatives are
treated as individually printed headwords. Leading/trailing field whitespace
is trimmed. A blank headword or gloss supplies no usable lexical entry.

All distinct publisher glosses for the exact identity are retained in source
order. Distinct general senses are not resolved from the current verse. Each
stored match retains its base Strong number, publisher disambiguated Strong
identifier, and original English gloss.
Missing identities remain explicit `unavailable` entries, and the API returns
`null` for them. Canonically equivalent Greek accents can match; different
accents or case cannot. The complete normalized Strong-number set is part of
the stored identity. A caller may pass the actual pilot's smaller subset of
those IDs; every requested ID must belong to the exact concordance lemma, and
only publisher matches for those requested IDs are returned. For example,
pilot `ὅστις` uses G3748 whereas the full concordance also lists G3755; the
pilot's G3748 request remains available, but an unattested G3755-only request
does not receive the other number's gloss. A substituted unknown ID is refused.

Coverage is **4,945 available**, **457 unavailable**; **60** available entries
retain more than one publisher gloss. Availability is not a claim that all
possible meanings are listed. Source and concordance inventories are pinned.
In particular:

- `ῥύομαι`, G4506: publisher gloss `to rescue`.
- `κατοικέω`, G2730: publisher gloss `to dwell`.
- Actual N1904 `κατοικίζω`, also annotated G2730, remains unavailable: TBESG
  distinguishes its `κατοικίζω` entry as G6052. Shared G2730 is insufficient
  lexical identity, and this feature does not alter the source annotation.

The grammar pilot is still independently limited to Romans and Colossians;
this lemma dictionary can serve the rest of the concordance without creating
new word links or grammar analyses.

## Reproduction and checks

Download the exact pinned publisher file to ignored storage, preserving its
bytes. For example:

```sh
curl --fail --location 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/5de0a47f35f0fc13dfe1430d104e5db8a4285f9c/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt' --output artifacts/nt-word-links-20261102/source-downloads/STEP-TBESG-5de0a47.txt
python3 scripts/original-languages/build-brief-glosses.py artifacts/nt-word-links-20261102/source-downloads/STEP-TBESG-5de0a47.txt
python3 scripts/original-languages/build-brief-glosses.py artifacts/nt-word-links-20261102/source-downloads/STEP-TBESG-5de0a47.txt --check
python3 -m unittest discover -s scripts/original-languages -p test_brief_glosses.py
npx vitest run src/services/greekBriefGlosses.test.js
```

The generator refuses a different source hash, validates the N1904 source,
and records a digest of the exact lemma inventory. `--check` verifies output
bytes without writing. Fixture tests run without network or the full ignored
publisher source. The loader validates the pinned source, inventory shape,
unique identities and availability counts. It caches one fetch, retries after
failure, and rejects malformed data. Callers must catch a gloss fetch failure
separately so the existing grammar pane remains usable.

Public API:

```js
loadGreekBriefGloss(lemma, strongs)
// null, or { language: 'en', glosses: [...publisherStrings], source: {...} }
```

`source` retains the title, pinned URL, revision, source SHA-256, licence and
licence link, attribution and filtering/reformatting notice. Use text rendering
for publisher strings and retain the source credit in the interface.
