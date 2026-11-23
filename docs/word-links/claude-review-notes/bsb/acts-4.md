# BSB Acts 4: author review (Claude)

Verses reviewed: 36 (4:1-30, 4:32-37). Kept unchanged: 4:31 (KEEP block,
already reviewed by Codex). Final check: `fromtext` →
`{"versesOk": 37, "problems": 0}`.

115 of the 545 publisher `g` rows (outside 4:31) changed, in 34 verses;
4:6 and 4:8 kept every publisher row and only settled TODO tokens (4:6).
About 27 of the changed rows only gained unlinked Greek tokens, with the
English unchanged: article + participle (4:11 ὁ ἐξουθενηθείς, 4:12 τὸ
δεδομένον, 4:16 τοῖς κατοικοῦσιν, 4:24 ὁ ποιήσας); fixed units (4:2 διὰ τό
= that, 4:9 ἐν τίνι = how, 4:17 ἐπὶ πλεῖον = any further, 4:25 Ἵνα τί =
Why, 4:26 ἐπὶ τὸ αὐτό = together, 4:29 τὰ νῦν = now, 4:30 ἐν τῷ = as, 4:36
ὅ ἐστιν μεθερμηνευόμενον = meaning); idioms (4:3 ἐπέβαλον … τὰς χεῖρας =
They seized, as Mark 14:46 / Matthew 26:50; 4:11 κεφαλὴν γωνίας = the
cornerstone, as Luke 20:17; 4:19 ἀποκριθέντες εἶπον = replied; 4:34
κτήτορες … ὑπῆρχον = owned; 4:36 Κύπριος τῷ γένει = from Cyprus); negatives
with "cannot" (4:16, 4:20 οὐ δυνάμεθα, as John and Luke) and 4:12 οὐκ …
οὐδενί = no one. The rest were corrected, split or moved.

## Publisher rows corrected

English words with no Greek counterpart that had been folded into a Greek
word (now `t`):

- Supplied objects: "them" (4:3 ἔθεντο, 4:7 ἐπυνθάνοντο, 4:18
  παρήγγειλαν, 4:35 ἐτίθουν), "it" (4:16 ἀρνεῖσθαι, 4:37 ἔθηκεν), "this"
  (4:24 ἀκούσαντες), "their property" (4:34 πωλοῦντες).
- Supplied subjects: "this message" (4:17, had been on διανεμηθῇ), "Peter
  and John" (4:23, on ἦλθον; no pronoun in the Greek), "They" (4:28, on the
  infinitive ποιῆσαι), "this" in "let this be known" (4:10).
- Supplied copulas and frames: 4:10 "It is" had been on ὅτι; 4:16 "It is"
  (clear); 4:27 "is" and "very" had been on the article τῇ.
- Participle joiners: "and" in 4:7 and 4:18, "and then" in 4:15.
- Others: 4:1 "guard" (the Greek says "captain of the temple"); 4:10 "then"
  and "but" (but had been on the relative ὅν); 4:9 "to determine" had been
  on ἐν (now ἐν τίνι = how); 4:11 "Jesus" in "This Jesus" (οὗτος = This);
  4:14 "there"; 4:18 "again" (had been on αὐτούς); 4:32 "that" (claimed
  that).

Words on the wrong Greek word:

- When/While/After moved from δέ to the participle or genitive absolute:
  4:1 While (Λαλούντων), 4:13 When (Θεωροῦντες), 4:21 After
  (προσαπειλησάμενοι), 4:24 When (ἀκούσαντες).
- Auxiliaries and "up/to" on the wrong word: 4:1 "up to" was on αὐτοῖς (now
  "came up to" = ἐπέστησαν, "them" = αὐτοῖς); 4:7 "did" was on ὑμεῖς (now
  did + do on ἐποιήσατε, you = ὑμεῖς); 4:25 "do" was on ἔθνη (now do + rage).
- Lone articles carrying other words: 4:5 αὐτῶν had "the" (now on τούς,
  αὐτῶν `s`); 4:16 τοῖς "with" (now with + men); 4:21 τόν "all the" (all now
  on πάντες, which was TODO); 4:33 τῆς "about the" (about now with
  ἀναστάσεως).
- Case words moved off pronouns and adjectives: 4:25 and 4:30 "of Your" on
  σου (now of + servant, Your = σου; no reviewed chapter puts "of" on a
  pronoun); 4:33 "With great" on μεγάλῃ (now With + power).
- 4:4 and 4:32 τῶν + participle and 4:14 τὸν τεθεραπευμένον joined (rule
  3); 4:4 "of" moved from τῶν to ἀνδρῶν; 4:10 τοῦ Ναζωραίου = of Nazareth
  joined (John 18:5, Luke 24:19).
- 4:10 ἐν had "that": now ἐν τούτῳ together = that (the cleft "that" takes
  up the resumptive "by this one"); ὅτι is `s` (the colon).
- 4:16 "a" moved from γνωστόν to σημεῖον (English "a" goes with the noun);
  "It is" off φανερόν.
- 4:17 ἵνα μή = to keep … from (μή was TODO; "this message" `t`); μηδενὶ
  ἀνθρώπων = to anyone (the publisher had "to" on μηδενί, "anyone" on
  ἀνθρώπων).
- 4:19 "in God’s sight" was all on ἐνώπιον: now in + sight = ἐνώπιον,
  God’s = Θεοῦ.
- 4:22 "was miraculously" had been on σημεῖον: now was = γεγόνει,
  miraculously = σημεῖον, ἐφ’ ὅν = who.
- 4:25 ὁ … εἰπών = You + spoke (article + participle, still addressing
  God); διά = by + through (see doubts); "the mouth" = στόματος.
- 4:32 ἦν … κοινά = shared and αὐτοῖς = they (the publisher had "they
  shared" on ἦν, κοινά and αὐτοῖς TODO).
- 4:35 ἑκάστῳ had only "to": now ἑκάστῳ = to anyone, τις = he, εἶχεν = had
  (see doubts).
- 4:36 ὁ ἐπικληθείς = whom + called (joined); ἀπό `s` (BSB makes the
  apostles the subject).

## Readings

Spelling only, linked with "Same name/word, spelled differently in BSB's
Greek text": 4:6 and 4:19 Ἰωάνης, 4:13 Ἰωάνου (John), 4:27 Πειλᾶτος
(Pilate), 4:36 Λευείτης (a Levite).

Extra word in the publisher's Greek:

- 4:4: "the" in "the number" is `t` with "BSB follows a reading with an
  extra word here" (probably ὁ before ἀριθμός).
- 4:30: "Your" in "Your hand" is linked to the article τήν as a possessive
  (majority convention), with a note that BSB's Greek has one extra word
  here (probably σου after χεῖρα).
- 4:18 and 4:28: nothing claimed. In 4:18 the extra word is probably τό
  before καθόλου, which has no English effect; "commanded them" is `t` as
  a supplied object. In 4:28 it is probably σου after βουλή; BSB's one
  "Your" covers "hand and will", linked to the first σου.

## Notable decisions

- Explicit pronouns rendered by names are linked with a note, as in John
  and Luke: 4:1, 4:3, 4:7 αὐτῶν/αὐτοῖς/αὐτούς = Peter and John; 4:13
  αὐτούς = these men; 4:21 and 4:24 οἱ δέ = they / the believers.
- 4:2 ἐκ = "of" (resurrection of the dead) kept; 4:8 publisher row "with
  the Holy" on Ἁγίου kept, as in Luke 1:15, 1:41, 1:67.
- 4:12 οὐκ … οὐδενί joined as the one English negative "no one"; οὐδέ =
  no (no other name).
- 4:20 οὐ δυνάμεθα … μὴ λαλεῖν: οὐ δυνάμεθα = cannot; the second negative
  μή = stop (with note).
- 4:21 διὰ τὸν λαόν, ὅτι: BSB merges both causal words into one "because"
  (διά and ὅτι joined); πάντες = all, τόν = the, λαόν = people.
- 4:24 Δέσποτα = Sovereign Lord and 4:29 Κύριε = Lord: no "O/You" before
  them; σύ = You on its own.
- 4:11 and 4:25-26 (Psalm 118:22; Psalm 2:1-2) linked word by word. 4:11:
  ὑπό `s` (passive turned active: "you builders rejected"), predicate εἰς
  `s` as in Luke 20:17.
- 4:27 ἐπ’ ἀληθείας kept split (In / fact) as the publisher had it; γάρ
  `s`; τε … καί: τε `s`.
- 4:32 "everything they owned" kept on πάντα (with note); "in heart" kept
  on καρδία.

## Doubts for the peer

- 4:10: ὅτι `s` (colon) with "It is" `t`, and the cleft "that" on ἐν
  τούτῳ. Alternative: "that" on ὅτι and ἐν τούτῳ `s`.
- 4:25: διά linked to both "by" and "through", since the one preposition
  governs both genitives (Πνεύματος Ἁγίου and στόματος). Alternative:
  "through" on στόματος.
- 4:35: "to anyone as he had need" was linked by function (ἑκάστῳ "to each"
  = to anyone, τις = he). The publisher had τις = anyone and ἑκάστῳ = "to"
  only.
- 4:8 keeps "with" on Ἁγίου (Luke precedent), while the kept 4:31 puts
  "filled with" on the verb. Both stay as they were.
- 4:24 "their voices" kept on φωνήν (their is implied); 4:22 "was" linked
  to γεγόνει ("had happened") in BSB's passive rewording.
- 4:31 (KEEP): no real error seen.
