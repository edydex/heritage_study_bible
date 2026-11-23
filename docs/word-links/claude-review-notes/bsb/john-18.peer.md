# BSB John 18: independent peer review (Claude)

Checked: 40 of 40 verses (18:1-40), every `g`/`s`/`t` line, against N1904,
BSB's English and the publisher record in
`public/data/original-languages/bsb-word-links/john.json` (18:1, 18:6,
18:29, 18:31, 18:33, 18:34, 18:35, 18:37 and 18:38 have a `partial`
record). 18:10 is the KEEP verse and was not edited; the output block is
still identical to `scripts/original-languages/reviewed-bsb/john-18.json`.
Final check: `fromtext` → `{"versesOk": 40, "problems": 0}`.

## Changes (1 verse)

- 18:1: `g 12 = Kidron // Same place name; BSB's Greek text has another
  form of it.` → `g 12 = Kidron // Κέδρων here is the place name Kidron.`
  and `s 5 11` (article reason) → `s 5` (same reason) +
  `s 11 = BSB's Greek text has a different word at this point in the name
  phrase, and no English word renders this article.` No link changed.
  Reasons:
  - The publisher's comparison ignores accents, case and punctuation
    (`greek_word` in `scripts/generateOriginalLanguages.py`). The `partial`
    record (24 N1904 words, 23 matched, 24 publisher words) is one
    substituted word.
  - The publisher's own groups pair N1904 Κέδρων with its word and link it
    to "Kidron". So the name has the same letters in BSB's Greek, and the
    differing word is not the name. τῶν is the only other word of the name
    phrase, and the known variant here is the article (probably τοῦ, with
    Κεδρών as the indeclinable name, as in NA-type texts).
  - Rule 9 puts a reading in the `s`/`t` reason of the word concerned. The
    old note put it on the wrong word. The new wording does not spell the
    publisher's Greek.

## Answers to the author's doubts

- 18:15 Since on καί, δέ `s`, "also" inside "he also went": **agree,
  kept**. The καί joins two finite clauses ("was known …, and went in"). It
  is not an adverbial "also", so δέ = Since / καί = also would misread it.
  Under the When-rule the subordinator BSB creates goes on that καί. "also"
  is a fair rendering of the σύν- of συνεισῆλθεν ("went in together with").
  The reviewed John 6:22 puts "with" on the same verb (συνεισῆλθεν = had
  boarded + with). Here the publisher's "with Jesus" stays on the dative.
  Both are honest for a dative after a σύν- compound, so I did not change
  it (rule 10).
- 18:1 five tokens on "they", ἦν / ὅν `s`: **agree, kept**. In BSB's
  compression "they" refers to exactly "He and His disciples". It renders
  that subject and does not over-claim. The publisher's row (μαθηταί alone)
  left Jesus out. Precedent: the reviewed John 6:22 has οἱ μαθηταὶ αὐτοῦ =
  "they". κῆπος = a garden, εἰσῆλθεν = entered and εἰς `s` (it repeats the
  prefix) own the right words. "a garden" takes over the object role of
  ὅν, so ὅν and ἦν ("there was") are rightly `s`.
- 18:9 Οὕς = those, αὐτῶν `s`: **agree, kept**. This matches the reviewed
  John 6:39 (headless πᾶν ὅ = "those"; the resumptive ἐξ αὐτοῦ gets only
  "of") and John 17:24 (headless ὅ = "those"; the resumptive is `s`).
- 18:26 "the" on τῶν: **kept**. Reviewed precedent is split. Matthew 27:27
  ("the governor's soldiers") and 27:7, 10 ("the potter's field") put this
  "the" on the head noun's article. John 3:29 and 4:39 put it on the
  genitive's article. The publisher's row is not wrong.
- 18:28 ἵνα = to, μή = avoid, ἀλλά = and, `t unable`: **agree, kept**.
  "avoid" is how English expresses the negation of the purpose clause
  (reviewed 2 Timothy 2:14 μή = "to avoid"; Luke 18:5 μή = "stop" in a
  ἵνα clause).
  So `s` + `t` would split a real pair. "and" stands where ἀλλά stands and
  joins the two things avoided. The reviewed John 7:24 (μὴ … ἀλλά → "Stop
  … and start"), Mark 12:14 and John 13:10 also link ἀλλά to "and" in
  recast "not … but" pairs. "unable" is the English-only negation that
  turns "but eat" into "avoid … unable to eat", so `t` is right.
- 18:36 μή = prevent, παραδοθῶ = My arrest: **agree, kept**, for the same
  reason as 18:28 (negative purpose → "prevent"). "My arrest" renders the
  passive "I be handed over" as a noun.

## Points from the brief

- 18:37 ἐγώ = the "I" of "I was born": **confirmed**. N1904 (the GR line)
  ends the sentence after εἰμι, so ἐγώ is the subject of γεγέννημαι.
  BSB's wording is "For this reason I was born". εἰμι keeps "I am" with its
  built-in subject (rule 4). The `partial` record (42/41/42) shows that only
  Pilate's spelling differs. BSB's Greek has the same single ἐγώ. The
  publisher had given the whole "I was born" to γεγέννημαι and ἐγώ to the
  other "I".
- Peter's denials match the reviewed Synoptic rows. 18:17 and 18:25: ἐκ =
  of + `t one` (Matthew 26:73, Mark 14:69-70, Luke 22:58), Οὐκ εἰμί = not +
  I am (Luke 22:58), Μὴ … εἶ = Aren't (John 7:52). 18:25 and 18:27:
  denied + `t it` (Matthew 26:70, 72, Mark 14:68, 70, Luke 22:57). 18:25 δέ
  `s` + `t still`: **agree**. δέ does not mean "still". "still" is BSB's
  resumption of the 18:18 scene, so this is not a split pair.
- ἐγώ εἰμι in 18:5, 18:6 and 18:8: I + am, "He" `t` with a plain grammatical
  note, no interpretive notes. "Jesus" `t` in 18:5 and 18:6. Confirmed.
- Readings, each checked against its `partial` record and the publisher's
  groups:
  - Pilate (18:29, 31, 33, 35, 37, 38): Πειλᾶτος is in no publisher group,
    and each record has exactly one N1904 word unmatched. "Same name,
    spelled differently in BSB's Greek text" is correct.
  - 18:29 "against" `t`: 15 N1904 words, 14 matched, 16 publisher words.
    That is the Pilate spelling plus one extra publisher word. "against"
    and "Pilate" are the only English words outside the publisher's groups
    on N1904 tokens. The note does not name the extra word.
  - 18:34 "on your own": Ἀφ’ and ἑαυτοῦ are the only N1904 words without a
    publisher group (13/11/13). The notes describe a different form with
    the same meaning and do not spell it.
  - 18:6: ἀπῆλθαν is in no publisher group (13/12/13). "another form of the
    verb" is acceptable.
  - 18:1 Kidron: changed (see above).
- Also checked and kept: 18:28 δέ = "By now" (a sentence-initial connective
  slot, like the "At this" convention); 18:22 αὐτοῦ = Jesus with τῷ Ἰησοῦ =
  Him (Mark 14:67); 18:23 ἐλάλησα = I said + I spoke (verb understood
  again); 18:35 Μήτι `s` (as the reviewed John 8:22).

## 18:10 (KEEP, not edited)

I found no link error. These points are for whoever next touches it:
- ἔχων is folded into "his sword" with μάχαιραν and αὐτήν. `s` for ἔχων
  would also be defensible.
- The `s 21` reason for δέ is garbled ("does not separately express Greek
  and there").
- Two notes write "The servants" without the apostrophe.

## Still uncertain

- 18:1 `s 11` assumes that the substituted word is τῶν. This is a strong
  inference from the publisher's pairing of Κέδρων, but the record does
  not show it directly.
- 18:15 "with" on the dative (publisher) or on the verb (as in John 6:22),
  and "also" with the verb or `t`. Both are defensible. I kept the
  publisher's rows.
- 18:11 joins τῷ Πέτρῳ = "to Peter". 18:17 has τῷ `s` + Πέτρῳ = "to Peter".
  Both are honest. The difference is only one of style.
