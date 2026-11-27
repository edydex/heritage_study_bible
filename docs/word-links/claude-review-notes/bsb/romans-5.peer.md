# BSB Romans 5: independent peer review (Claude)

Checked: 21 of 21 verses (5:1-21), every `g`/`s`/`t` line of the author's
final file, against N1904, the BSB English, the publisher rows in
`drafts/romans-5.txt`, the EVIDENCE lines and the `partial` records in
`public/data/original-languages/bsb-word-links/romans.json`. No KEEP blocks.

Final check: `fromtext` → `{"versesOk": 21, "problems": 0}`. Only 5:14
differs from the author's JSON.

## Changes

- 5:14 ὁμοιώματι: "way that" → "way"; "that" `t` ("English introduces the
  clause made from the noun παραβάσεως"). "that" does not render
  ὁμοιώματι ("likeness"). BSB adds it because it turns the noun
  παραβάσεως into the verb "transgressed". README rule 7 treats an added
  "that" as English-only (compare Acts 19:27).

## Points checked and confirmed (no change)

- 5:1 ἔχωμεν = "we have" with the John 8:39-style note. The verse's
  `partial` record (15 source words, 14 matched, 1 publisher word not in
  N1904) shows one differing word. The publisher linked every other content
  word but left ἔχωμεν and "we have" unlinked, so the difference is at this
  word. The note names no publisher spelling ("BSB's Greek has another form
  of it here") and only glosses N1904's subjunctive, as John 8:39 glosses
  its present. It gives no interpretation. Linking is right because BSB
  renders the same verb in the same person; only the mood differs, which
  is the John 8:39 case.
- 5:10 τῷ Θεῷ = "to Him", "of God" `t`. Θεῷ is the dative object of
  κατηλλάγημεν, and "to Him" renders it in that role. "of God" after
  "enemies" names the same person in another role (whose enemies), and the
  Greek has no word for that. A second rendering links only when the role
  and meaning are the same, so `t` is right. Θεῷ is linked, so this is not
  a split pair. The publisher's "enemies of God" on ἐχθροί over-claimed.
- 5:15, 5:17, 5:19 "of + one man" on the substantive ἑνός (no ἀνθρώπου in
  those phrases). A masculine numeral used as a noun is the head word, so
  the genitive's "of" sits on it, and the lone τοῦ keeps only "the".
  Precedent puts "man" in the group, not `t`: Acts 17:26 and Hebrews 11:12
  ἑνός = "one man", John 19:32 πρώτου = "of + first man", James 5:16 δικαίου
  = "of a righteous man", Mark 10:17 εἷς = "a man". Where ἀνθρώπου is
  present (5:12, 5:15 second, 5:19 first), "man" and "of" go on ἀνθρώπου and
  ἑνός keeps "one". This is correct.
- 5:6, 5:8 ὄντων = "while/While + were", ἡμῶν = "we". In a genitive
  absolute, "while" belongs to the participle. ἡμῶν is the explicit subject
  pronoun, so "we" links to it (Mark 14:3, 14:66 "While + was").
- Connectives: 5:7 μόλις = "Very rarely". The first γάρ has no English
  ("For" is absent), so it is `s`. The second γάρ = "though" is linked, as
  a connective BSB renders differently. In 5:3 and 5:11, δέ is `s` and
  "that" is `t`. "that" is a supplied demonstrative, not a rendering of δέ,
  so this is no split pair (compare Acts 19:27, where δέ in οὐ μόνον is
  `s`). 5:19 γάρ = "For", ὥσπερ = "just as". Other connectives BSB renders
  stay linked: 5:14 ἀλλά = "Nevertheless", 5:16 καί = "Again", 5:12 καί =
  "also". 5:4, 5:16 and 5:20 leave δέ, γάρ and μέν untranslated, so they
  are `s`.
- The "we" supplied for participles is `t` in 5:1, 5:3, 5:9, 5:10 and 5:11
  (Δικαιωθέντες, εἰδότες, δικαιωθέντες, ὄντες, καυχώμενοι). Finite verbs
  keep their person and modal: 5:9 and 5:10 "shall we be saved", 5:17
  "will + reign", 5:20 "would increase", 5:21 "might reign".
- Joined units: 5:12 Διὰ τοῦτο = "Therefore" (compare 1 Thessalonians 3:5),
  εἰσῆλθεν εἰς = "entered" (Mark 11:11, Matthew 21:12) and ἐφ’ ᾧ = "because"
  (Acts 7:33, Philippians 3:12 join it). 5:14 τοῦ μέλλοντος = "of the One to
  come" and 5:17 οἱ … λαμβάνοντες = "those who receive" are article +
  participle units (rule 3). "of" sits on the unit, not on a lone article.
- Lone articles: none carries "of the", "to the", "by the" or "in the". The
  5:2, 5:10, 5:15, 5:17 and 5:19 moves are right. 5:17 τοῦ = "that" is an
  anaphoric article, so it may carry "that".
- 5:13 μὴ ὄντος = "no" + "when there is". This "there" is not added: it
  renders the existential εἰμί (compare Hebrews 8:4 ὄντων = "since there
  are"). "was given" after "the law" is correctly `t`.
- The EVIDENCE line for 5:17 shows no unmatched words, only a difference in
  word order. The author claims no reading there, which is right.

## Answers to the author's doubts

- 5:10 Θεῷ = "to Him", "of God" `t`: agreed (see above).
- 5:15, 5:17, 5:19 "of" on ἑνός: agreed. "of" `t` would leave the genitive
  head without its case word.
- 5:1 linking ἔχωμεν with a form note rather than `s`/`t`: agreed. Same verb
  and same person; John 8:39 is the precedent.
- 5:6 which ἔτι carries "still": agreed, the first one. It stands in front
  for emphasis but belongs to ὄντων ἡμῶν ἀσθενῶν. The second ἔτι repeats it.
  "just" in "at just the right time" means "exactly", not "still", so it is
  `t`. The publisher's ἔτι = "just" was wrong.
- 5:14 ὁμοιώματι = "way that": changed (see Changes).
- 5:16 δι’ = "the result of", ἐξ/ἐκ = "that followed", and εἰς = "brought"
  (5:16, 5:18) and "to bring" (5:21): kept. These are the publisher's rows.
  The English recasts each preposition's relation (means, source, result),
  and 2 Timothy 2:25 εἰς = "leading to" is a precedent. Making them `s`/`t`
  would create split pairs.
- 5:8 ὅτι = "in this": kept as one group. "in this:" is BSB's form of
  epexegetical "in that"; `t` + `s` would split a rendering.

## Still uncertain

- 5:19 second ἑνός: BSB's "man" could also be linked back to the ἀνθρώπου of
  the parallel first clause under the "words understood again" rule. It is
  kept on the substantive ἑνός, as in 5:15 and 5:17, because a masculine
  substantive gives "one man" by itself.
- 5:7 τάχα = "might possibly". "might" is a modal, but τολμᾷ is a present
  indicative and the uncertainty comes from τάχα ("perhaps"), so it stays
  on τάχα rather than on the finite verb. There is no τάχα precedent in
  the reviewed files.
- 5:18 ζωῆς = "and life": the publisher's row is kept with its note. "and"
  is BSB's rendering of the genitive relation. `t` for "and" is the
  alternative.
