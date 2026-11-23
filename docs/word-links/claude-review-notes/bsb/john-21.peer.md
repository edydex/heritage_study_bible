# BSB John 21: independent peer review (Claude)

Checked: 25 of 25 verses (21:1-25), every `g`/`s`/`t` line, against N1904,
BSB's English and the publisher record in
`public/data/original-languages/bsb-word-links/john.json`. Final check:
`fromtext` → `{"versesOk": 25, "problems": 0}`. A `totext --all` round trip
of the output gives the same decision lines.

## Changes (6 verses)

- 21:1: `g 3 = Himself#0` + `t Himself#1` → `g 3 = Himself#0 + Himself#1`,
  note "ἑαυτόν is understood again with the second ἐφανέρωσεν, where BSB
  repeats Himself." ἐφανέρωσεν δὲ οὕτως has no object of its own. Its object
  is the ἑαυτόν of the first clause, and BSB repeats that same pronoun. This
  follows the words-understood-again rule (John 15:2, 15:4, 17:11). The reviewed
  Matthew 25 already links a pronoun this way (αὐτοῦ = His + His). The
  first ἑαυτόν already has its own "Himself" (it is not absorbed in
  "revealed"), so this adds a link and moves nothing.
- 21:18: `g 23 = you#6` + `t you#7` → `g 23 = you#6 + you#7`, note "σε is
  understood again with οἴσει, where BSB repeats you." ζώσει σε καὶ οἴσει is
  one pair of parallel verbs with one stated object, so the same rule applies.
  "will" is stated once in English ("will dress … and lead"), so no tense
  word is added to the repeat.
- 21:4: `g 0 2 3 = Early in the morning` → `g 0 3 = Early in the morning`
  and `s 2 = BSB leaves ἤδη ("already") unexpressed.` "Early in the morning"
  renders πρωΐας … γινομένης ("as morning was coming"), but it has no word for
  ἤδη. Folding ἤδη in claimed a meaning the English lacks. The reviewed John
  7:14 leaves ἤδη `s` in the same kind of genitive absolute. The
  "differs slightly, same sense" note stays on the group. It fits the EVIDENCE
  (1 unmatched, 1 extra). The publisher's English is linked to every N1904
  word except δέ, ἤδη and γινομένης, and only γινομένης is a known variant.
- 21:13: `g 12 = He did the same with` → `g 12 = the#1 same` (note "ὁμοίως
  ("likewise") is rendered the same.") + `t He did` + `t with`. καὶ τὸ ὀψάριον
  ὁμοίως has no subject or verb. Tapping "He" or "did" showed "likewise".
  The reviewed Mark 12:21 makes the supplied "did" `t` (καὶ ὁ τρίτος
  ὡσαύτως), and Mark 14:31 links ὡσαύτως to "the same thing". The author also
  made the supplied "Jesus" `t` throughout this chapter.
- 21:23: `g 1 = Because of` + `g 2 = this#0` → `g 1 = Because of this`
  (note "BSB renders the connective οὖν ("so") as Because of this.") +
  `s 2 = BSB renders οὗτος ὁ λόγος ("this saying") as the rumor, leaving
  οὗτος unexpressed.` In the Greek, οὗτος is the attributive of the subject
  ὁ λόγος ("this saying went out"). It is not part of a causal phrase. BSB
  uses "Because of this" as its causal rendering of John's οὖν: the reviewed
  John 9:16 links plain οὖν (no demonstrative there) to "Because of this".
  Leaving "this" on οὗτος made the English cause look like the subject's
  demonstrative.
- 21:25: note only. "καθ’ ἕν ("one by one") is rendered all of them" → "…
  rendered all of." "them" is linked to ἅτινα, so the old note claimed a word
  that belongs to another group.

## Answers to the author's doubts

- 21:1 `t Himself#1` and 21:18 `t you#7`: **changed** to repeats (see above).
  Neither stated pronoun lacks English of its own, so there was no split
  pair to resolve. The link is the rule's straightforward case.
- 21:23 οὗτος: **changed** to `s` with οὖν = "Because of this" (see above).
  I found no reviewed precedent where a demonstrative moves into a causal
  phrase. John 9:16 supports the οὖν reading.
- 21:8 `t ashore`: **agree, kept**. ἦλθον is just "came". BSB adds the goal
  "ashore", and the Greek states it nowhere in this clause. Unlike 21:9 and
  21:11, no εἰς τὴν γῆν is present to carry it.
- 21:11 "of large" on μεγάλων: **kept** (publisher row). "of" marks the
  genitive phrase ἰχθύων μεγάλων, and μεγάλων is genitive too. Reviewed files
  are mixed here, so this is not a wrong link.

## The lead's points: confirmed

- 21:15-17: ἀγαπᾷς / φιλῶ / φιλεῖς each link to the "love" BSB prints, with no
  note about the two verbs. **Kept.** The "sheep" note ("another form of this
  word, same meaning") matches the EVIDENCE: 21:16 and 21:17 each have 2
  unmatched N1904 words. The publisher left Ἰωάνου and προβάτιά unlinked,
  with "of John" and "sheep" unowned. Its other unlinked words are only
  αὐτῷ, ὅτι, articles and πάλιν/καί. The note does not name the publisher's
  form. The diminutive and the plain noun both mean "sheep".
- 21:6 οὐκέτι ἴσχυον = "they were unable" (joined): **confirmed**, as in
  the reviewed John 12:39 οὐκ ἠδύναντο = "they were unable".
- 21:2 οἱ = "the" with `t sons`: **confirmed**. A lone article never carries
  a noun. The reviewed Matthew 4:21 and Luke 6:15-16 make "son" `t`.
- 21:17 τό `s`: **confirmed**. English "a third time" cannot render the
  article. "a" goes with τρίτον, as in the second occurrence.
- 21:7 ἦν … γυμνός = "he had removed" (`t it`) and ἔβαλεν ἑαυτόν = "jumped":
  **confirmed**. Both are single English renderings of the two-word Greek units.
- 21:21: Πέτρος = Peter, λέγει = he asked, ἰδών = When + saw, οὖν `s`.
  **Confirmed**: the swap is fixed.
- 21:19 ποίῳ = "the kind of + by which", θανάτῳ = "death": **confirmed**.
  "which" is the relative/interrogative force of ποῖος. Putting "by" on
  θανάτῳ instead would split "by which".
- 21:25 καθ’ ἕν = "all of", ἅτινα = "them": **confirmed** (note wording fixed).
- Readings:
  - 21:3 `t So` makes no reading claim. This is correct, since the verse has
    no `partial` record.
  - The 21:4 joined-phrase note is checked above.
  - 21:11 `t So` "BSB follows a reading with an extra word here" fits the
    EVIDENCE (0 unmatched, 1 extra). The English "So" has no N1904 owner.
  - The extra words in 21:1, 5, 12, 13, 14 and the third extra word in 21:17
    touch no English word, and nothing is claimed for them.
  - Ἰωάνου (21:15-17) has the soft same-name note.
  - No note states the publisher's exact Greek.

## Still uncertain

- 21:9 κειμένην = "there" and ἐπικείμενον = "on it" (publisher rows, kept).
  "there" is a loose rendering of "lying". The alternative is κειμένην `s`
  + `t there`.
- 21:13 `t with`: "with" could instead go with τὸ ὀψάριον as the English
  marker of what the repeated action applies to. I left it `t` because the
  accusative has no preposition.
- 21:23 is a judgment call. If οὗτος is read as pointing back to Jesus' word
  in 21:22, BSB's "this" could be taken as its shifted rendering. The
  grammar (οὗτος modifies the subject λόγος) and John 9:16 favour the change.
