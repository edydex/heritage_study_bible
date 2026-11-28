# BSB 1 Corinthians 12: independent peer review (Claude)

Checked: 31 of 31 verses (12:1-31). This chapter has no KEEP blocks. I
checked every `g`, `s` and `t` line against the Greek, BSB's English and the
publisher record for each verse in
`public/data/original-languages/bsb-word-links/1-corinthians.json`.
Final check: `fromtext` → `{"versesOk": 31, "problems": 0}`.

## Changes

Four changes in four verses: two verses are relinked (12:29, 12:30) and two
notes are reworded (12:15, 12:16). All other verses in the peer JSON are
identical to the author's.

- 12:29: each μή was linked to BSB's question word (`g 0 = Are#0`,
  `g 3 = Are#1`, `g 6 = Are#2`, `g 9 = Do`). Now all four μή are `s`
  ("μή marks a question expecting the answer no; English has no separate
  word for it here"). "Are#0", "Are#1" and "Are#2" are `t` because English
  supplies the copula and none of the Greek questions has a verb. "Do" is
  `t` like "work" (already `t`), since μὴ πάντες δυνάμεις has no verb either.
  This follows the registered convention for μή questions: 1 Corinthians
  9:8-9, Romans 3:5, 9:14 and 9:20 make μή `s`, put "Do/Shall" on the Greek
  verb, and make a verbless "Is" `t`. The previous link put the copula on a
  particle that does not mean "are".
- 12:30: each μή was linked to "Do#0"/"Do#1"/"Do#2". Now all three μή are
  `s` (same reason), and each "Do" goes on the clause's own verb:
  ἔχουσιν "have" → "Do#0 + have", λαλοῦσιν "speak" → "Do#1 + speak",
  διερμηνεύουσιν "interpret" → "Do#2 + interpret". This matches 1 Corinthians
  9:8 (λαλῶ = "Do I say") and Romans 9:20 (ἐρεῖ = "Shall + say").
- 12:15 and 12:16, second οὐκ = "any less" (link kept): the note
  'The second negative ("is not of the body") is rendered any less … a part
  of.' → 'The second negative (literally "it is not … not of the body") is
  rendered any less.' The old note said the negative was rendered by "a part
  of", but "a part of" is linked to ἐκ.

## Answers to the author's doubts

- 12:15-16 (παρὰ τοῦτο = "that", ἔστιν = "would + make it", second οὐκ =
  "any less", ἐκ = "a part of"): kept. τοῦτο is BSB's "that". The causal
  παρά does not get its own English word because BSB makes "that" the
  subject. ἔστιν is the only verb in the clause, so it carries the modal
  "would" and the "it" from its third-person ending. "make it … a part of"
  recasts "it is … of", so a reader who taps "make" sees "is" and not a
  preposition. The alternative (παρὰ τοῦτο = "that + make") would put a verb
  on a preposition. "Not … not of the body" equals "not … any less a part of
  the body", so "any less" renders the second negative with the same
  function; this is not a split pair. ἐκ = "a part of" is the partitive ἐκ,
  as in the reviewed rows ἐκ = "one of" (Acts 2:30, 21:8; Colossians 4:9,
  4:12) and "some of" (2 John 4). In the first clause, εἰμί = "I do + belong"
  and ἐκ = "to" keep the auxiliary "do" with the verb it belongs to. This is
  faithful to BSB's wording ("that would not make it any less a part of the
  body").
- 12:29-30 (μή = "Are"/"Do"): changed. See the Changes section.
- 12:27 ("is" on ἐστε vs `t`): kept as "are + is". The Greek is one clause:
  ὑμεῖς ἐστε σῶμα Χριστοῦ καὶ μέλη ἐκ μέρους. μέλη is a second predicate of
  the same ἐστε. BSB splits it into two clauses and gives the second one a
  new subject ("each of you"), so "is" is the same verb repeated across a
  change of person, which the rule for words understood again allows. The
  John 14:10 and 15:5 rule forbids linking a supplied copula to an εἰμί in
  another clause, and here there is no other clause. ἐκ μέρους = "each of
  you" (one unit) and "of it" `t` are confirmed.
- 12:25 ("that#1" on ἵνα): kept. The second clause has no ἵνα of its own,
  but its subjunctive μεριμνῶσιν is still governed by the first ἵνα. BSB's
  repeated "that" has the same purpose role and meaning as "so that", so it
  has a Greek owner and is not an added "that". τὸ αὐτό = "mutual" (joined)
  and "should#1 have + concern" on the finite verb are confirmed.
- 12:14 (repeated "of" on ἔστιν): kept. The "of" belongs to the English
  verb "consist of" that renders ἔστιν, and BSB repeats it before the second
  complement. πολλά is nominative and must not carry it. `t` would also be
  defensible, but changing it would only be a matter of taste.
- 12:23 (ἅ = "the parts", τοῦ σώματος `s`): kept. A relative with no
  antecedent includes its head noun. The reviewed precedents are Acts 19:25
  (οὕς = "the craftsmen") and 2 Timothy 2:2 (ἅ = "the things that"). This is
  consistent with ἀσχήμονα = "unpresentable parts" in this verse and
  εὐσχήμονα = "presentable parts" and τῷ ὑστερουμένῳ = "to the parts that
  lacked" in 12:24. "parts" does not mean "body", so the publisher's
  σώματος = "parts" was an over-claim and `s` is right. Putting "with" on the
  verbs (περιτίθεμεν "we treat with", ἔχει "are treated with") is
  confirmed. τούτοις `s` (resumptive) is confirmed.
- 12:28 (second ἔπειτα = "and"): kept. BSB's "and" has the same role in the
  list (the connective before the next item), and the note gives the Greek
  meaning. See the uncertain points below.
- 12:6 (διαιρέσεις = "different", ἐνεργημάτων = "ways of working"): kept.
  This matches 12:4-5, where διαιρέσεις = "different" alone.

## Other points the coordinator raised (confirmed)

- 12:21: οὐ δύναται = "cannot + can". "cannot" is one English word, so the
  negative cannot be split off. In the second clause δύναται is understood
  again, so the repeated "can" links to it, and ἤ = "Nor" carries the
  negative. εἰπεῖν = "say#0 + say#1" (understood again). Χρείαν … ἔχω =
  "I do + need" (person and auxiliary on the finite verb), οὐκ = "not", and
  "to + hand"/"to + feet" are on the nouns.
- 12:12: "although + are" is on the participle ὄντα (the concessive force
  belongs to the participle, and no person word is involved). "they + form"
  is on the finite ἐστιν, whose subject BSB resumes as "they". πάντα =
  "all", τοῦ σώματος = "its", and "it#1 is with" is `t` (no Greek verb).
- 12:11, 12:12, 12:14: no number carries a case word. ἕν/ἑνί = "one" or "a
  unit" and πολλά = "many" everywhere. The "of" is on the recast verbs
  ("are the work of", "it is composed of", "does + consist of + of"). A
  scan of the peer JSON finds no lone article carrying "of/to/in the" or a
  copula. The only article rows that are not "the" are τῷ = "that" (12:9,
  demonstrative) and τά = "its" (12:25, possessive), and both are allowed.
- Readings: the EVIDENCE lines and `partial` records show a difference only
  in 12:18 and 12:26.
  - 12:18: sourceWords 15, matchedSourceWords 14, publisherGreekWords 15.
    νῦν is unmatched and "in fact" has no owner. νῦν = "in fact" with the
    same-meaning note is right.
  - 12:26: sourceWords 16, matchedSourceWords 15, publisherGreekWords 17.
    συνπάσχει is unmatched, and "suffers with it" and the second "one" have
    no owner. συνπάσχει = "suffers with" (same-meaning note) and "one#1" `t`
    (extra word in BSB's text) are right.
  Neither review-file note names the publisher's Greek.
- Other brief rules: supplied copulas are `t` (12:3 "is#1", 12:17
  "were/would/be", 12:19 "would/be", 12:20 "there are", and now 12:29).
  Supplied objects and possessives are `t` (12:11 "them", 12:24 "it",
  12:26 "it", 12:27 "of it"), and so are added adverbs (12:10 "still", 12:24
  "such"). An "and" joining a participle to the main verb is `t` (12:2,
  12:24). No person or modal word sits on a participle.

## Still uncertain (not changed)

- 12:28: the second ἔπειτα ("then") = "and" is the publisher's row. If the
  sequence sense of ἔπειτα is treated as a different meaning, the row would
  become ἔπειτα `s` + "and#0" `t`.
- 12:31: ἔτι = "now" is the publisher's row with a note. BSB's "And now"
  works as a transition that equals "further". If the coordinator reads ἔτι
  as "still (more excellent)", the row would become `s` + `t`.
- 12:18: ἐν = "of" (publisher row with a note). BSB turns "placed the
  members … in the body" into "the members of the body". I kept it because
  "of" is BSB's only rendering of the relation between the members and the
  body.
- 12:24: "has#1 given" on the participle δούς. "has" is a tense auxiliary,
  not a person or modal word, as "is treading" in 1 Corinthians 9:9.
