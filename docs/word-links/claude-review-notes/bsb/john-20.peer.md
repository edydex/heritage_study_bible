# BSB John 20: independent peer review (Claude)

Checked: 31 of 31 verses (20:1-31). No verse was kept from an earlier review.
I checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher rows for John 20 in
`public/data/original-languages/bsb-word-links/john.json`, and the `partial`
counts there for every reading claim (20:16, 20:25 and 20:30 are the only
verses with a `partial` record). Precedents compared: Luke 24:36 and 24:40,
John 1:38, 6:43, 7:24, 11:32, 12:1, 14:10 and 15:5 (with the coordinator
adjustment recorded in `john-15.peer.md`), and the reviewed verses where one
Greek preposition is linked to a repeated English one (Luke 1:79, 5:17, 9:26,
23:19). Final check: `fromtext` → `{"versesOk": 31, "problems": 0}`.

## Changes (3 verses, 3 changes)

- 20:26, link: `g 5` ἦσαν = were + was (note "understood again with Thomas")
  → `g 5` ἦσαν = were, and `t was` ("English supplies a verb for καὶ Θωμᾶς
  μετ’ αὐτῶν, which has none (a supplied copula, as in John 15:5)."). Why:
  "Thomas was with them" is a verbless Greek clause. A supplied copula is
  English-only and is never linked to an εἰμί in another clause (README rule
  7; John 14:10; John 15:5 after the coordinator adjustment). The
  understood-again rule is for content words.
- 20:19, link: `g 14` ἦσαν = were, `s 13` ὅπου, `t while`, `t together` →
  `g 13 14` ὅπου ἦσαν = were together (note "ὅπου ἦσαν ("where … were") is
  rendered were together.") and `t while` ("English introduces the
  circumstance as a while-clause; the Greek has a place clause here."). Why:
  the EVIDENCE line shows no edition difference in this verse, so "together"
  must come from BSB's rendering of the N1904 words. BSB turns "the doors shut
  where the disciples were" into "while the disciples were together with the
  doors locked". Being in one place, the idea of ὅπου, becomes "together".
  The publisher's own row already gave "were together" to ἦσαν. Joining ὅπου
  with its verb follows John 11:32 and 12:1, where ὅπου ἦν is linked as one
  unit to BSB's free rendering. Only "while" is English-only: it is a time
  word and ὅπου is a place word, so it does not carry ὅπου (the author's
  reasoning, which I keep for this word). No reading is claimed.
- 20:25, note only: `g 29 31` εἰς … τόπον = where. "BSB's Greek text has a
  different word of similar sense here" → "the link follows N1904, and BSB's
  Greek differs by one word in this verse." Why: the `partial` record gives
  only counts (46 N1904 words, 45 matched, 46 publisher words), so it does not
  say which slot differs. It also does not show that the two words are
  similar in sense. BSB's "where the nails have been" renders N1904's "into
  the place of the nails" directly, so the link is right under rule 9. The
  note now claims only what the record supports. The publisher's word is
  not named.

Every other line of the author's file is kept.

## Points I was asked to settle

- **20:7**: the four-token group οὐ μετὰ … ἀλλὰ χωρίς = "separate from" is
  kept. The publisher had τόπον = "separate" and μετά = "from". Both of those
  rows were wrong: τόπος means "place", and μετά means "with". I tested the
  smaller split. χωρίς = "separate" is a good lexical match, but then "from"
  has to stand alone. Linking it to οὐ μετά ("not with") or to μετά claims a
  meaning "from" does not have. Writing `s` for οὐ μετά … ἀλλά with a reason
  that they are "expressed by separate from" would be a split pair. "separate
  from" as a whole does render "not with … but apart", so the group is the
  honest one. εἰς ἕνα τόπον: every English word of the verse has a Greek owner
  without it. "rolled up" is ἐντυλίσσω alone, and "separate" is χωρίς. BSB has
  no place word, so `s` is right.
- **20:19 Οὔσης = "It was", ἐκείνῃ = "that very"**: kept. BSB's "It was the
  first day of the week, and that very evening" uses one "It was" for both
  the day and the evening, so it does render the participle of "evening
  being". "that" is still the demonstrative of that day, now placed on
  evening. "while" and "together": see the change above.
- **20:25 slot of the different word**: the counts cannot place it. The
  unmatched N1904 word must be one of the tokens that received no publisher
  link: ὁ, αὐτοῖς, μή (14), six articles (17, 22, 26, 32, 37,
  40), τόπον (31) and οὐ μή (43-44). τόπον is the only content word among
  them, so slot 31 is the likely place. It is not proven, and the note no
  longer says "here".
- **20:16 Ῥαββουνεί**: confirmed. 13 N1904 words, 12 matched, 13 publisher
  words, and Ῥαββουνεί is the only Greek token without a transferred link
  ("Rabboni" was the only English word left over). The same word spelled
  differently is the honest description. The note follows John 1:38 and does
  not state the publisher's spelling.
- **20:30 "His" `t`**: confirmed. 20 N1904 words, all matched, and 21
  publisher words, so BSB's Greek has one extra word. "His" was the only
  English word the publisher rows could not carry over, while "disciples" is
  linked to μαθητῶν on its own. So the extra word is the one behind "His".
  The reason does not name it.
- **20:28**: kept word by word. Κύριος = Lord, μου = My, καί = and, Θεός =
  God, μου = my. Both articles are `s`, ἀπεκρίθη … καὶ εἶπεν = replied (as
  John 6:43), and αὐτῷ is `s`. There is no interpretive note.
- **"Peace be"** (20:19, 21, 26): Εἰρήνη = Peace, ὑμῖν = with you, "be" `t`,
  as in Luke 24:36. Confirmed.
- **Vocatives**: Γύναι = Woman (20:13, 15), Κύριε = Sir (20:15), Μαριάμ =
  Mary (20:16). BSB has no "You"/"O" before any of them. Confirmed.
- **Negatives and participle clauses**: the negatives in 20:2, 5, 9, 13, 14,
  17, 24, 25, 27, 29 and 30 are split from their verbs, and each verb keeps
  do/did/will/have. 20:20 "After" and 20:22 "When" are on the participle
  εἰπών, with the opening καί `s`, as in Luke 24:40. Confirmed.

## Answers to the author's doubts

- 20:7 "separate from" as one group: agreed (see above).
- 20:3 ἐξῆλθεν … καὶ ἤρχοντο = "set out": agreed. "set out for" cannot be
  divided between the two verbs. Leaving ἤρχοντο `s` would hide a verb that
  BSB does render.
- 20:19 ἐκείνῃ and Οὔσης: agreed. ὅπου / "together" changed as above.
- 20:1 μνημείου = "entrance": agreed. It is the publisher's row, and
  "entrance" stands in the slot of "from the tomb" with the same referent.
  `s` + `t` would be a split pair. The note explains it.
- 20:17 one πρός linked to both "to"s: agreed. One preposition governs the
  whole coordinated object, and many reviewed verses link a repeated English
  preposition the same way (Luke 1:79, 5:17, 9:26, 23:19).
- 20:26 one ἦσαν linked to "were" and "was": changed. "was" is a supplied
  copula and is now `t` (see above).

## Still uncertain

- 20:19 "were together": a reviewer could keep "together" `t` and ὅπου `s`, as
  the author did. I linked it because BSB's Greek here is N1904's, so
  "together" can only be BSB's rendering of ὅπου ἦσαν. Linking also follows
  the John 11:32 and 12:1 handling of ὅπου ἦν.
- 20:22 αὐτοῖς = "them" (object of breathed on, though in Greek it goes with
  λέγει) is kept under the split-pair rule. It is the same referent, shifted
  to another verb, and the note says so.
- 20:25 τόν (30) is `s` while εἰς … τόπον = where. It could also join the
  group, as the article does in εἰς τὸ μέσον = among them. I left it, because
  both are acceptable.
