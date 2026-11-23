# BSB John 15: independent peer review (Claude)

Checked: 27 of 27 verses (15:1-27). No verse was kept from an earlier review.
I checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher rows for John 15 in
`public/data/original-languages/bsb-word-links/john.json`, and the `partial`
counts there for every reading claim (15:8, 15:14 and 15:16 are the only
verses with a `partial` record). Precedents compared: John 12:13 and 13:16,
Matthew 19:26 and 25:2, Mark 10:31, Luke 13:34 and 19:3, John 4:12 and 6:27
(a word stated once and understood again, linked to each English repeat);
John 13:16 (μείζων = "greater than", τοῦ `s`); John 14:13 and 14:20-21 (ὅ τι ἄν, κἀγώ).
Final check: `fromtext` → `{"versesOk": 27, "problems": 0}`.

## Principle for words understood again

In this chapter I apply one rule: when Greek states a word once and leaves it
understood in the next parallel clause, and BSB repeats it in English, the
English repeat links to that stated word. This is the rule of 12:13
(εὐλογημένος = both "Blessed"), 13:16 (ἔστιν = both "is") and Matthew 19:26
(ἐστιν = "are"). A change of person or mood does not block the link: the
author already links "can" to δύναται in 15:4, although the clause it is
understood in is second person. English words that add a tense or mood the
stated Greek word lacks (here "will") stay `t`. So the two ellipses in 15:4,
the noun left out in 15:2 and the verb left out in 15:5 are now treated the
same way.

## Changes (3 verses, 4 changes)

- 15:4, link: `g 0` μείνατε = "Remain" and `t will remain` → `g 0` =
  Remain + remain#0 (note "μείνατε is understood again with κἀγὼ ἐν ὑμῖν,
  where BSB repeats remain.") and `t will` ("English supplies will; the Greek
  clause κἀγὼ ἐν ὑμῖν has no verb of its own."). Why: the clause κἀγὼ ἐν
  ὑμῖν leaves out μένω, just as οὐδὲ ὑμεῖς later in the verse leaves out
  δύναται καρπὸν φέρειν, which the author links to can / bear / fruit. Both
  gaps now follow the principle above. "will" stays `t` because the future,
  BSB's reading of the elliptical clause as a promise, is not in μείνατε.
  κἀγώ still = "and I".
- 15:2, link: `t branch#1` → `g 1` κλῆμα = branch#0 + branch#1 (note "κλῆμα
  is understood again with πᾶν τὸ καρπὸν φέρον, where BSB repeats branch.").
  Why: neuter πᾶν τὸ καρπὸν φέρον is the parallel of πᾶν κλῆμα … μὴ φέρον,
  with κλῆμα understood. Same principle as the nouns in Matthew 25:15 and
  John 6:1.
- 15:2, link: `g 17` καρπόν = "fruitful" and `g 19` φέρῃ = "make it" →
  `g 17 19` καρπὸν … φέρῃ = it + fruitful (note "καρπὸν … φέρῃ ("it may bear
  fruit") is rendered it … fruitful; BSB adds make.") and `t make` ("English
  supplies make in its recast; in the Greek the branch itself is the subject
  of φέρῃ ("bear")."). ἵνα = "to" and πλείονα = "even more" are unchanged.
  Why: φέρω means "bear", not "make". In BSB, "make" is the causative frame
  it adds when the vinedresser becomes the subject. "fruitful" carries the
  sense of the two words together ("bearing fruit"), and "it" is the branch,
  which is the built-in subject of φέρῃ (rule 4). Linking "make" to φέρῃ, and
  "fruitful" to καρπόν alone, over-claimed.
- 15:5, link: `g 1` εἰμι = "am" and `t are` → `g 1` = am + are (note "εἰμι is
  understood again with ὑμεῖς τὰ κλήματα, where BSB says are."). Why: ἐγώ εἰμι
  ἡ ἄμπελος, ὑμεῖς τὰ κλήματα leaves the stated verb understood. Matthew 19:26
  links "are" to an ἐστιν understood again in the same way. This is not the
  verbless case of 14:20, where the Greek has no verb at all. ἐγώ εἰμι is
  still linked word by word (I + am), and the note is only grammatical.

Every other line of the author's file is kept.

## Points I was asked to settle

- **15:4 "I will remain"**: κἀγώ keeps "and I". Only "will" is now
  English-only, and "remain" links to μείνατε as a word understood again.
  The principle is stated above and applied to all four gaps in the chapter.
- **15:2 "to make it even more fruitful"**: the author's link was not fully
  honest. φέρῃ owned "make", which it does not mean. The verse is now changed
  as described above. Both αὐτό (tokens 8 and 15) are correctly `s` as
  resumptive pronouns: πᾶν κλῆμα … and πᾶν τὸ καρπὸν φέρον are fronted, and
  BSB states each object once ("cuts off every branch …", "every branch that
  … He prunes"). The `s` on οὗτος in 15:5 is right for the same reason.
- **15:9 κἀγώ = so + I**: confirmed. After καθώς, καί is the correlative "so"
  (the same Greek pattern as 20:21), and ἐγώ = "I"; ἠγάπησα = have + loved.
- **15:20**: confirmed. It matches 13:16: οὐκ = No, ἔστιν = is, μείζων =
  "greater than" with τοῦ `s`, αὐτοῦ = his.
- **15:6**: confirmed. ἐβλήθη = "that is thrown", with a note that BSB attaches
  it to the branch. "he is" is `t`, because English supplies the comparison
  frame. "a branch" is on κλῆμα, τό is `s`, and αὐτά = "Such branches".
- **Readings 15:8, 15:14, 15:16**: checked against the `partial` records.
  15:8 has 14 source words and 13 matched, and the publisher's groups leave
  only γενήσεσθε unlinked. 15:14 has 10 and 9, and only ὅ is unlinked. 15:16
  has 35 and 33, with 34 publisher words, which fits ὅ τι being written
  differently. In each verse the differing word is the one BSB's English
  renders, so a same-sense link with a note is right. None of the three
  notes states the publisher's Greek wording: "a different form of this
  verb", "a different form of this relative pronoun" and "differs slightly
  here" all follow John 14 precedent.
- **ἐγώ εἰμι, μένω, ἐν ἐμοί / ἐν ὑμῖν**: every instance is linked word by
  word. No note interprets them. The only notes on these groups are the
  grammatical ones on 15:4 and 15:5 above and the article-participle note on
  ὁ μένων.

## Answers to the author's doubts

- 15:4 "will remain": now linked as a word understood again, with "will" `t`
  (see above).
- 15:2 φέρῃ: joined with καρπόν as it + fruitful, with "make" `t`, rather than
  make it + fruitful (see above).
- 15:6 "that is thrown" vs he + is thrown: kept as the author has it.
  BSB's English attaches the verb to the branch, and the note says so.
- 15:8 ἐν τούτῳ = This: kept. ἐν τούτῳ works as one phrase ("in this"), and
  BSB makes it the subject. Leaving ἐν `s` would not make the link any more
  accurate. ἐδοξάσθη = is to + glory is also acceptable as the predicate of
  the recast.
- 15:16 "that will remain" and 15:6 "that is thrown": kept. The English
  relative stands for the subject of the Greek verb in BSB's recast, so it
  goes with the verb, as in the publisher rows.

## Still uncertain

- 15:2 "it" in it + fruitful: "it" is the object of BSB's "make" but the
  subject of φέρῃ. An alternative is to make "it" `t` too and link only
  "fruitful". I kept it with φέρῃ under rule 4.
- 15:5 am + are: some reviewers may prefer the plain `t` used for supplied
  copulas. I linked it so that the chapter follows one principle and matches
  Matthew 19:26.

## Coordinator adjustment at registration

- 15:5: "are" is `t` again and εἰμι = "am" only. A supplied copula is
  English-only (README rule 7), as the supplied "am" in John 14:10 and the
  supplied copulas in John 17. The "understood again" principle above still
  applies to content words (κλῆμα in 15:2, μείνατε in 15:4).
