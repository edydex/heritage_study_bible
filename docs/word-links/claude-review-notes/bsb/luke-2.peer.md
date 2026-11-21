# BSB Luke 2: independent peer review (Claude)

Checked: 52 of 52 verses

These are 2:1–52. No verse was marked KEEP by an earlier reviewer.

Final check: `fromtext` → `{"versesOk": 52, "problems": 0}`.

Every `g`, `s` and `t` line was read against N1904 and the displayed BSB,
including the `#n` occurrence of repeated English words. Reading claims were
checked against the publisher's rows and word counts in
`public/data/original-languages/bsb-word-links/luke.json`. Conventions were
compared with the reviewed Matthew 28:5, 28:10 and Mark 9:21.

## Changes (links in 2 verses, notes in 4 verses)

- 2:10: `g 5 = Do not` and `g 6 = be afraid` → `g 5 = not` (Μή) and
  `g 6 = Do + be afraid` (φοβεῖσθε). Why: negatives are split off the verb,
  and the verb keeps "do". The identical Μὴ φοβεῖσθε = "Do not be afraid" is
  linked this way in the reviewed Matthew 28:5 and 28:10.
- 2:33: `g 2 = The` (ὁ) and `g 4 = Child’s` (αὐτοῦ) → `s 2` (article) and
  `g 4 = The Child’s`. Why: in "The Child’s father", "The" goes with "Child",
  which renders αὐτοῦ ("his"). It is not the article of "father". The
  reviewed Mark 9:21 links τὸν πατέρα αὐτοῦ = "the boy’s father" the same
  way: τόν `s`, αὐτοῦ = "the boy’s". 2:38 here also links αὐτοῦ = "the
  Child".
- 2:19, note only: "Same verb; the publisher's Greek spells it
  συμβάλλουσα." → "Same verb, spelled differently in BSB's Greek text." Why:
  the publisher's Greek table is not in the repo, so its spelling can't be
  stated as fact. The link συνβάλλουσα = pondered is unchanged.
- 2:48, note only: "N1904 has the present ζητοῦμεν; the publisher's Greek
  has the imperfect ἐζητοῦμεν of the same verb." → "Same verb; BSB's Greek
  text has a different form of it here (N1904: present ζητοῦμεν)." Why: the
  same reason. The link ζητοῦμεν = have been + searching for is unchanged.
- 2:51, `t these` reason only: "BSB follows a reading with ταῦτα ("these")
  after ῥήματα, which N1904 lacks." → "BSB follows a reading with an extra
  word here, rendered these, which N1904 lacks." Why: the same reason. The
  extra word is probably ταῦτα, but that can't be checked here.
- 2:36, note only: "BSB leaves ἀπὸ τῆς παρθενίας αὐτῆς ("from her
  virginity") untranslated; had been married implies it." → the same note
  without the last clause. Why: "had been married" does not imply "from her
  virginity", so that part of the note was inaccurate.

## Reading claims checked against the publisher counts

- 2:12: the Greek counts are 11 / 11 / 12. One word is extra in the
  publisher's Greek and no N1904 word is unmatched. No reading is claimed;
  σημεῖον = "a sign", and "will be" is `t` because the Greek clause has no
  verb. Agreed.
- 2:19: the counts are 13 / 12 / 13. One N1904 word is unmatched and one
  publisher word is extra. The draft left only συνβάλλουσα (with "and
  pondered them") unowned, so this is the same verb in another spelling.
  The link is right; the note was softened (above).
- 2:21: the Greek counts are 26 / 26 / 26, so the Greek is identical. Only
  the English differs (25 target words against 24 publisher words). No
  reading is claimed, and ἐν τῇ κοιλίᾳ `s` is a translation choice. Agreed.
- 2:48: the counts are 24 / 23 / 24, one unmatched and one extra. The draft
  left ζητοῦμεν and "have been … searching" unowned, which fits another form
  of the same verb with the same meaning. Linking it is right (rule 9); the
  note was softened (above).
- 2:51: the counts are 24 / 24 / 25, one extra word and none unmatched. The
  draft left only "these" unowned, so BSB's "these" renders that extra word.
  `t these` with a reading reason is right. Linking "these" to τά would claim
  a rendering BSB does not make. The reason was softened (above).

## Answers to the author's doubts and the points raised

- 2:43, ἐν τῷ (+ ὑποστρέφειν) = "and": kept. BSB puts both time clauses
  under one "When" ("When those days were over and they were returning
  home"). The "and" is the English word that starts the ἐν τῷ clause, and
  the time sense comes from the shared "When". Making ἐν τῷ `s` and "and"
  `t` would create a split pair. The opening καί is a link to verse 42, not
  this "and", so it stays `s`. The note says what BSB did.
- 2:21, ἐκλήθη τὸ ὄνομα (αὐτοῦ) = "He was named" and τὸ κληθέν = "the name …
  had given": kept. "was named" renders "the name was called", and αὐτοῦ =
  "He" is the possessor turned into the subject. The neuter τὸ κληθέν agrees
  with ὄνομα and stands for it ("the [name] called by the angel"), so "the
  name" is its explicit referent. The participle unit is not a lone article,
  so rule 5 is not broken. The other option moves ὄνομα, the subject of
  ἐκλήθη, to the apposition, where the Greek has no noun. That would be the
  less accurate link.
- 2:17, τοῦ παιδίου τούτου = "Him" with "the Child" `t`: kept. "about Him"
  sits where περὶ τοῦ παιδίου τούτου sits ("the message … about this
  child"), and "Him" refers to those words. A referring pronoun may stand for
  the noun phrase (as in Matthew 18:27, τοῦ δούλου ἐκείνου = "His"). "the
  Child" fills an object slot that ἰδόντες does not have in Greek. Linking
  παιδίου there would claim that the Greek says "having seen the child".
- 2:25, ὁ ἄνθρωπος οὗτος = "who": kept. "who" refers to the same man and
  stands as subject of "was righteous and devout", which is where "this man"
  stands in Greek. So it is a referring pronoun for the noun phrase, not an
  English word that fails to refer to the Greek (the Mark 9:38 case). καί
  `s` is right because BSB turns the new clause into a relative clause.
- 2:2, ἐγένετο = "was" + "to take place": kept. γίνομαι supplies both the
  copula ("This was the first census") and the event ("to take place").
  Making "was" a `t` copula would wrongly say the Greek has no verb. This is
  one verb rendered twice, as ἀπῆλθον = "had left" + "gone" in 2:15.
- 2:35, καί = "as well" and δέ = "and": kept. In καὶ … δέ, δέ is the
  connective and καί means "also"; the standard lexicons and grammars
  give καὶ … δέ as "and also". BSB's "and … as well" matches that.

## Still uncertain (kept; not wrong enough to change)

- 2:27: ἐν (τῷ Πνεύματι) = "Led by" is the publisher's row. "Led" spells out
  what ἐν implies, and the note explains it. Another option is `t Led` with
  ἐν = "by".
- 2:44: καί = "before" and 2:46 καί = "Finally" are the publisher's
  connective renderings. They are kept; 2:44 has a note.
- 2:49: ἐν τοῖς = "in + house" gives the substantival article the noun
  "house". The note gives the literal "in the things of My Father". `t
  house` with τοῖς `s` would be the stricter alternative.
- 2:4: one "from" covers both ἀπό and ἐκ, and "in" is `t`. This is
  acceptable, because "from" means both prepositions.
