# BSB Luke 1: independent peer review (Claude)

Checked: 80 of 80 verses (1:1-80).
Final check: `fromtext` → `{"versesOk": 80, "problems": 0}`.

I checked every `g`, `s`, `t` and `m` line of every verse against N1904 and the
displayed BSB, including the `#n` occurrence of repeated English words. I
checked the reading claims against the publisher records in
`public/data/original-languages/bsb-word-links/luke.json`. Luke 1 has no Gospel
parallel, so I used the reviewed Matthew and Mark chapters for precedent.

## Changes (9 verses with link changes, 13 notes in 11 verses)

- 1:3: `g 6 = an orderly account` → `g 6 = orderly`, with `t an` and
  `t account`. Why: καθεξῆς is an adverb ("in order"). "orderly" renders it.
  "an account" is an object that English supplies for "write". The Greek has
  no noun here, so a tap on "account" should not show καθεξῆς.
- 1:8: `g 6 7 8 = was#0 on duty` → `g 6 7 8 = on duty`, with `t was#0`. Why:
  "was" is a supplied copula. BSB turns "in the turn of his division" into
  its own clause, "his division was on duty". Supplied copulas are `t`.
- 1:24: `g 13 = months`, `g 14 = for five` → `g 13 = for + months`,
  `g 14 = five`. Why: "for" renders the accusative of time, and only μῆνας
  shows that case. πέντε does not decline.
- 1:36: `g 18 = she + her#1` (αὐτῇ) and `g 19 20 = who was called` →
  `g 18 = her#1` and `g 19 20 = she who was called`. Why: τῇ καλουμένῃ is an
  article + participle, "the one called", which BSB renders "she who was
  called" (rule 3). The dative αὐτῇ, "for her", gives the "her" of "her sixth
  month". This was the publisher's own analysis (τῇ = "she who"). The
  author's version gave one pronoun two English words and left the
  substantival article without its "she".
- 1:55: `g 7 = to#1 Abraham` with τῷ as an unrendered article →
  `g 6 = to#1` (τῷ), `g 7 = Abraham`. Why: Ἀβραάμ does not decline, so the
  dative article is the only word that carries "to". The `s` reason ("no
  distinct counterpart") was not true. Reviewed Matthew 10:23 links τοῦ
  Ἰσραήλ the same way (τοῦ = of, Ἰσραήλ = Israel).
- 1:56: `g 5 = for about`, `g 6 = months` → `g 5 = about`,
  `g 6 = for + months`. Why: ὡς means "about". "for" renders the accusative of
  time on μῆνας, as in 1:24.
- 1:57: `g 2 = for Elizabeth` with Τῇ as an unrendered article → `g 0 = for`
  (Τῇ), `g 2 = Elizabeth`. Why: the name does not decline. The publisher row
  Τῇ = "for" was right. The author had moved "for" onto the name when the name
  was linked.
- 1:68: `g 5 = of Israel` with τοῦ as an unrendered article → `g 4 = of`
  (τοῦ), `g 5 = Israel`. Why: Ἰσραήλ does not decline, so this is the same
  case as 1:55 and Matthew 10:23.
- 1:77: `g 5 = to#1 + people` with τῷ as an unrendered article →
  `g 4 = to#1` (τῷ), `g 5 = people`. Why: this restores the publisher row,
  which was not wrong. The chapter links "to"/"of" on the article everywhere
  else before a noun with αὐτοῦ: 1:62 τῷ πατρὶ αὐτοῦ (τῷ = to), 1:32 and 1:23
  (τοῦ/τῆς = of). Reviewed Matthew 20:8 has τῷ ἐπιτρόπῳ αὐτοῦ (τῷ = to).
- Notes only: 1:5, 1:7, 1:13 (twice), 1:17, 1:24, 1:36, 1:40, 1:41 (twice),
  1:57, 1:60, 1:63. Before: "Same name; the publisher's Greek spells it
  Ἐλισάβετ / Ἰωάννην / Ἰωάννης / Ἠλίου." After: "Same name, spelled
  differently in BSB's Greek text." Why: the publisher's Greek table is not in
  the repository. The counts show that one word differs, but not how it is
  spelled, so a review file must not state the spelling as fact.

## Reading claims checked

- Partial records with unmatched N1904 words: 1:5 (27 N1904 words, 26
  matched, 27 publisher words), 1:7 (18/17/18), 1:13 (28/26/28), 1:17
  (24/23/24), 1:24 (16/15/16), 1:36 (22/21/22), 1:40 (10/9/10), 1:41
  (23/21/23), 1:57 (12/11/12), 1:60 (10/9/10), 1:63 (12/11/12). In each verse,
  the number of unmatched words equals the number of times Ἐλεισάβετ,
  Ἰωάνην/Ἰωάνης or Ἡλεία occurs. The publisher word count is the same as
  N1904's. These are name spellings with the same meaning, so a link with a
  note is right (rule 9).
- 1:15 (21/21/22): there is one extra publisher word and no unmatched N1904
  word. "the Lord" is ordinary English for anarthrous Κυρίου, so no reading is
  claimed. I agree.
- 1:22: the Greek counts match (22/22/22). Only the English counts differ (30
  target words, 32 publisher English words), so there is no Greek reading
  claim to make.
- Every other verse has no `partial` key, and no reading is claimed in it.

## Answers to the author's doubts

- 1:22, "When" on ἐξελθών, with the καί before ἐπέγνωσαν as `s`: **agree.**
  Reviewed Mark 6:34 has the same structure and the same participle: Καὶ
  ἐξελθὼν εἶδεν …, καὶ ἐσπλαγχνίσθη is "When Jesus stepped ashore and saw …,
  He had compassion". It has ἐξελθών = When + stepped ashore, the καί as `s`,
  and `t and`. The καί convention is for When-clauses with no participle to
  carry "When". Those are 1:57, 1:59 and Mark 11:18, where it is applied.
- 1:1 and 1:3, Ἐπειδήπερ linked across verses to "Therefore": **agree.** BSB
  recasts "Since many have undertaken …, it seemed good to me" as "Many have
  undertaken … Therefore … it seemed good to me". The causal link that
  Ἐπειδήπερ makes is kept. "Therefore" is the only English word that states
  it, and no Greek word in 1:3 could own it: κἀμοί is "also to me", and
  there is no οὖν. `s` in 1:1 with `t Therefore` in 1:3 would be a split pair.
  Moved and cross-verse links are already used in reviewed chapters
  (1 Thessalonians 1, Galatians 2 and others).
- 1:36, αὐτῇ = she + her: **changed** (see above). The other parts of the
  doubt I agree with. οὗτος ("this" month) is rightly `s`, because BSB makes
  the woman the subject. "in" is rightly `t`, because it belongs to the English
  frame "is in her sixth month".
- 1:38, Ἰδού = "I am": **agree** to keep. The presentational Ἰδού ("here is
  the Lord's servant") is what BSB turns into "I am the Lord's servant". `s`
  with `t I am` would split the pair.
- 1:37, "ever" joined with οὐκ … πᾶν: **agree.** οὐ … πᾶς is the Semitic "not
  … any" = "none at all". In "no word … will ever fail", "ever" carries the
  emphasis of πᾶν, not a time sense. It belongs with the pair, not with `t`.
- 1:5 ἐξ = "belonged to" with `t who`, and 1:27 ἐξ = "of" with `t who was`:
  **agree.** Both verses link ἐξ to the English that renders it and leave
  only the supplied relative (and copula) as `t`. The two are consistent.
- 1:9, "to" on τοῦ θυμιᾶσαι: **agree.** The articular infinitive is the
  source of BSB's "to". English sets it at the head of the joined pair "enter
  and burn incense". εἰσελθών is a participle and has no "to" of its own.

## Also checked and kept

- The author's corrections of publisher rows are right. "When" is moved off
  καί/δέ/ἐγένετο (1:12, 1:41, 1:57, 1:59). Negatives are split off verbs
  (1:13, 1:15, 1:20, 1:30). Copulas, subjects and objects are `t` (1:2 "they"
  and "by", 1:12 "him", 1:25 "me", 1:28 "The angel", 1:63 "Zechariah", 1:65
  "people", 1:66 "this", 1:68 "be"). The participle "and" is `t`. Other
  corrections: 1:29 ἡ = Mary and ποταπός = "what kind of"; 1:34 ἔσται = can +
  be; 1:44 ὡς = "as soon as"; 1:48 με = me; 1:62 τό as `s` with `t to find out`
  (a lone article cannot carry a verb phrase); 1:64 ἀνεῴχθη understood again
  as "was released".
- Joined idioms: 1:10, 1:31, 1:34, 1:39, 1:42, 1:50, 1:59, 1:70, plus the
  "replied" pairs and the "home" and "forever" phrases.
- 1:9, 1:18, 1:34, 1:38, 1:40: a preposition is `s` as "absorbed" in a
  transitive English verb (enter, asked, left). Precedent is mixed. Reviewed
  Matthew 18 and 24 and Mark 6 and 9 use `s`. The Mark 16 peer joined εἰς to
  the verb. Neither form is wrong, so I made no change.
- 1:15, 1:35, 1:41, 1:67: "the Holy" on Ἅγιος follows reviewed Mark 1:8 and
  Matthew 1:18.

## Still uncertain

- 1:43: τοῦτο = "so honored" is interpretive ("whence is this to me" → "why
  am I so honored"). It is kept with its note, because `s` + `t` would split
  the pair.
- Connective renderings with added nuance are kept from the publisher: 1:11
  δέ = "Just then", 1:21 καί = "Meanwhile", 1:40 καί = "where", and 1:8
  Ἐγένετο δέ = "One day". None of these English words has another Greek
  source.
- 1:5, 1:11, 1:26, 1:65: "of"/"in" is on a declinable noun, with its article
  as `s`. The publisher rows were left alone because the noun itself shows the
  case. The change in 1:55, 1:57 and 1:68 is only where the name does not
  decline.
