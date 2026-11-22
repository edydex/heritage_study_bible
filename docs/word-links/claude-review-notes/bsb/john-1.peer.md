# BSB John 1: independent peer review (Claude)

Checked: 51 of 51 verses (1:1-51; the draft had no KEEP blocks).
I checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher rows in the draft, the publisher record in
`public/data/original-languages/bsb-word-links/john.json`, and the reviewed
files for 1 John 4:9, Hebrews 11:17 and Luke 9:38 (μονογενής). The Prologue
(1:1-18) was checked word by word. Final check: `fromtext` →
`{"versesOk": 51, "problems": 0}`.

## Changes

Two link changes and one note fix. A round trip of the final JSON differs from
the author's file only in these lines.

- 1:18: μονογενής "the one and only Son" → "the one and only"; new
  `t Son` ("English supplies Son; the Greek here reads μονογενὴς Θεός and has
  no word for Son"). The μονογενής note now says only that BSB takes the
  adjective as a noun. Why: john.json has no `partial` record for 1:18, so the
  publisher's Greek equals N1904 here: μονογενὴς Θεός. In this verse the noun
  beside μονογενής is Θεός, and BSB renders it separately ("who is Himself
  God"). "Son" renders no Greek word here. Linking it to μονογενής would
  suggest that the Greek reads "Son", which is another manuscript reading and
  not this text. This matches 1 John 4:9, where μονογενῆ = "one and only" and
  "Son" sits on Υἱόν. Kept: Θεός = God with its apposition note, and `t` for
  "but", "who is Himself", "and" and "Him".
- 1:43: Ἰησοῦς "Jesus" (in "Jesus decided") → "He"; λέγει "He told" → told;
  new `t Jesus` ("English names the subject; the Greek gives it only in the
  verb ending of ἠθέλησεν"). Why: Ἰησοῦς is the subject of λέγει in the third
  clause, and BSB renders that subject "He". The Greek names no subject for
  ἠθέλησεν two sentences earlier. The author's link tied the name to that other
  verb. The publisher's row Ἰησοῦς = He was correct and is restored. Only its
  "Jesus decided" on ἠθέλησεν over-claimed, and the author's fix of that is
  kept. This matches 1:29 (`t John`) and 1:42 (`t Andrew`, and the second
  Ἰησοῦς = "who", the English word that stands for him in his own clause).
- 1:13 note on οἵ = children: "referring back to the children of verse 12" →
  "referring back to those who received and believed in verse 12". Why: οἵ is
  masculine plural. It refers to the people (ὅσοι, τοῖς πιστεύουσιν), not to
  the neuter τέκνα. The link itself is kept.

## Answers to the author's doubts

- 1:33 οὗτός = "The man": agree, kept. οὗτος resumes the relative clause
  ὃν ἄν … as the subject of ἐστιν. BSB moves the relative clause behind that
  subject and spells it out as "The man". This is a referring expression that
  stands for the noun, as in Matthew 18:27. Using `s` + `t` instead would leave
  a split pair.
- 1:15 and 1:30 `t He`: agree, kept. English has both "He" and "(of) whom".
  The relative is linked to the relative words, and "He" is the antecedent
  that English adds. Joining "He of whom" to ὅν would also be defensible, so
  I did not change it. 1:26 is different: there English has no relative word,
  so ὅν = "One" is the only English word ὅν can link to.
- 1:45 "foretold" on ἔγραψεν: agree, kept. One relative (Ὅν) and one singular
  verb (ἔγραψεν, agreeing with the nearer subject Μωϋσῆς) serve both Moses and
  the prophets. BSB repeats "the One" and gives the prophets their own verb.
  "foretold" is how BSB renders the prophets' writing about Him. It adds no
  new action. A `t` would claim the prophets' clause has no Greek verb, but it
  has the shared ἔγραψεν. The note gives the verb's plain meaning ("wrote"),
  so the reader sees the shift. Ὅν = "the One + the One" and καί `s` are
  also correct.
- 1:14 and 1:18 "Son": changed in 1:18 (above), kept in 1:14. In 1:14
  μονογενοῦς stands alone as a noun ("as of an only one from a father"), so
  English must supply the noun as part of its rendering. The reviewed files do
  the same: Luke 9:38 μονογενής = "only child", Hebrews 11:17 τὸν μονογενῆ =
  "his one and only son". The 1:14 note says the Greek has no separate word
  for Son. In 1:18 the Greek has its own noun, Θεός, beside μονογενής.
- 1:22 ἵνα … δῶμεν = "We need": agree. BSB recasts the purpose clause as a
  statement of need. Linking "need" to δῶμεν alone would claim δῶμεν means
  "need". An `s` on ἵνα would drop the purpose sense that "need" carries.

## Points the coordinator asked about

- 1:1: every link is one to one, and τόν before Θεόν is `s`. The Θεός note
  states grammar only: Θεός comes first, has no article, and is the predicate;
  ὁ Λόγος is the subject. Kept unchanged.
- 1:9: ἦν = was and ἐρχόμενον = coming stay separate. The note only says that
  BSB takes them together. The 1:9 record shows all 13 Greek words matched, so
  only English wording differs and no reading is claimed. Kept.
- 1:20: the two ὡμολόγησεν are split correctly. The first is "to confess"
  (with a note that BSB folds it into "did not refuse to confess"), and the
  second is "openly declared". ἠρνήσατο = He did + refuse and οὐκ = not. Kept.
- 1:33 resumptive οὗτός = "The man": kept (see above).

## Other points checked, kept

- Readings: every `partial` verse (1:6, 1:15, 1:19, 1:21, 1:25, 1:26, 1:28,
  1:32, 1:35, 1:38, 1:40, 1:42, 1:47, 1:49) is linked only with a
  spelling/form note. None of these notes states the publisher's spelling.
  1:26 στήκει carries "a different form of this verb". In 1:47 the extra
  publisher word has no English and nothing is claimed for it.
- Kept free renderings that are not wrong: Ταῦτα = "All this" (1:28),
  Ὅτι = "just because" (1:50), Ἀνδρέου = "as Andrew" with `t same` (1:44),
  καί = "with" (1:35), ἐσκήνωσεν = "made His dwelling" (1:14),
  αὐτοῖς = "to" (1:12, resumptive dative), ἡ = "that" (1:4).
- Article as possessive: τά/οἱ = His (1:11), following the majority convention.

## Still uncertain

- 1:14 "Son" stays linked to μονογενοῦς while 1:18 now has `t Son`. The
  difference rests on 1:18 having Θεός as its own noun. If the project prefers
  the same treatment in both verses, 1:14 would become μονογενοῦς =
  "of the one and only" + `t Son`.
- 1:43 reverses the author's link and restores the publisher row. Linking the
  name to "Jesus" in the first sentence is defensible only as a moved subject.
  I preferred the clause the Greek name belongs to.
- 1:11: the possessive "His" could instead be `t`, since τὰ ἴδια / οἱ ἴδιοι
  get "own" from ἴδιος, not from the article. I kept the majority convention.
