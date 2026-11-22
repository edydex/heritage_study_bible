# BSB Luke 17: independent peer review (Claude)

Checked: 36 of 36 verses (17:1-35 and 17:37; N1904 has no 17:36 and BSB
prints it empty, so there is no block). I checked every `g`, `s` and `t`
line against N1904, the displayed BSB, the publisher record in
`public/data/original-languages/bsb-word-links/luke.json` (its `partial`
counts and its own group links) and the reviewed parallels Matthew 18:6-7,
18:15, 18:21-22, 17:20, 24:17-18, 24:23-28 and 24:37-41 (plus Mark 13:16,
13:21, Luke 11:27, 13:12 and 13:19). Every `#n` anchor was checked against
the EN line. Final check: `fromtext` → `{"versesOk": 36, "problems": 0}`.

## Changes (1 verse, note only)

- 17:11: `t Jesus` reason "the Greek gives it only in the infinitive
  clause" → "English names the subject, which the Greek leaves implied in
  the infinitive clause." Why: πορεύεσθαι is an infinitive with no
  expressed subject and no person ending, so the Greek does not "give" the
  subject at all. The link itself is unchanged.

No link was changed. The author's corrections of the publisher rows are
right: the supplied "Jesus"/"People" taken off verbs, negatives split off
verbs, "When/As/While" moved to the participle, genitive absolute or ἐν τῷ,
prepositions moved off articles, and the asyndetic "and"s made `t`.

## Reading claims

The publisher record has a `partial` entry for 17:1, 17:11, 17:12, 17:16,
17:17, 17:23 and 17:33 only, and those are the only verses with a reading
note. In each case I also checked which N1904 words the publisher itself
left unlinked.

- 17:1 (18 / 17 matched / 18): "but" is not linked by the publisher, so the
  unmatched N1904 word is very likely the second δέ. δέ = but with "Same
  meaning; BSB's Greek has a different word for "but" here" is right
  (probably πλήν, as Matthew 18:7).
- 17:11 and 17:16 (1 unmatched / 1 extra each): "Samaria" and "Samaritan"
  are the publisher's only unlinked content words, so these are spelling
  differences. The notes do not state the spelling.
- 17:12 (13 / 13 / 14): one extra publisher word and no unmatched one; the
  publisher leaves the second "He" unlinked. `t He#1` with the reading
  reason is right (probably αὐτῷ, "met him").
- 17:17 (13 / 12 / 13): the publisher links nothing to "Were not" while it
  links every other content word, so the unmatched N1904 word is Οὐχ.
  **Settles the author's doubt:** Οὐχ = not with "Same negative, in a
  different form" is right (probably οὐχί); no other word is in question.
- 17:23 (11 / 11 / 12): one extra publisher word; "or" is the publisher's
  only unlinked English word. `t or#0` with the reading reason is right
  (probably ἤ). The reviewed Matthew 24:26 and Mark 13:21 give `t or` as
  plain English supply; here the counts show an extra word, so the reading
  reason is the right one.
- 17:33 (15 / 13 / 15): the publisher links περιποιήσασθαι = to save, so
  that word is in BSB's Greek. Its unlinked N1904 words are ἐάν, τήν, καί,
  ἄν and the second ἀπολέσει, and its unlinked English is "but", "loses"
  and the second "his life". So καί = but ("Same sense; BSB's Greek has a
  different connective") and the second ἀπολέσει = loses ("Same verb in a
  different form") are right (probably δ’ and ἀπολέσῃ). The counts
  (15 = 15) leave no room for an extra object word, so `t his#1 life` with
  no reading claim is right.
- No note in the file states the publisher's Greek spelling or wording as
  fact.

## Points I was asked to settle

- 17:24, τῆς ὑπό = "one end", τὴν ὑπ’ = "the#2 other": **agree, kept.**
  Each article with its preposition is a substantive ("the [region] under
  [the sky]"), so the pair is one unit (rule 3). "one end" / "the other"
  render that region, not the article alone; putting ὑπό in `s` would
  tell the reader "under" is unrendered when it is part of what "end"
  means. The first τὸν οὐρανόν = "the#1 sky" (τόν = the, οὐρανόν = sky),
  now the object of "lights up". The second οὐρανόν `s` ("not repeated in
  English") is honest; folding it into "the other" would over-claim, since
  "other" does not mean "sky". Nothing here is over-claimed. ἀστράπτουσα =
  flashes, λάμπει = lights up, `t and` (participle joined to the main verb)
  are right.
- 17:6, κόκκον = "a + seed", σινάπεως = "mustard": **agree, kept** (the
  "a goes with the noun" rule). This matches the reviewed Luke 13:19
  (κόκκῳ = a + seed) and Mark 4:31 (κόκκῳ = a + seed). **Inconsistency to
  align later:** the reviewed Matthew 17:20 (κόκκον = seed, σινάπεως = a
  mustard) and Matthew 13:31 (κόκκῳ = seed, σινάπεως = a#0 mustard) put
  "a" on the genitive. Those two Matthew verses are the outliers. ὡς =
  "the#1 size of" matches Matthew 17:20; τῇ `s`, συκαμίνῳ = to + mulberry
  tree, ταύτῃ = this matches Matthew 17:20 (τῷ `s`, ὄρει = to + mountain).
- 17:31, σκεύη + αὐτά = "possessions": **agree, kept.** English "his
  possessions" is at once the noun σκεύη and the object of "retrieve",
  which in Greek is αὐτά; both refer to the same goods, named once. This is
  the reviewed Matthew 18:21 pattern (ἀδελφός + αὐτῷ = brother).
  καί (9), ἔσται and ἐν τῇ οἰκίᾳ `s` are right: BSB folds the "and his
  goods are in the house" clause into the object and does not say "in the
  house". ὅς = one with ἔσται `s` is better than ὃς ἔσται = one, because
  "one" does not render "will be". μή = no, καταβάτω = let + come down,
  ὁ = one, μή = no, ἐπιστρεψάτω = let + return match Matthew 24:17-18;
  `t the#1` is right (N1904 ἐν ἀγρῷ has no article, unlike Matthew 24:18).
- 17:31, τὰ ὀπίσω = "anything he has left behind": **agree, kept.** BSB
  takes τὰ ὀπίσω as "the things behind" (the object of return for), not
  as the idiom "turn back" of Mark 13:16 (where εἰς τὰ ὀπίσω joins the
  verb). "he has left" is not in ὀπίσω alone, so the publisher's split
  (ὀπίσω = he has left behind) over-claimed for ὀπίσω; the joined
  article + adverb unit is the right owner. εἰς = for is right.
- 17:12 `t He#1` and 17:23 `t or#0`: **agree** (see Reading claims).
- Same-meaning notes 17:1, 17:17, 17:33: **agree** (see Reading claims).

## The author's other doubts

- 17:7 `t in#1`: **agree.** ἐκ (from the field) stays on "from", which now
  governs "plowing or shepherding"; "in" places the work in the field and
  renders no Greek word. τοῦ = the, ἀγροῦ = field.
- 17:12 τινα = "one of" + `t the`: **agree, kept.** τινα = "one of the" is
  also defensible, but `t the` with "English partitive wording; the Greek
  τινα κώμην is 'a certain village'" tells the reader more. Not a change
  for taste.
- 17:9 ἔχει = Does he, χάριν = thank: **agree, kept** (publisher row,
  neither wrong nor over-claiming; χάριν is the "thanks" word).
- 17:22 ἡμέραι = "The time": **agree, kept.** "The time" is BSB's
  idiomatic rendering of "days will come"; the English "The" is part of
  that rendering, not a claimed Greek article.
- 17:14 αὐτοῖς = "them" (object of saw): **agree**, as the reviewed Luke
  13:12 (αὐτῇ with said = her, object of called over). `s` + `t` would be a
  split pair for the same pronoun.
- 17:17 οἱ = "all": **agree, kept** (publisher row; "all ten" renders the
  definite "the ten").
- 17:8 οὐχὶ ἐρεῖ = "won’t he tell": **agree**; the contraction cannot be
  split, and the note says where the negative is.
- 17:37 ὁ = Jesus (ὁ δέ as pronoun): **agree**, as other reviewed Luke
  chapters ("In ὁ δέ the article serves as the pronoun he; BSB names
  Jesus").

## Still uncertain

- Nothing in this chapter. Outside it: Matthew 13:31 and 17:20 should be
  aligned with Mark 4:31, Luke 13:19 and Luke 17:6 on where "a" goes in
  "a mustard seed".
