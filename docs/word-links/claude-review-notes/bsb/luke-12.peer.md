# BSB Luke 12: independent peer review (Claude)

Checked: 59 of 59 verses (12:1-59). I checked every `g`, `s` and `t` line
against N1904, the displayed BSB, the publisher record in
`public/data/original-languages/bsb-word-links/luke.json`, the publisher's
own rows (the untouched draft) and the reviewed parallels Matthew 5:25-26,
6:25-30, 10:26-35, 12:31-32, 16:2-3 and 24:43-51. Final check: `fromtext` →
`{"versesOk": 59, "problems": 0}`.

## Reading claims

The publisher record has a `partial` entry for 12:4, 12:21, 12:22, 12:24,
12:27, 12:53, 12:54 and 12:56 only. Every reading note in the file is in one
of these verses, and none states the publisher's spelling as fact.

- 12:4 (21 N1904 words, 20 matched, 21 publisher words) and 12:21 (9, 8, 9):
  one word is replaced. It is the word the publisher's rows leave unlinked
  (ἀποκτεννόντων, αὑτῷ), and the English renders it. The links with
  same-word notes are right.
- 12:22 (21, 21, 22): BSB's text has one extra word. The publisher put
  "your life" on ψυχῇ and "about" on τῷ, and left only the second "your"
  (body) unlinked. So the extra word is that "your" (probably ὑμῶν after
  σώματι). `t your#1` with the reading reason, τῇ = your (article as
  possessive), τῷ `s` and μεριμνᾶτε = do + worry + about + about (as Matthew
  6:25) are right.
- 12:24 (25, 23, 25): the two οὔτε are replaced by negatives with the same
  meaning. οὔτε = not and οὔτε = or, as Matthew 6:26, are right.
- 12:27 (22, 19, 23): see the change below.
- 12:53 and 12:54: all N1904 words are matched and the publisher has one
  extra word (probably an article). The English has no word for it, and no
  claim is made. Right.
- 12:56 (17, 15, 18): οὐ and δοκιμάζετε are replaced and one word is added.
  The publisher left "don't you know how to interpret" unlinked. οὐ = don’t
  and δοκιμάζετε = you + to interpret with same-word notes, and `t know#1
  how` as the extra word, are right.

## Changes (6 verses: 3 link changes, 3 notes)

- 12:27: `οὔτε … οὔτε` = not + or, νήθει = They do + spin → `οὔτε` (first)
  = or, νήθει = spin, `s` for the second οὔτε with ὑφαίνει, and `t They do
  not labor` with the reading reason. The publisher left "grow, They, do,
  not, labor, or" unlinked and kept νήθει = spin. Those words match Matthew
  6:28, "They do not labor or spin", where the reviewed rows give οὐ = not,
  κοπιῶσιν = They do + labor, οὐδέ = or, νήθουσιν = spin. So in BSB's text
  "They do not labor" is the extra clause, and "or" is the negative just
  before "spin". In N1904 the word in that place is the first οὔτε (οὔτε
  νήθει, "nor spin"). That is the only same-meaning link, as in 12:24. The
  author's version tied "or" to the second οὔτε, the one before "weave",
  which the English does not have. It also moved "They do" from the labor
  clause to spin.
- 12:42: ὁ (second article, ὁ φρόνιμος) = and → `s` for ὁ and `t and`.
  The article means "the", and "and" means something else. Under the
  refined split-pair rule, `s` + `t` is correct here: "and" does not
  render the article. Matthew 24:45 has a real καί at this point; Luke
  does not.
- 12:15: τινί = one’s with αὐτοῦ `s` → `τινί … αὐτοῦ` = one’s. The
  possessive "one’s" renders αὐτοῦ (ἡ ζωὴ αὐτοῦ, "his life"), and "one"
  is τινί. The old `s` reason itself said the English names the possessor
  as "one’s", so αὐτοῦ does have an English word.
- 12:21 (note only): "οὕτως is rendered this is how" → "rendered how,
  inside the English frame This is how". "This is" is `t`, so the old note
  did not match the link.
- 12:54 (note only): same fix. οὕτως = that, and "is what" stays `t` (a
  cleft frame, as 12:18 and 12:28).
- 12:24 (note only): διαφέρετε = valuable + are. The note said "are more
  valuable", but "more" is μᾶλλον's link. It now says so.

## Answers to the author's doubts

- 12:22: agreed (see Reading claims). Which "your" is the extra word is
  inferred from the publisher's rows: they left only the second one
  unlinked.
- 12:27: changed (see above).
- 12:42 ὁ = and: changed to `s` + `t`. This is not a split pair, because
  "and" does not render the article.
- 12:48: kept. παρ’ = From, αὐτοῦ `s`, αὐτόν = from him. The publisher had
  put παρ’ αὐτοῦ on the second clause's "from him". That "from him" is
  αὐτόν, the person asked (αἰτέω takes two accusatives), so the author's
  fix is right. αὐτοῦ is a resumptive pronoun after the pendent παντί.
  Reviewed files treat such pronouns as `s` ("not repeated in English").
  "Everyone" renders παντί, and joining παρ’ αὐτοῦ = From would make "From"
  carry "him".
- 12:15: changed. τινί and αὐτοῦ are now joined (see above).
- 12:35 ὑμῶν = your (lamps): kept. It is the real pronoun, it stands before
  both nouns, and the note says so. Making the article οἱ = your would
  leave ὑμῶν without an English word.
- 12:56 πῶς = Why: kept. "How is it that you do not …" is "Why don’t
  you …".

## Still uncertain

- 12:19: Ψυχή = You (publisher row, kept with a note). "You" is also the
  subject of ἔχεις. The alternative is ἔχεις = You have, with the vocative
  `s`. The kept row is not wrong (the soul is the one addressed), so I left
  it.
- 12:27: "They do" could also go with νήθει, as the shared subject and
  auxiliary of "spin". I put it with the reading clause because the
  publisher's rows and Matthew 6:28 do.
- 12:58: μετά = with. English "with your adversary" completes "reconcile",
  but in Greek μετά goes with ὑπάγεις, and ἀπ’ αὐτοῦ ("from him") is folded
  into "to reconcile". I kept it: the English moves the μετά phrase, and
  "with" is μετά's ordinary meaning.
