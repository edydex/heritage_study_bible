# BSB Acts 15: independent peer review (Claude)

Checked: 40 of 40 verses (15:1-33 and 15:35-41), every `g`, `s` and `t`
line, against N1904, BSB's English, each verse's EVIDENCE line and the
publisher record in `public/data/original-languages/bsb-word-links/acts.json`.
15:34 is in neither N1904 nor BSB's main text and stays out of the file.
No KEEP blocks.
Final check: `fromtext` → `{"versesOk": 40, "problems": 0}`.

Changes: 4 verses. One link change (15:23) and three note-only changes
(15:24, 15:25, 15:39). The other 36 verses are kept exactly as the author
left them.

## Changes

- 15:23 "this letter": before γράψαντες = "this letter" → after γράψαντες
  = "letter" (note "γράψαντες ("having written") is rendered letter, the
  thing written") and "this" `t` ("English supplies a demonstrative pointing
  to the letter that follows; γράψαντες has no object"). "letter" is an
  honest shifted rendering of the participle: BSB names the writing by the
  thing written. But "this" points to the text that follows. N1904 (like
  the publisher's Greek here, which equals N1904) has no demonstrative, so
  "this" is a supplied object word and belongs in `t` (the "this" convention).
- 15:24 Ἐπειδή `s` note: "BSB leaves Ἐπειδή ("since") untranslated and
  starts a new sentence." → "BSB makes this verse a sentence of its own, so
  Ἐπειδή ("since") has no English word here; its causal link is carried by
  So at the start of 15:25." The old note did not say where the causal
  sense went.
- 15:24 "went out" `t` note: "N1904 has no verb here; …" → "N1904 has no
  word for went out; BSB follows a reading with an extra word here." N1904
  does have a verb at that point (ἐτάραξαν), so "no verb here" was unclear.
- 15:25 "So" `t` note: "English marks the result of 15:24; the Greek has no
  connective here." → "English marks the result of 15:24, whose Ἐπειδή
  ("since") opens the Greek sentence; this verse has no connective in the
  Greek." This names the link to Ἐπειδή without making a cross-verse link.
- 15:39 ὥστε note: "rendered so sharp that" → "rendered so … that, around
  sharp". "sharp" is linked to παροξυσμός, so the old note seemed to put it
  on ὥστε.

## Answers to the author's doubts and the points raised

- **15:2 στάσεως = engaging, ζητήσεως = in + debate**: kept. BSB folds
  "dissension and debate … with them" into "engaging these men in sharp
  debate". "engaging" carries the clash that στάσις names, and "debate" is
  ζήτησις. Joining both nouns on "debate" would make "debate" stand for
  στάσις too, and "engaging" would then need a home on γενομένης, which
  does not mean it either. The publisher row is a defensible shifted
  rendering, so it was not changed for taste. τῷ Παύλῳ καὶ τῷ Βαρνάβᾳ `s`
  is right: BSB's "Paul and Barnabas" are the ones appointed (Παῦλον καὶ
  Βαρνάβαν), and the dative pair is only the understood subject of
  "engaging". πρός (12) `s` with αὐτούς = "these men" is also right.
- **15:23 γράψαντες and διὰ χειρός**: "letter" kept on γράψαντες ("this"
  moved to `t`, above). διὰ χειρὸς αὐτῶν = "sent them with" kept: "by the
  hand of" in a letter means the bearers who deliver it, and "sent them
  with" is BSB's way of naming that delivery. "them" is αὐτῶν in a new
  role, so it is linked. The alternative is "sent" `t`, as BSB's
  continuation of 15:22. That would only be stricter, not clearly more
  correct, so the link was kept. The participle "and" `t` is right, since
  no καί stands there.
- **15:8 "did" on δούς, 15:11 "are" on σωθῆναι, 15:22 "chose" on
  ἐκλεξαμένους**: confirmed. Each repeat has the same role as the stated
  word. In 15:8 καθὼς καὶ ἡμῖν leaves out the giving: "He did to us" is
  "He gave to us". In 15:11 καθ’ ὃν τρόπον κἀκεῖνοι leaves out "are saved".
  "are" is the auxiliary standing for that verb, not a supplied copula.
  In 15:22 Ἰούδαν … καὶ Σιλᾶν stand in apposition to ἄνδρας, the object of
  ἐκλεξαμένους, so "They chose Judas … and Silas" repeats that choosing.
  No repeat adds a tense the Greek lacks. "He" (15:8) and "They" (15:22)
  are rightly `t`.
- **15:8 ὁ `s`, καρδιογνώστης = "who knows the heart"**: confirmed. ὁ
  belongs to the whole phrase ὁ καρδιογνώστης Θεός ("the heart-knowing
  God"). BSB's "God" has no article, and the agent noun "heart-knower"
  already contains the "who". καθώς = "just as" with καί `s` matches the
  Acts 11:15 peer decision.
- **15:24 Ἐπειδή `s` and 15:25 "So" `t`**: confirmed as the honest form.
  "So" does carry the causal link that Ἐπειδή sets up: BSB turns "since we
  heard …, it seemed good" into two sentences joined by "So". But both texts
  divide the verses at the same place, and a cross-verse link may not be
  made just to move a connective. The notes now say this on both sides.
  ἠκούσαμεν = "It has come to our attention" (the publisher row had this on
  Ἐπειδή) is right.
- **15:39**: ἐγένετο = "was", παροξυσμός = "disagreement + sharp" and ὥστε =
  "so + that" are confirmed. ἐγένετο is the only verb, and "was" renders it
  (it is not a supplied copula). The παρ-οξυ- of παροξυσμός is the
  "sharpness". ὥστε gives the result "so … that". "Their" `t` and the
  participle "and" `t` are right. τε `s` is right too: it pairs with
  15:40's δέ, which BSB renders "but".
- **15:14 ἐθνῶν = "the Gentiles", "them" `t`**: confirmed. BSB moves the
  noun forward as the object of "visited" and leaves "them" at the noun's
  original place. Linking the noun to the noun is the more useful and
  equally honest choice. "us" `t` is right. τῷ ὀνόματι αὐτοῦ = "to be …
  own" + "His" (τῷ `s`) fixes the publisher's lone article carrying "to
  be".
- **15:30 Οἱ … ἀπολυθέντες = "the men were sent off"**: confirmed (rule 3).
  καί = "where" is right: the καί stands before the participle chain, not
  inside it. Both "and"s are participle "and"s with no καί, so `t`.
- **15:2, 15:33, 15:36 "see" / "to return" / "to see" `t`**: confirmed.
  πρός means "to" and πῶς means "how". The verbs are English additions. In
  15:36 ἐπισκεψώμεθα is already "Let us + visit".
- **Letter formulas**: χαίρειν = "Greetings" and Ἔρρωσθε = "Farewell"
  confirmed. Each is the standard opening or closing formula, linked as a
  unit with a gloss note.
- **Amos 9 (15:16-18)**: confirmed word by word. In 15:16 the first τήν =
  "the" and πεπτωκυῖαν = "fallen", with the repeated attributive τήν `s`.
  The καί before τὰ κατεστραμμένα is `s` because BSB starts a new sentence.
  τὰ κατεστραμμένα = "ruins" is joined as article + participle. In 15:17
  ὅπως ἄν = "so that", ἐφ’ οὕς = "who", ὄνομα = "by + name", μου = "My",
  and the resumptive ἐπ’ αὐτούς is `s`. 15:18 keeps the publisher rows.
- **Readings**: every reading claim was checked against the publisher
  record. Only 15:3, 15:16, 15:20, 15:24, 15:25, 15:37, 15:38 and 15:41 have
  a `partial` record. In each, the N1904 word that the publisher's rows
  leave unlinked, together with the unlinked BSB English, matches the
  author's note:
  - 15:3 Σαμάριαν / "Samaria" (1 unmatched, 1 extra).
  - 15:16 κατεστραμμένα / "ruins" (1/1).
  - 15:20: all 17 N1904 words matched, 1 extra word, "the" unlinked.
  - 15:24: all 16 matched, 1 extra, "went out" unlinked.
  - 15:25 ἐκλεξαμένους / "to choose" (1/1).
  - 15:37 συνπαραλαβεῖν and Ἰωάνην / "to take John" (2/2).
  - 15:38 συνπαραλαμβάνειν / "to take" (1/1).
  - 15:41: 1 extra, no English unlinked, and nothing is claimed.

  "ruins" (same meaning) and "to choose" (another form of the same verb)
  are rightly linked with notes. "the" (15:20) and "went out" (15:24) are
  rightly `t` with the reading reason. The note wording follows reviewed
  precedent ("N1904 has no article before …; BSB follows a reading with an
  extra word here"). No note in the review file states the publisher's
  exact Greek.

## Other rows checked and kept

- Lone articles: no "of the", "to the" or "in the" sits on a lone article
  anywhere in the chapter, and no article carries anything but "the" or a
  possessive (15:31 τῇ = "its").
- Supplied words `t`: 15:11 "it is" (cleft), 15:19 "It is", 15:22 "two",
  15:23 "your", 15:27 "you" and "we are writing", 15:31 "the people" and
  "it", 15:33 "there".
- Greek words in a new role, linked: 15:5 αὐτούς = "The Gentiles", 15:2 ἐξ
  αὐτῶν = "believers", 15:19 ἐγώ = "my", 15:25 ἡμῖν = "we".
- Connectives rendered by another connective: 15:2 καί = "along with",
  15:4 τε = "to whom", 15:6 τε = "So", 15:12 καί = "as". τε of τε … καί is
  `s` in 15:3, 15:9 and 15:32.
- Negatives split: 15:9 οὐθέν = "no", 15:19 μή = "not", 15:24 οὐ =
  "without", 15:28 μηδέν = "not + anything", 15:38 both μή = "not". 15:1 οὐ
  δύνασθε = "you cannot" stays joined, because "cannot" is one English
  word.

## Still uncertain

- 15:21 ἔχει = "has" with τοὺς κηρύσσοντας = "been proclaimed": BSB recasts
  "has those who proclaim him" as a passive perfect, so the English "has" is
  an auxiliary. Joining ἔχει with the article + participle as "has been
  proclaimed" would be tidier. The split traces each English piece to its
  source, so it was kept.
- 15:23 "sent" on διὰ χειρός (see above). The alternative is `t`.
- 15:2 στάσεως = "engaging" (see above). It is a paraphrase link, kept as
  the publisher's.
