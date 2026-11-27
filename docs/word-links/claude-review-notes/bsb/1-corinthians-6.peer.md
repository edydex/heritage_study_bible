# BSB 1 Corinthians 6: independent peer review (Claude)

Checked: 20 of 20 verses (6:1-20). No KEEP blocks in this chapter. Every
`g`, `s` and `t` line was checked against the Greek, BSB's English and the
publisher record for each verse in
`public/data/original-languages/bsb-word-links/1-corinthians.json`. Final
check: `fromtext` → `{"versesOk": 20, "problems": 0}`.

## Changes

- 6:14: ἤγειρεν = "raised" → "raised + from the dead"; `t from the dead`
  removed. The Greek has no ἐκ νεκρῶν. BSB spells out the raising verb, and
  the reviewed files link that expansion to the verb itself: Acts 13:37
  (ἤγειρεν = "raised from the dead", the same verb with no ἐκ νεκρῶν),
  Acts 2:24 (ἀνέστησεν = "raised … from the dead"), Acts 2:32 ("has raised
  to life"), Matthew 16:21 and 17:23 ("raised to life"). BSB's wording here
  does not differ from those verses. New note: "ἤγειρεν ("raised") is
  rendered raised … from the dead."
- 6:7: ὅτι = "The very fact that" → "The + fact that"; "very" is now `t`
  ("English adds very for emphasis; the Greek has no word for it"). "The
  fact that" is a normal rendering of ὅτι introducing a subject clause, as
  in Mark 8:16 (ὅτι = "the fact that"). "very" is pure English emphasis
  with no Greek word behind it. The reviewed files make an added "very"
  `t` (Luke 12:7, 12:20, 19:2, 19:40; John 5:39, 12:16; Matthew 26:31,
  26:34; Romans 9:26; Acts 4:27). They keep it inside a link only when the
  Greek has an intensive or demonstrative word (αὐτὸ τοῦτο, ἐκεῖνος, αὐτός),
  and this clause has none.
- 6:4: καθίζετε = "do you appoint as judges" → "do you appoint"; "as judges"
  is now `t` ("BSB adds as judges to name the role; the Greek has no word for
  judges"). καθίζω ("seat, install") is rendered "appoint", and that link is
  honest. The noun "judges" has no Greek word, and there is no κριτάς. It
  is a supplied complement, like a supplied object or "named" without ὄνομα
  (Acts 10:5). Elsewhere "appoint as" keeps "as" only where the Greek gives
  the role noun (1 Timothy 2:7). The note now reads "καθίζετε ("do you
  seat") is rendered do you appoint."

No other change. Every other verse in the peer JSON is identical to the
author's.

## Points settled

- 6:14 καὶ … καί: confirmed. The first καί (before τὸν Κύριον) is `s`: BSB
  has no "both". The reviewed files do the same, for example 1 Corinthians
  1:22, Acts 2:29, 2:33, John 6:36, 15:24 and 20:20. The second καί
  correctly carries "and + also". In καὶ ἡμᾶς it is the coordinator, and
  in the correlative pair it also has additive force ("us too"). BSB's
  "also" modifies "us", which the second καί stands before, not "the
  Lord". So "also" cannot belong to the first καί. 1 Thessalonians 2:15
  links its καὶ ἡμᾶς the same way (καί = "and + as well"). "He will raise"
  stays on the finite ἐξεγερεῖ.
- 6:7 ἐστιν = "means": kept. ἐστιν is the main verb of the sentence. It
  equates the ὅτι-clause ("that you have lawsuits") with ἥττημα, and BSB's
  "means" has that same role, linking "The fact that you have lawsuits" to
  "you are defeated". Making ἐστιν = "are" would move it to a different
  subject ("you") and leave the main verb without a Greek word. The reviewed
  files render ἐστιν as "means" in John 8:54, Matthew 9:13, Mark 7:34 and
  Galatians 6:15. ἥττημα = "are + defeated" is a noun rendered as a passive
  verb, like δικαιοσύνην = "are justified" and σωτηρίαν = "are saved" in
  Romans 10:10. The "are" is part of that verb, not a separate supplied
  copula. "that#1" stays `t` (added "that").
- 6:1 Τολμᾷ = "how dare he": kept. "how dare" is the English form of an
  indignant question, and the Greek verb itself is "dare". Acts 23:4 links
  "How dare you insult" wholly to λοιδορεῖς, which has no "dare" at all.
  John 2:16 does the same with "How dare". "he" is the person ending of the
  finite verb, resuming τις. "how" is not a free added adverb of manner.
  "as judges" in 6:4 is different: it supplies a noun (see Changes).
- 6:2: ἀνάξιοι = "not competent" is correct. The negative is the
  α-privative of the adjective, and there is no separate Greek negative.
  κριτηρίων = "to judge + cases" is also correct. κριτήριον ("tribunal,
  lawsuit") supplies both the judging and the cases. The author rightly
  moved "to judge" off ἐλαχίστων, which keeps "trivial" ("least, smallest").
  ἐστε = "are you" is on the finite verb.
- 6:4: βιωτικά = "everyday" is correct. κριτήρια = "to settle + matters" is
  kept: the legal sense of κριτήρια ("lawsuits, cases") is what "to
  settle" expresses. ἔχητε = "you need" is kept as the verb of having the
  cases. This matches 6:2. Splitting it as ἔχητε = "you need to settle"
  would put the legal meaning on the wrong word.
- 6:5 ὃς δυνήσεται = "enough": kept. "wise enough to arbitrate" expresses
  ability ("who will be able to arbitrate") with an English degree
  complement, so the meaning is the same. "to arbitrate" stays on the
  infinitive. οὕτως = "really" (publisher row) is kept: "is it so that …"
  is rendered "Is there really …".
- 6:9-10: confirmed. Each vice noun is linked to its own English word, with
  no interpretive note. BSB's paired rendering is kept as the publisher
  splits it: μαλακοί = "men who submit to", οὔτε = "or", ἀρσενοκοῖται =
  "perform homosexual acts". Every οὔτε/οὐ/οὐχ = "Neither"/"nor".
- "Do you not know" (6:2, 6:3, 6:9, 6:15, 6:19): οὐκ = "not", οἴδατε = "Do
  you + know". This is confirmed, as in Romans 6:16. In 6:16, οὐκ = "don't"
  with οἴδατε = "you know" is also confirmed: the contraction cannot be
  split. 6:15 μὴ γένοιτο = "Never" is confirmed as one unit. 6:9 μή = "not"
  with πλανᾶσθε = "Do + be deceived" is confirmed too.
- 6:15: confirmed. ἄρας = "take" has no person and no modal. "Shall I" is
  on the finite ποιήσω, joined with the predicate μέλη as "Shall I +
  unite", since making the members "members of a prostitute" is to "unite"
  them with her. "and" joins the participle to the main verb where the
  Greek has no καί, so it is `t` (Acts 8:30). "them" is a supplied object
  and is `t`. οὖν = "then".
- Readings: every verse's record has no `partial` key, so the publisher's
  Greek equals N1904 in all 20 verses. The author claims no different
  reading anywhere, and that is correct.
- Brief rules re-checked across the chapter. Supplied copulas and frames
  are `t`: 6:11 "is what", 6:13 "is … intended", 6:19 "who is#1". Added
  words are `t`: 6:5 "this", 6:8 "your own", 6:16 "with her", 6:17 "with
  Him", 6:18 "other", and now 6:4 "as judges" and 6:7 "very". No person
  word sits on a participle (6:1 ἔχων = "If + has", 6:15 ἄρας). Modal words
  are on finite verbs (6:18 "can commit", 6:9 and 6:12 "will"). No "of the",
  "to the", "for the", "with the" or "in the" sits on a lone article.
  Apart from the article + participle units (6:4, 6:16, 6:17, 6:18), the
  only articles linked to a word other than "the" are the possessives in
  6:18 (τοῦ, τό = "his").

## Answers to the author's doubts

- 6:1 "how": keep it on Τολμᾷ (Acts 23:4; see above).
- 6:4 "as judges": changed to `t` (see Changes). ἔχητε/κριτήρια: keep the
  author's split.
- 6:7: keep ἐστιν = "means" and ἥττημα = "are + defeated". "very": moved
  out to `t`.
- 6:5: keep both οὕτως = "really" and ὃς δυνήσεται = "enough".
- 6:19 ἔχετε = "you have received": keep. Having the Spirit "from God" is
  rendered as the present result of receiving, so the meaning of possession
  is the same. The note explains it.
- 6:6 ἀδελφός = "one brother": keep. "one … another" is the English
  reciprocal for the Greek "brother … brother". "one" renders the first
  member of the pair, as "another" renders the second, so it is not an
  added "one".
- 6:14: keep "and + also" on the second καί alone (see above). Joining both
  καί would claim "and" for the first καί, which BSB does not render.

## Still uncertain

- 6:4 κριτήρια = "to settle + matters" and 6:2 κριτηρίων = "to judge +
  cases" are freer English expansions. A stricter reading could make "to
  settle" and "to judge" `t` as supplied verbs. They are kept because each
  expresses the judicial sense of the noun itself.
- 6:7 ὅτι = "The + fact that": the head noun "fact" is kept on ὅτι by the
  Mark 8:16 precedent. A stricter reading could make "The … fact" `t` as a
  supplied head noun.
- 6:16 σῶμα = "in body" and 6:17 πνεῦμα = "in spirit": "in" belongs to
  BSB's reworded "one with her in body". It is kept on the noun because the
  Greek predicate noun ("one body") is what it renders.
