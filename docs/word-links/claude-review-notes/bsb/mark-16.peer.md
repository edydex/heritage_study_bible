# BSB Mark 16: independent peer review (Claude)

Checked: 21 of 21 verses (16:1-20, plus N1904's shorter ending at 16:99).
Final check: `fromtext` → `{"versesOk": 21, "problems": 0}`.

I checked every line of every verse against the Greek and the BSB English.
I checked the reading claims against the publisher records in
`public/data/original-languages/bsb-word-links/mark.json`. Matthew 28:1-10
(reviewed) and the reviewed Mark chapters were used for precedent.

## Changes (2)

- 16:5: `g 1 = When they entered` + `s 2` εἰς ("absorbed in entered") →
  `g 1 2 = When they entered`. Why: the `s` reason itself says "entered"
  renders the preposition, so it is linked, not left out. The reviewed Mark
  verses join εἰσ- verb + εἰς under a transitive "entered" (3:1 εἰσῆλθεν …
  εἰς, 7:24 εἰσελθὼν εἰς, 11:2 εἰσπορευόμενοι εἰς).
- 16:99: the `s` reason "BSB does not print the shorter ending of Mark found
  in N1904" → "BSB has no verse for the shorter ending of Mark that N1904
  prints as 16:99". Why: the publisher data only shows that BSB has no such
  verse (`unavailable` 16:99 = greek-edition-differs). Nothing in the
  checkout shows whether BSB prints it in a footnote, so the note claims
  only what is shown. `x targetAbsent` and all 33 tokens as `s` are kept.

## Reading claims checked

- 16:2: the publisher record is partial (14 N1904 words, 13 matched, 14
  publisher words). μνῆμα is the only N1904 word absent from the publisher's
  groups, which fits BSB's Greek μνημεῖον. Same meaning, so the link "tomb"
  with a note is right (rule 9).
- 16:4: partial (11, 10 matched, 11). ἀνακεκύλισται is the only unmatched N1904
  word, which fits ἀποκεκύλισται. Same meaning, so the link with a note is
  right.
- 16:18: partial (17, all 17 matched, 21 publisher words). The 4 extra words
  fit (καὶ) ἐν ταῖς χερσίν. `t with their hands` with that reason is right.
  BSB does not render the extra καί, and the reason does not claim it does.
- Every other verse: no `partial` key. I found no reading claim in them.

## Answers to the author's doubts

- 16:20, καί `s` + "and" before "the Lord" `t`: **agree.** This is not a
  split pair. The Greek καί joins the two participles συνεργοῦντος and
  βεβαιοῦντος. BSB makes the second one "confirming", with no conjunction.
  The English "and" joins "preached everywhere" to the genitive absolute,
  which has no conjunction in Greek. Linking καί to that "and" would tell
  the reader that καί joins those two clauses, which it does not.
- 16:8, "not" on οὐδέν with οὐδενί = "to anyone": **agree.** BSB renders both
  negatives: "not … a word" for οὐδέν ("nothing") and "to anyone" for οὐδενί
  ("to no one"). Mark 1:44 joins μηδενὶ μηδέν only because BSB has no word
  there for μηδέν. Here the split gives each word its own English.
- 16:1, αὐτόν = Jesus with `t the body of`: **agree.** The Greek has no word for
  "body". ἡ = "the mother" is also right; Mark 1:19, 2:14 and 3:17-18 link
  τόν = son in the same construction.
- 16:16, ὁ πιστεύσας = "Whoever believes" and ὁ … ἀπιστήσας = "whoever does
  not believe": **agree.** This follows rule 3 and the reviewed Mark verses
  (7:10 "Anyone who curses", 13:13 ὁ … ὑπομείνας = "the one who
  perseveres"). Matthew 10:39-41 kept ὁ apart, so the precedent is mixed. The
  note says that the same article also governs βαπτισθείς, which covers it.
- 16:15 "to every" (πάσῃ) and 16:17 "in new" (καιναῖς): **agree** to keep
  them. The dative belongs to the whole phrase; the publisher's placement is
  not wrong.
- 16:2, "just" inside "just after sunrise": **agree** to keep it. The three
  tokens of the genitive absolute are rendered as one phrase. "just" fits
  λίαν πρωΐ and does not claim a Greek word that is not there.

## Also checked and kept

- 16:1, 16:5, 16:11, 16:14: When/as is on the participle or genitive
  absolute, not on καί/δέ. The participle "and" is `t` in 16:1, 8, 10, 13, 15
  and 20, as in Matthew 28:7-9.
- Negatives split off verbs: 16:6, 16:8, 16:13 (οὐδέ = but + not + either),
  16:14, 16:18 (οὐ μή = not). ἀπιστέω keeps "did/does not believe" in 16:11 and
  16:16, since the negation is inside the verb.
- "of the" / "to the" / "on the" on an article (16:2, 16:3, 16:13, 16:14) and
  τόν = His (16:20) follow the reviewed Mark chapters. In 16:14 the dative is
  shown only on τοῖς, because ἕνδεκα does not decline.
- 16:8: ἀπό stays `s`. Unlike 16:5, ἀπὸ τοῦ μνημείου belongs to ἔφυγον, while
  BSB makes "the tomb" the object of "left" (ἐξελθοῦσαι).
- 16:18: καλῶς ἕξουσιν joined as one idiom is kept. Mark 1:32 and 1:34 split
  κακῶς ἔχοντας and Mark 2:17 joins it, so the precedent is mixed. The joined
  group is not wrong.
- 16:18: `t their#1` with anarthrous χεῖρας is kept. There is no article or
  pronoun for "their".

## Still uncertain

- 16:12: πορευομένοις = "along" (publisher row, with a note). BSB merges the
  two participles περιπατοῦσιν and πορευομένοις into "walked along". The link
  is loose but not wrong.
- 16:18 καλῶς ἕξουσιν and 16:16 ὁ + participle could be split if the project
  settles on one rule. See the precedent above.
