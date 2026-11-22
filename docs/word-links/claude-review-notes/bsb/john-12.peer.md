# BSB John 12: independent peer review (Claude)

Checked: 50 of 50 verses (12:1-50). The chapter has no KEEP blocks. I checked
every `g`, `s` and `t` line against N1904, the displayed BSB, the publisher
rows for John 12 in `public/data/original-languages/bsb-word-links/john.json`,
and the `partial` counts there for each reading claim. I also compared the
reviewed parallels and precedents: Matthew 21:9, Mark 11:9-10 and Luke 19:38
(εὐλογημένος with `t is`), John 1:49 (τοῦ Ἰσραήλ), John 7:33 (Ἔτι = longer),
John 9:8, Luke 13:7, Luke 17:8, Mark 9:28 and the do-support cases John 7:42,
7:45, Mark 2:18, 4:21, 4:38 (negatives inside contractions), Luke 8:10 (the
modal of a purpose subjunctive stays with the verb), John 6:66 (the extra-word
note on μαθητῶν), John 9:22 (ἀποσυνάγωγος, ἐάν τις), Mark 13:20 and Matthew
24:22 (negative + πᾶς joined), Mark 14:3-6 and Matthew 26:9-11 (anointing).
Final check: `fromtext` → `{"versesOk": 50, "problems": 0}`.

## Changes (3 verses)

- 12:40, links: `g 10` μή = "cannot" (note "μή ('not') with the subjunctive
  is rendered cannot.") + `g 11` ἴδωσιν = "they + see" → `g 10 11` μὴ ἴδωσιν =
  "they cannot see" (note "μὴ ἴδωσιν ('may not see') is rendered cannot see;
  the contraction holds both the negative and the modal of the subjunctive.").
  Why: consistency with 12:5 and the earlier chapters. They split a contraction
  off the verb only when its auxiliary is English do-support (don't, doesn't,
  didn't on the negative alone: John 7:42, 7:45, Mark 4:21, 4:38). When the
  auxiliary renders part of the Greek verb, the negative and the verb are
  joined: Isn't (John 9:8), haven't found (Luke 13:7), won't he tell (Luke
  17:8), couldn't (Mark 9:28), and the author's wasn't + sold (12:5). The "can"
  in "cannot" is BSB's modal for the purpose subjunctive ἴδωσιν, like "may" in
  Luke 8:10 (they may + see) and "will" in 12:35 (will + overtake), both linked
  to the verb. "cannot" is one word and cannot be split, so μή and ἴδωσιν are
  joined. Tapping "cannot" now shows "not … may see", not μή alone.
- 12:4, note only: `g 7` μαθητῶν = "of + disciples", "BSB's Greek adds a
  preposition meaning 'of' here; N1904's genitive gives the same sense." →
  "BSB's Greek has an extra word here with the same meaning; in N1904 the
  genitive alone gives 'of'." Why: the record shows only one extra publisher
  word, not what kind of word it is. The publisher's Greek must not be stated
  as fact. The new wording is the one accepted for the same case in John 6:66.
- 12:13, note only: `g 22` τοῦ = "of#1" gains "With the indeclinable name
  Ἰσραήλ, the article shows the genitive." Why: linking "of" to an article
  is not obvious, and the reviewed John 1:49 (σὺ Βασιλεὺς εἶ τοῦ Ἰσραήλ) has
  the same link with this note.

Every other line of the author's file is kept.

## Reading claims checked against the record

Only 12:4, 12:12 and 12:17 have a `partial` record.

- 12:4 (13/13/14; English 14/14/14): one extra publisher Greek word and no
  missing N1904 word. In the publisher's rows, "of" is the only English word
  with no group, so its owner must be the extra word. "of" also renders N1904's
  partitive genitive τῶν μαθητῶν, so the link with a same-meaning note (rule 9)
  is right. Only the note wording changed (see above).
- 12:12 (16/16/17; English 19/19/19): one extra publisher word, but all 19
  English words have an N1904 owner in the publisher's rows. No reading is
  claimed, and none should be.
- 12:17 (20/20/20; English 25/20/24): the Greek is the same length and fully
  matched. Only the publisher's English differs, so "continued to testify",
  "that" and "they" lost their rows. No reading is claimed, which is right.
  Ἐμαρτύρει = "continued to testify", ὁ ὤν = "they had been" and `t that` are
  sound. BSB keeps "when" (ὅτε), so it does not follow the ὅτι variant here.

## Points I was asked to settle

- 12:13: **agree.** καί ("even") `s`, εὐλογημένος = "Blessed#0 + Blessed#1",
  and both "is" `t`. This is honest: καί does not mean "Blessed is", so the
  publisher's καί = "Blessed#1 is" was wrong. The convention lets a word
  understood again link to each English repeat, and the participle is
  understood again with "the King of Israel". The `t is` reason matches
  Matthew 21:9, Mark 11:9-10 and Luke 19:38 word for word. "He who comes" =
  ὁ ἐρχόμενος and "of the Lord" = Κυρίου also match Matthew 21:9 and Mark
  11:9.
- 12:13 τοῦ Ἰσραήλ: **agree** with τοῦ = "of", Ἰσραήλ = "Israel". This is the
  indeclinable-name convention and matches John 1:49 (note added).
- 12:16: **confirmed.** BSB reverses the two facts: "remembered what had been
  done to Him" is καὶ ταῦτα ἐποίησαν αὐτῷ, and "they realized that these very
  things had also been written about Him" is ὅτι ταῦτα ἦν ἐπ’ αὐτῷ γεγραμμένα.
  So ὅτι = "that", second ταῦτα = "what", ἐποίησαν = "had been done" (with the
  passive note), first ταῦτα = "these + things", ἦν = "had", γεγραμμένα =
  "been written". "and they realized" `t` is right: the Greek has one verb,
  ἐμνήσθησαν, governing both facts. "very" `t` is right too. καί = "also" is
  kept (see the author's doubt below).
- 12:5 / 12:39 / 12:40: 12:5 οὐκ ἐπράθη = "wasn’t + sold" is right, since
  "was" is the passive auxiliary of ἐπράθη. 12:39 οὐκ ἠδύναντο = "they were
  unable" is right: "unable" holds the negative and δύναμαι, as cannot = οὐ
  δύναμαι does throughout Matthew, Mark, Luke and John 7-8. 12:40 is changed
  to match (see Changes).
- 12:37: **agree** with δέ `s` and "Although + had performed" on the genitive
  absolute πεποιηκότος. The convention puts When/As/After (here the concessive
  Although) on the participle, not on δέ. The reviewed Mark 14:3 does the same
  (While + was on ὄντος). The publisher's δέ = "Although" was wrong. "still"
  `t` is right: δέ is the narrative transition, and "still" goes with
  "Although".
- 12:35: **agree** with Ἔτι = "longer" and μικρὸν χρόνον = "For a little
  while". This matches John 7:33 (Ἔτι = longer, χρόνον μικρόν = a little
  while). Here the accusative of duration also gives the "For".
- 12:4: the only reading claim. It matches the record (see above).
- 12:12 / 12:17: no reading claimed, as the record requires.

## The author's doubts

- 12:16 καί: **keep** καί = "also". "also" in "had also been written" is the
  word that keeps the Greek link between the two facts (written … and done).
  The English "and" belongs to BSB's added "and they realized". Either choice
  leaves one English word `t`, so the publisher's row is not wrong and stays.
- 12:5 / 12:40: settled above. 12:40 is now joined like 12:5.
- 12:19: **keep** ὠφελεῖτε = "is doing you + good", οὐκ … οὐδέν = "no", `t
  this`. Splitting the negatives off the verb is the convention. One group for
  the whole clause would put the negatives on a verb group.
- 12:24: **keep** "a seed" `t`. μόνος means "alone, by itself" and is fully
  rendered by "only". "seed" names the κόκκος again and does not mean "alone".
- 12:48: **keep** ἔχει = "There is + for" with αὐτόν `s`. "There is a judge
  for X" is BSB's recasting of "X has a judge", so "for" belongs with ἔχει.
  The publisher's αὐτόν = "for" put a pronoun on a bare preposition, and the
  person is already linked through ὁ ἀθετῶν.
- 12:27: **keep** ἀλλά = "No". It is a strong but fair rendering of the
  adversative that rejects the prayer, and `s` + `t` would be a split pair.
- 12:29: **keep** ὁ ἑστώς = "standing there". "standing there" is the normal
  English for ἑστώς ("standing by"). "there" adds no separate idea.

## Still uncertain

- 12:40: the author's version (μή = "cannot" alone) treats "can" as English
  only, like do-support. I joined because BSB's modal for a purpose
  subjunctive stays with the verb elsewhere (Luke 8:10, 12:35). A reviewer who
  sees "can" as an added ability sense could go back.
- 12:7: ἵνα `s` with εἰς = "in preparation for" (the author's change from the
  publisher's ἵνα = "in preparation", εἰς = "for"). Both are defensible. I kept
  the author's version because BSB's "She has kept" is a statement, not a
  purpose clause.
- 12:50: the second λαλῶ = "to say" (the publisher's row) is kept. BSB merges
  "what I speak … so I speak" into one clause. `s` for the repeated λαλῶ with
  `t to say` would also be possible.
