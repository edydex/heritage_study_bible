# BSB John 2: independent peer review (Claude)

Checked: 25 of 25 verses (2:1-25; no verse was kept from an earlier review).
I checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher record in `public/data/original-languages/bsb-word-links/john.json`,
the publisher rows in the draft, and the reviewed parallels Matthew 21:12-13
and Mark 11:15-17. Final check: `fromtext` → `{"versesOk": 25, "problems": 0}`.

## Changes

Five link changes and one note fix. The rest of the author's file is
unchanged; a round trip of the final JSON differs from the author's file only
in these lines.

A lone article carried an English case word ("on", "to", "of"). The brief's
rule is that a lone article never carries a preposition or case word; the case
word goes on the article only with indeclinable names. The author already
applied this in 2:17 (οἴκου = for + house) and 2:21 (σώματος = of + body), and
John 1 and the reviewed Luke chapters do the same. Matthew 21:12 and Mark 11:15
still put "of the" on τῶν before κολλυβιστῶν; as in Luke 22, the rule is
followed here anyway.

- 2:1: τῇ "On the" → the; ἡμέρᾳ "day" → On + day, with a note on the dative
  of time (as Matthew 17:23 and Luke 17:29).
- 2:5: τοῖς "to the" → the; διακόνοις "servants" → to + servants (as Mark
  6:22). The author had moved "to" from λέγει onto the article.
- 2:8: τῷ "to the" → the#0; ἀρχιτρικλίνῳ → to + master of the banquet.
- 2:11: τῶν "of His" → His#0 (article used as a possessive, with a note);
  σημείων "signs" → of + signs.
- 2:15: τῶν "of#1 the" → the#2; κολλυβιστῶν → of#1 + money changers.

Note fix:

- 2:16 note on οἶκον ἐμπορίου: "into marks what the house is made" → "into
  marks what the house is turned into". The old wording was unclear.

## Answers to the author's doubts

- 2:9 ὡς → "Then": agree, kept. BSB turns "When he tasted …, he called" into
  "… tasted. … Then he called". "Then" is the only English word that carries
  the time relation ὡς sets up between the tasting and the calling, so `s` +
  `t` would leave a split pair. It is the mirror of the convention that puts
  "When" on the καί between two clauses, and Luke 18 likewise links ἵνα to a
  "Then" that opens BSB's new sentence. It differs from the ὅταν cases (Mark
  4:16, Luke 8:13), where BSB's "and" has no time meaning. The note says BSB
  makes the ὡς clause a main sentence.
- 2:18 ὅτι `s` + "to prove Your authority" `t`: agree. ὅτι means
  "since"/"that". "to prove" and "authority" add content that is not in the
  Greek. Linking ὅτι to "to prove" would claim that ὅτι means "prove". "to#1
  do" stays with ποιεῖς.
- 2:16 μή → "How dare", ποιεῖτε → you + turn: agree, kept with its note.
  "How dare you …!" is BSB's way of saying "Do not …!", so "How dare"
  renders the prohibitive force of μή. Joining μὴ ποιεῖτε would break the
  rule that negatives are split off their verbs.
- 2:11 καί → "thus": agree. This is a consecutive καί ("and so"). "thus" is
  the only word that renders it, and `t` would leave a split pair.
- 2:19 "again" `t`: agree. ἐγερῶ is "I will raise", with no ἀνα- prefix and no
  πάλιν. BSB has no "again" for the same verb in 2:20.

## Other points checked

- 2:6: ἀνά = Each, with a note on the distributive sense (as Luke 9:14 and
  Matthew 20:9-10). μετρητὰς δύο ἢ τρεῖς as one group = "from twenty to thirty
  gallons", with a note: agree. BSB converts "two or three measures" into
  gallons, so "twenty" does not render δύο and "thirty" does not render τρεῖς.
  Separate number links would mislead, and no other Greek word in the verse
  could carry "from".
- 2:12: the publisher record counts 24 Greek words against N1904's 23, with
  all 23 matched and all 22 English words matched. BSB's single "His" covers
  "mother and brothers", so no English word is left for the extra Greek word.
  No reading claim is needed, and none is made.
- 2:4: the publisher record differs only on the English side (15 of 15 Greek
  words matched, the same count on both sides), so no different reading is
  claimed. Τί ἐμοὶ καὶ σοί = why + us, with `t does this concern`, follows
  Mark 1:24 and 5:7.
- Temple parallels: ἱερόν = temple courts, βόας = cattle, περιστεράς = doves,
  κολλυβιστῶν/κερματιστάς = money changers, and ἀνέτρεψεν = overturned match
  Matthew 21:12 and Mark 11:15, apart from the case-word change above.
- Conventions confirmed: "When" on the genitive absolute (2:3) and on the καί
  between clauses (2:13); `t and` with participles turned into finite verbs
  (2:15, 2:23); split negatives (2:4, 2:9, 2:24, 2:25); article + participle
  units (2:9, 2:14, 2:16); οἱ δέ = They (2:8); explicit αὐτός = He (2:12,
  2:24, 2:25).

## Still uncertain

- 2:3 οὐκ = "no more": kept as BSB's idiomatic negative, but "more" could be
  `t`. Neither choice is wrong.
- 2:10 καί = "and then": "then" could be `t`, since it answers πρῶτον
  "first" rather than rendering καί. I kept the publisher row, because a
  sequential καί is often rendered "and then".
- 2:16 "into" with οἶκον ἐμπορίου (the predicate noun) rather than with
  ποιεῖτε (turn + into): both are defensible, so I made no change.
