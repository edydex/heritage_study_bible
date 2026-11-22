# BSB John 14: independent peer review (Claude)

Checked: 31 of 31 verses (14:1-31). No verse was kept from an earlier review.
I checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher rows for John 14 in
`public/data/original-languages/bsb-word-links/john.json`, and the `partial`
counts there for every reading claim (14:5, 14:6, 14:7, 14:9 and 14:13 are
the only verses with a `partial` record; 14:30 has none). I also compared
reviewed precedents: Matthew 6:3 (μή = not, a third-person command = do + let
+ verb), Mark 2:21, Luke 5:36-37, Luke 10:6 and 13:9 (εἰ δὲ μή), Matthew 2:9
and John 6:62 (a relative adverb rendered "the place where" / "to where"),
Matthew 26:29 and 26:64 (ἀπ’ ἄρτι = from + now on), and Matthew 13:22 and
Mark 4:19 (BSB "this life" for τοῦ αἰῶνος, with "this" as `t`).
Final check: `fromtext` → `{"versesOk": 31, "problems": 0}`.

## Changes (1 verse, 2 lines)

- 14:30, link: `g 8` τοῦ = "this" (note "The article with κόσμου is rendered
  this.") → `s 8` "The actual article has no distinct counterpart in this
  English wording." and `t this` "English supplies this, matching the prince
  of this world in 12:31 and 16:11; here the Greek has only the article."
  Why: 14:30 has no `partial` record, so the publisher's Greek is N1904 word
  for word, and N1904 has no τούτου here (12:31 and 16:11 do have it). The
  article in ὁ τοῦ κόσμου ἄρχων is the ordinary article with "world"; it
  does not point back to anything just mentioned. "this" is BSB's own
  addition, matching the set phrase in 12:31 and 16:11. Reviewed chapters
  that link an article to "this" (John 4:11, 4:12; Mark 5:8, 9:10, 9:32) do
  so only where the article points to something just named or present. The
  closest parallels are Matthew 13:22 and Mark 4:19, where BSB adds "this"
  before "life" for τοῦ αἰῶνος; both give "this" a `t`. This is not a split
  pair, because "this" does not render the article. "the" stays on ὁ, and
  "of + world" stays on κόσμου.

Every other line of the author's file is kept.

## Points I was asked to settle

- **14:30 τοῦ / "this"**: changed to τοῦ `s` + `t this`, as above. Nowhere
  else in the chapter is an article linked to a demonstrative, so the
  treatment is consistent.
- **14:10 "am" `t`, ἐστιν = "is"**: confirmed. ἐστιν is third person singular
  and agrees with ὁ Πατήρ in the second clause. The first clause leaves out
  a first-person verb that the Greek never writes, so ἐστιν cannot stand for
  "am". This matches 14:11 and 14:20, where every supplied am/is/are is `t`.
- **14:5 "we know" and "can"**: confirmed. The record is 12/11/13: one N1904
  word has no match and there are two extra publisher words. The publisher
  links only the first οἴδαμεν ("we do not know") and leaves "can we know"
  with no owner, so the unmatched word is the second οἴδαμεν. "we" and
  "know" still render that verb in N1904, so the link with a same-verb note
  is right, and "can" `t` with the reading reason is right. Both notes
  ("BSB's Greek differs slightly here, but know still renders this verb."
  and "BSB follows a reading with an extra word here, rendered can.") do not
  give the publisher's wording.
- **14:7 second "Him" `t`**: confirmed. The record is 15/15/16: every N1904
  word is matched and there is one extra publisher word. The publisher's own
  rows leave only the final "Him" with no owner. N1904 ends with ἑωράκατε
  and has no object, so the `t` with the reading reason is right.
- **14:9 Τοσοῦτον χρόνον = "all this time" (same sense)**: confirmed. The
  record is 27/25/27. The publisher leaves exactly Τοσοῦτον χρόνον and "all
  this time" without a link, so the two unmatched words are this phrase.
  "all this time" still renders the N1904 accusative of duration. The note
  ("BSB's Greek differs slightly here, with the same sense") is soft enough.
- **14:13 ὅ τι ἄν = "whatever" (same sense)**: confirmed. The record is
  18/16/17: two N1904 words have no match and there is one extra publisher
  word. The publisher leaves ὅ, τι, ἄν and "whatever" without a link, which
  fits the same pronoun written as one word. The note does not spell it.
- **14:1 and 14:27 "Do not let … be troubled"**: confirmed. μή = "not";
  ταρασσέσθω = "Do + let + be troubled", as γνώτω = "do + let + know" in
  Matthew 6:3. In 14:27, μηδέ = "not" (note) and δειλιάτω = "do + be
  afraid" also follow the rule that negatives are split from verbs.
- **14:2 εἰ δὲ μή = "If it were not so"; εἶπον ἄν = "would I have told"**:
  confirmed. δέ belongs inside the idiom. It is the "but" of "but if not"
  ("otherwise"), and BSB has no "but" or "and" for it. Mark 2:21 and Luke
  5:36-37 (εἰ δὲ μήγε) join all three words when BSB recasts the idiom.
  Luke 10:6 and 13:9 split it only when the English is the literal "if
  not". "If it were
  not so" is a recast: "it were" and "so" fill in the clause the idiom
  leaves out. Splitting would leave those words either `t` or loaded onto
  μή. The unit also matches εἰ δὲ μή = "or at least" in 14:11. No English
  word is owned twice: "I#0" is only in "would I have told", ὑμῖν has
  "you#0", "there" is `t`, and πορεύομαι has "I#1 am going".
- **14:6, 14:16, 14:26 and the "in Me / in the Father" phrases**: confirmed.
  They are linked word by word (Ἐγώ = I, εἰμι = am, each ἡ = the;
  Παράκλητον/Παράκλητος = Advocate; ἐν = in, ἐμοί = Me, Πατρί = Father).
  The only notes are grammatical (εἰ μή = except, κἀγώ = And I, εἰς τὸν
  αἰῶνα = forever, the resumptive ἐκεῖνος, the unexpressed relative ἅ).
  None is interpretive.

## Answers to the author's doubts

- 14:30: changed (see above).
- 14:10: agree with "am" `t`.
- 14:4 ὅπου = "to the place where": kept. Matthew 2:9 links "the place where"
  to the relative adverb οὗ, and John 6:62 links "to where" to ὅπου. Here
  ὅπου with ὑπάγω means "where to". "to the place where" spells out the
  relative with its implied antecedent and adds no Greek meaning. `t to the
  place` would also be defensible, but the publisher row is not wrong.
- 14:23 "Our" `t` and 14:28 "back" `t`: agree. μονήν means "dwelling" and has
  no possessive. ἔρχομαι πρὸς ὑμᾶς means "I am coming to you", and "back"
  comes from the context of "going away". Folding either word into the
  Greek word was a mild over-claim, so correcting it is not a change of
  taste. In 14:3, "back" does render πάλιν and stays linked.
- 14:5: agree (see above). "how can we know" adds the modal from the
  publisher's extra word. It does not change what οἴδαμεν means.

## Still uncertain (left as the author had them)

- 14:31 καθὼς … οὕτως = "exactly what": BSB turns "just as … so I do" into
  "I do exactly what". A correlative unit is reasonable. οὕτως `s` with
  καθώς = "exactly what" would also be defensible.
- 14:19 ἔτι μικρόν = "In a little while": ἔτι does not mean "in". Joining
  the pair is better than the publisher's ἔτι = "In". John 7:33 keeps ἔτι
  separate ("longer") only because BSB renders it there.
- 14:9 and 14:13: the place of the reading difference is inferred from the
  `partial` counts and the publisher's unlinked words. The notes say only
  "differs slightly here", which fits that level of certainty.
- 14:1: the note that the first πιστεύετε is read as a statement and the
  second as a command describes BSB's choice, not the Greek form. It is
  accurate, but a reader may want both readings mentioned elsewhere.
