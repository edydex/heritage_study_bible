# BSB Luke 15: independent peer review (Claude)

Checked: 32 of 32 verses (15:1-32, including Codex's earlier 15:12). I
checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher record in `public/data/original-languages/bsb-word-links/luke.json`
and the reviewed parallel Matthew 18:12-14. Final check: `fromtext` →
`{"versesOk": 32, "problems": 0}`.

## Reading claims

The publisher record has a `partial` entry for 15:7 and 15:29 only.

- 15:29: 27 N1904 words, all matched; 28 publisher Greek words, so BSB's
  text has one extra word. All 36 English words are matched by the
  publisher, and "his" (before "father") is the one English word the N1904
  draft could not place. `t his` with "BSB follows a reading with an extra
  word here; N1904 has only the article" is right, and τῷ stays `s`.
  Linking "his" to τῷ (article as possessive) would hide the reading.
- 15:7: 23 / 23 / 23 Greek words, so no word differs (probably word order
  only). The 8 unmatched publisher English words are exactly "In the same
  way, I tell you that". The author rightly claims no reading.
- No other verse has a reading note, and no note states the publisher's
  Greek wording as fact.

## Changes (3 verses: 2 link fixes, 1 note-only fix)

- 15:8: ἐάν = "and#0" → `s` ἐάν + `t and#0`. Why: ἐάν means "if"; BSB
  recasts the condition as part of the relative clause "who has … and
  loses". The English "and" joins "loses" to "has" and does not render
  ἐάν, so this is not a split pair. This follows the "and" for ὅταν
  ("when") rule in the brief and the reviewed Mark 4:16 (ὅταν `s`, "and"
  `t`).
- 15:12 (Codex's verse): τόν `s` + `t his` → τόν = his. Why: this was a
  split pair. Publisher Greek is N1904 here, so "his" is not a reading; it
  renders the article used as a possessive. That is the majority
  convention, and this chapter already uses it (15:6 τούς = his, 15:8 τήν =
  her, 15:9 τήν = my, 15:22 τούς = his). The other links are unchanged. I
  shortened four long notes to one sentence each (ὁ νεώτερος, τῷ πατρί,
  τὸ ἐπιβάλλον μέρος, αὐτοῖς). I also reworded the reasons for the
  opening καί and αὐτῶν.
- 15:13: note only. ἀσώτως = "in wild" said "rendered in wild living",
  but "living" is linked to ζῶν. It now says "rendered in wild, with living
  for ζῶν".

## Points I was asked to settle, and the author's doubts

- 15:7, ἤ = "more + than": **agree.** N1904 has no μᾶλλον here (Matthew
  18:13 has μᾶλλον ἤ = more / than). ἤ after a positive gives the
  comparison "rather than", so "more … than" is ἤ's own meaning. The
  publisher's ἔσται = "there will be more" over-claimed, because ἔσται
  does not mean "more". χαρά = "more joy" would over-claim in the same way.
- 15:23, καί before φαγόντες `s` + "and" in "feast and celebrate" `t`:
  **agree, kept.** This is not a split pair. The καί joins the "let us
  celebrate" clause to the commands before it. BSB ends that sentence after
  "kill it". The "and" in "feast and celebrate" joins the participle
  φαγόντες to εὐφρανθῶμεν, a joint where Greek has no word. Linking καί
  there would tell the reader that καί joins "feast" and "celebrate", which
  it does not (the same test as the reviewed Mark 16:20). The verse has the
  same pattern as 15:13 (καί `s` before a new sentence + participle + `t
  and`). The "and" in "Bring … and kill it" is rightly `t`: φέρετε and
  θύσατε stand without a connective.
- 15:6, opening καί = the list's "and": **agree.** BSB's 15:5-6 is one
  sentence: "puts it on his shoulders, comes home, and calls together".
  The καί joins ἐπιτίθησιν to the ἐλθὼν … συνκαλεῖ unit. It is the only
  Greek coordinator in that list, so the list's "and" renders it, as in the
  reviewed Luke 10:30. This differs from 15:23, where BSB starts a new
  sentence and the καί's joint has no English word. `s` + `t and` would be
  a split pair here.
- 15:29, "his" `t`: **agree**, the counts support it (see Reading claims).
- 15:10, "of" on ἐνώπιον: **agree.** ἐνώπιον = "in the presence of" matches
  the reviewed Luke 1:19 and 8:47. "of" is part of the English preposition
  that renders ἐνώπιον, and a lone article (τῶν, τοῦ) cannot carry it.
  Θεοῦ = "God’s" is right.
- 15:17, λιμῷ = starving and ἀπόλλυμαι = am + to death: **agree.** Each
  Greek word keeps its own meaning ("by hunger"; "I am perishing").
  Πόσοι = "How many of" is also right: the English partitive "of" belongs
  to "How many", not to the article τοῦ.
- 15:18 / 15:20 / 15:15, "I will" on πορεύσομαι but "he got up" on
  ἀναστάς and "he went" on πορευθείς: **agree.** "will" is the future
  tense of the finite verb. A bare subject pronoun may sit on the first
  English verb.
- 15:20, ἀπέχοντος = while + was and μακράν = in the distance: **agree.**
  Each word keeps its own meaning ("being away"; "far"), and the genitive
  absolute supplies "while".
- 15:32, ἦν = was#1 + was#2 with `t he`: **agree.** N1904 does not repeat
  ἦν, so the verb understood again links to each English "was". Adding
  "he" to the second "was" would also be defensible, but the current
  reason is true.

## Also checked and kept

- Matthew 18:12-14 parallel: ninety-nine joined (15:4, 15:7); τὸ ἀπολωλός
  = "the one that is lost" (15:4); οὐ = not with καταλείπει = does + leave;
  οὕτως = "In the same way" (15:7, 15:10).
- The other `t and` lines (15:13, 15:15, 15:17, 15:18, 15:20, 15:26,
  15:28) are participles turned into finite verbs. Any `s` καί/δέ in those
  verses joins a different clause, so there are no split pairs.
- Article as possessive: 15:6 his, 15:8 her, 15:9 her / my, 15:22 his#2,
  and now 15:12.
- ὁ δέ: ὁ = he (15:27, 15:29), the father (15:31), with δέ linked only
  where BSB renders it (So, But).
- οὐκ ἤθελεν = refused (15:28) matches the reviewed Matthew 18:30 and 22:3.

## Still uncertain

- 15:8 δραχμήν = "of them" (publisher row, kept by the author): "one of
  them" stands for "one drachma". Joining δραχμὴν μίαν = "one + of them"
  would be a little cleaner, but the current link is not wrong.
- 15:30 ἦλθεν = "returns from": "from" is English structure that ties the
  participle phrase to the verb. `t from` would also work. The publisher
  row was kept because it is not misleading.
- 15:25: "the" sits on the second ὁ (ὁ πρεσβύτερος), and the first ὁ is
  `s`. Either article could carry it.
