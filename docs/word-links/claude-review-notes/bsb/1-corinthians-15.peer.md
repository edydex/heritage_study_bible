# BSB 1 Corinthians 15: independent peer review (Claude)

Checked: 58 of 58 verses (15:1-58), in six sections of about ten verses.
Every `g`, `s` and `t` line was checked against the Greek, BSB's English and
the publisher record for each verse in
`public/data/original-languages/bsb-word-links/1-corinthians.json`. 15:19 is
the KEEP block reviewed earlier by Codex. It was read but not edited, and it
is identical to `scripts/original-languages/reviewed-bsb/1-corinthians-15.json`.
Final check: `fromtext` → `{"versesOk": 58, "problems": 0}`. `totext` of the
final JSON gives the peer text back unchanged.

Changes: 5 verses (15:5, 15:39, 15:42, 15:48, 15:54). Three change links;
two change only notes. All other author rows were confirmed.

## Changes

- 15:5 τοῖς δώδεκα. Before: τοῖς = "the", δώδεκα = "to#1 + Twelve". After:
  τοῖς = "to#1 the" (with a note), δώδεκα = "Twelve". δώδεκα is
  indeclinable, so only the article shows the dative. The settled rule for
  indeclinable words puts the case word on the article (Acts 13:23 τῷ
  Ἰσραήλ "to"; Romans 11). A number never carries a case word.
- 15:42 ἐν φθορᾷ / ἐν ἀφθαρσίᾳ. Before: ἐν (7, 10) `s`, with φθορᾷ =
  "perishable" and ἀφθαρσίᾳ = "imperishable". After: ἐν φθορᾷ =
  "perishable" and ἐν ἀφθαρσίᾳ = "imperishable" as joined units, and the
  `s` row is gone. The preposition is absorbed into BSB's adjective, not
  left untranslated. This follows the same book's precedent: 1 Corinthians
  2:7 ἐν μυστηρίῳ "mysterious" and 7:18 ἐν ἀκροβυστίᾳ "uncircumcised"
  (README rule 3). This settles the author's doubt.
- 15:54 "with". Before: ἐνδύσηται (5) = "has#0 been clothed with" and
  ἀφθαρσίαν = "the#1 imperishable", while the parallel "with#1" sat on
  ἀθανασίαν. After: ἐνδύσηται (5) = "has#0 been clothed" and ἀφθαρσίαν =
  "with#0 the imperishable". Now the two parallel clauses of the verse put
  "with" in the same place, as 15:53 does. The second ἐνδύσηται is `s`, so
  its "with" can only sit on the noun. This settles the author's doubt.
- 15:39 note only, on σάρξ (5) = "flesh#1". Before: "The second σάρξ is
  rendered after one kind of." After: "BSB leaves flesh out after the same
  and gives this σάρξ in the next clause, one kind of flesh." The old note
  did not say that the English word is in another clause.
- 15:48 notes only, on χοϊκοί and ἐπουράνιοι. The old notes said each is
  "rendered those who are of …". But "those" is on οἱ and "who are" is
  `t`. The new notes say "rendered of the earth / of heaven, with those on
  the article".

## Points checked in detail

- 15:39 σάρξ. BSB reads "Not all flesh is the same: Men have one kind of
  flesh, animals have another, birds another, and fish another." The Greek
  has σάρξ four times (2, 5, 12, 16) and BSB has "flesh" twice. The author's
  mapping is confirmed: (2) = "flesh#0", (5) = "flesh#1", and (12), (16)
  `s` as the extra Greek repeats. BSB really has no "flesh" with animals
  and birds. ἄλλη μὲν ἀνθρώπων has no noun, so its "flesh" is understood
  from the σάρξ just before (5). "flesh#1" therefore renders that σάρξ
  understood again, with the same meaning and role (the noun of "one kind
  of …"). "Men have" / "animals have" on the genitives match "The sun has"
  in 15:41.
- 15:40 and 15:44, words understood again. δόξα = "splendor#0 +
  splendor#1" is confirmed. The Greek states δόξα once, and BSB repeats it
  in the parallel clause with the same role (subject of "is of one degree /
  another") and the same meaning. ἡ (15) correctly takes "the#2". In 15:44,
  σῶμα (8) = "a#2 + body#2 + a#3 + body#3" is confirmed: ἔστιν καὶ
  πνευματικόν leaves σῶμα unstated, and BSB's second "a … body" has the same
  role (subject of existential ἔστιν). "heavenly/earthly bodies" on the
  substantival adjectives stays, as in 15:47-49 "earthly man" and 14:37.
  "There are" (15:40, no verb) is `t`. "there is" (15:44) stays on ἔστιν.
- 15:26. BSB reads "The last enemy to be destroyed is death." καταργεῖται
  (present passive indicative) = "to be destroyed" is honest: it keeps the
  verb's meaning and its passive voice. BSB recasts the verb as an
  infinitive phrase on "enemy" and adds an identifying copula. That "is" is
  a supplied copula, so `t` is right. The publisher's "to be destroyed is"
  over-claimed. This settles the author's doubt.
- 15:15. "from the dead" on ἤγειρεν is confirmed. The clause has no
  νεκρῶν, and Acts 2:24, Acts 13:37 and 1 Corinthians 6:14 all put BSB's
  added "from the dead" on the raising verb. "but" `t` (relative ὅν)
  follows Acts 2:24. εἴπερ = "if" and ἄρα = "in fact" stay. With εἰ, ἄρα
  has the sense "if after all", so the split is defensible. Joining them
  would also be correct, so this is not changed for taste.
- Readings. Every claim matches the `partial` records. 15:10 has 31/31
  N1904 words matched and 32 publisher words, so "that was" `t` with a
  reading note is right. 15:17 has 15/15 and 16, so "is" `t` with a reading
  note is right. 15:24 has 19 of 20 matched and 20 publisher words, so it
  is one word spelled differently: παραδιδοῖ = "He#0 hands over" with
  "Same verb, spelled differently in BSB's Greek text" is right. 15:49 has
  12 of 13 matched and 13: φορέσωμεν = "shall we bear" uses Romans 5:1's
  wording exactly (linked, mood noted), so it is right. 15:14 and 15:28 have
  one extra publisher word each, and the draft shows no English that
  depends on it, so claiming nothing is right. 15:54 has one extra word,
  whose English "the" is fully accounted for by N1904's ἀφθαρσίαν (as in
  15:53, which has no `partial` record), so claiming nothing is right. No
  review-file note names or spells the publisher's Greek.
- Old Testament and other quotations, word by word. 15:25 (Psalm 110:1)
  and 15:27 (Psalm 8:6): "God" and "Him#0" `t`, and the article as
  possessive "His#0" in 15:25. 15:32 (Isaiah 22:13): jussive "Let us" on
  φάγωμεν. 15:33 (the proverb). 15:45 (Genesis 2:7): εἰς `s` after
  "became". 15:54 (Isaiah 25:8). 15:55 (Hosea 13:14): θάνατε = "O Death"
  both times. All confirmed. Names Κηφᾶς "Cephas", Ἰάκωβος "James" and
  Ἀδάμ "Adam" (15:22, 45) are linked.
- Rules from the brief, checked across the chapter.
  - Negatives are split off verbs: 15:10, 14-17, 29, 32, 33, 36, 37, 46,
    51.
  - Supplied copulas are `t`: 15:11, 14, 17, 26, 37, 39, 40, 42, 46-48,
    55, 56. So are the supplied verbs in 15:21, 24, 42 and 57.
  - A participle carries no person: 15:58 "you" `t` with εἰδότες; 15:18,
    15:29 and 15:54 article + participle units.
  - Modal and person words are on finite verbs: 15:1 "I want to remind",
    15:12 "can + say", 15:35 "will#1 they come". 15:31 "I#1" is on ἣν ἔχω,
    not on the noun.
  - Lone articles carry only "the" or a possessive. The one case-word
    exception is now the indeclinable δώδεκα in 15:5.
  - Connectives BSB renders with another connective stay linked: 15:6 δέ
    "though", 15:10 ἀλλά "No", 15:15 δέ "In that case", 15:41 γάρ "and",
    15:46 ἀλλ’ "however", εἶτα/ἔπειτα "and then" (1 Timothy 2:13
    precedent). Relatives rendered "and" (15:9 ὅς) and "this gospel" (15:2
    οὗ) have reviewed precedents.
  - A word BSB renders with another meaning is `s`, with the English `t`:
    15:37 σπείρεις (8) `s` with "is" `t`; 15:50 τοῦτο `s` with "to you" `t`.
  - Extra Greek repeats are `s`: 15:39 σάρξ (12, 16), 15:41 δόξα (5, 9),
    15:53-54 the second ἐνδύσασθαι/ἐνδύσηται.
  - No μή question markers occur in this chapter.

## Answers to the author's doubts

- 15:5: changed (see above). "to" goes on the article τοῖς, not on the
  number.
- 15:26: "is" `t` is confirmed (see above).
- 15:2: τίνι = "the" stays. τίνι λόγῳ works as "the word (that)" here, and
  BSB's "the" fills τίνι's place as the word's determiner. `s` with "the"
  `t` would split a pair.
- 15:14: κενή (10) = "so" and καί = "and" stay. In "and so is your faith",
  "so" stands for the repeated predicate "worthless". καί gives the
  additive "and", and English has no other word for it.
- 15:20: Νυνί = "indeed" stays. It is the logical "as it is", and "indeed"
  renders that.
- 15:42: changed. ἐν is joined with each noun (see above).
- 15:54: changed. "with" moved to the noun, as in 15:53 (see above).

## 15:19 (KEEP, not edited)

No linking error was found. The rows follow the rules: "our hope + is" on
ἠλπικότες ἐσμέν, the second ἐσμέν = "we are", and πάντων = "than all". The
only issue is style. The notes on rows 7 8, 10 and 11 run to two sentences
and use loose wording ("actual hoped participle", "we-are copula"). That
can be tidied whenever Codex next touches the verse.

## Still uncertain

- 15:15 εἴπερ ἄρα: the split (εἴπερ "if", ἄρα "in fact") and a joined
  "if in fact" are both defensible. The split was kept.
- 15:40 "bodies" (#2, #3): these are folded into the substantival
  adjectives, following 15:47-49 and 14:37. A stricter reading would make
  them `t` as supplied nouns, or link them to σώματα as words understood
  again. The chapter's convention was kept.
