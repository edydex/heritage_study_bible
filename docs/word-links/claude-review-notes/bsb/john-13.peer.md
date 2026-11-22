# BSB John 13: independent peer review (Claude)

Checked: 38 of 38 verses (13:1-38). No verse was kept from an earlier review.
I checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher rows for John 13 in
`public/data/original-languages/bsb-word-links/john.json`, and the `partial`
counts there for every reading claim. For 13:1, 13:2, 13:12, 13:19, 13:24 and
13:38 I also mapped the publisher's own groups back to N1904 words, to see
which Greek and English words the publisher left without an owner.
Precedents compared: Luke 22:34, Mark 14:30 and Matthew 26:34 (the rooster
saying), Matthew 16:28, Mark 9:1 and Luke 9:27 (ἕως = "before"), John 4:30
(a preposition absorbed in a transitive English verb), John 1:26, 1:38, 1:39
(unrendered αὐτοῖς), John 6:65 and 9:23 (Διὰ τοῦτο).
Final check: `fromtext` → `{"versesOk": 38, "problems": 0}`.

## Changes (4 verses, 10 lines)

- 13:1, link: `g 15 16` μεταβῇ ἐκ = "leave + return" → `g 15` μεταβῇ =
  "leave + return" (note "μεταβῇ ('pass over') from this world to the Father
  is rendered by two verbs, leave … and return.") and `s 16` ἐκ = "The
  preposition ἐκ ('out of') is absorbed in the transitive English leave."
  Why: in the joined group, a reader who taps "return" saw ἐκ ("out of"),
  which "return" does not render. The publisher also left ἐκ without an
  owner, and John 4:30 makes an absorbed ἐκ `s` in the same way. "return"
  stays on μεταβῇ, and πρός stays "to".
- 13:12, link: `g 15` αὐτοῖς = "with them" → `s 15` "BSB leaves the
  addressee αὐτοῖς ('to them') of εἶπεν unexpressed." and `t with them`
  "English adds that He reclined with them; the Greek αὐτοῖς is the
  addressee of εἶπεν, not a companion of ἀνέπεσεν." Why: the BSB text is "He
  reclined with them again and asked". "with them" says who shared the
  table; αὐτοῖς says who was spoken to, and "asked" has no addressee. That
  is a different meaning, not the same word shifted (rule 1). The
  publisher's own row put "with them" inside ἀνέπεσεν and left αὐτοῖς
  without an owner, and John 1:26, 1:38 and 1:39 make an unrendered αὐτοῖς
  after a verb of speaking `s`.
- 13:24, three reasons softened. They no longer describe the publisher's
  Greek words:
  - `s 5 6 7 8`: "BSB follows a reading without καὶ λέγει αὐτῷ Εἰπέ …; its
    to ask renders a different verb." → "BSB's Greek text differs here; its
    English has no counterpart for καὶ λέγει αὐτῷ Εἰπέ ('and said to him,
    Tell')."
  - `s 10`: "BSB follows a reading with a different verb form here, and its
    English has no copula." → "BSB's Greek text differs here; its English
    has no counterpart for ἐστιν ('is')."
  - `t to#1 ask`: "BSB follows a reading with a verb of asking here, which
    N1904 lacks." → "BSB's Greek text differs here; N1904 has no verb of
    asking."
  Why: the brief forbids stating the publisher's Greek as fact. "a different
  verb form" and "renders a different verb" described the publisher's
  wording. The links did not change.
- 13:38, link: `g 12 13 16 17` οὐ μή … ἕως οὗ = "before" → `g 16 17` ἕως οὗ
  = "before" (note "ἕως οὗ ('until') is rendered before; BSB reverses the
  two clauses.") and `s 12 13` "BSB reverses the clauses (before the rooster
  crows, you will deny), so the emphatic negative οὐ μή ('by no means') has
  no English word." Why: "before" renders the temporal conjunction, as ἕως
  (ἄν) = "before" in Matthew 16:28, Mark 9:1 and Luke 9:27. The negative is
  not in "before". It disappears because BSB turns "will not crow until you
  deny" into "you will deny before it crows". Putting οὐ μή on "before"
  would tell a reader that "before" means "by no means … until". The
  publisher's row οὐ = "before" made the same over-claim. Luke 22:34 keeps
  its negative and "until" in English, so there οὐ = "not" and ἕως =
  "until" are separate links. That supports keeping ἕως as its own unit; it
  is no precedent for joining a dropped negative into it.

Every other line of the author's file is kept.

## Points I was asked to settle

- **13:38 οὐ μή … ἕως οὗ**: split, as above. ἕως οὗ = "before"; οὐ μή `s`
  with the reason that the clauses are reversed.
- **13:12 αὐτοῖς**: `s` + `t with them`, as above. This is not a split pair,
  because "with them" does not render the addressee.
- **13:1 μεταβῇ → "leave" and "return"**: agree that both English verbs
  render the one Greek verb of passing from the world to the Father. It is
  the same as one Greek verb linked to each English repeat. `t and#1` is
  right, and πρός = "to" is right. ἐκ is now `s` (see Changes). The rejected
  alternative, `t and return`, would leave a verb that BSB clearly uses for
  μεταβῇ without an owner.
- **13:24 reading claim**: the claim is real. The record is 14/9/12, so five
  N1904 words have no publisher match and there are three extra publisher
  words. Mapping the publisher's groups shows that the five words are καί,
  the first λέγει, αὐτῷ, Εἰπέ and ἐστιν, and that "to ask Jesus" is the only
  English the publisher left without an owner. So `s 5 6 7 8`, `s 10` and
  `t to ask` may name a different reading. Their wording is now softened
  (see Changes). `t Jesus` (supplied object) and `s 12` οὗ (the publisher
  matched it but gave it no English) are not reading claims and are right.
- **13:2 Iscariot**: confirmed. The record is 16/15/16, and the unmatched
  N1904 word is Ἰσκαριώτης. "Iscariot" is the only English the publisher
  left without an owner. It is the same name, so it is linked with a note.
  The note does not give the publisher's form. Agree.
- **13:19 "will believe"**: confirmed. The record is 14/13/14, and the
  unmatched N1904 word is πιστεύητε. "you will believe" is the English the
  publisher left without an owner. The verb and its meaning are the same, so
  it is linked with a note that does not spell the publisher's form. Agree.
- **Articles without prepositions**: confirmed in every verse. 13:2: τοῦ =
  "the" (the old row "and the" is gone), τήν = "the#1", and "of#0" is `t`.
  13:5: τῷ = "the#1", λεντίῳ = "with + towel". 13:29: τοῖς = "the#2",
  πτωχοῖς = "to#2 + poor". 13:33: τοῖς = "the", Ἰουδαίοις = "to#0 + Jews".
  No lone article carries a preposition, noun or copula anywhere in the
  chapter.

## Answers to the author's doubts

- 13:1: kept "return" on μεταβῇ; moved ἐκ to `s` (see above).
- 13:12: changed to `s` + `t` (see above).
- 13:38: changed to the alternative (see above).
- 13:26 καί = "after": kept. BSB turns "I will dip … and give" into "I give
  … after I have dipped", and "after" carries the sequence that the καί
  expressed. This follows the When-rule for καί-joined clauses that BSB
  subordinates. `s` + `t after` would also be defensible, but the link is
  not wrong.
- 13:5 "the" on τῶν: agree. In "the disciples’ feet", "the" determines
  "disciples’", so it belongs to τῶν μαθητῶν, and τούς is rightly `s`.
- 13:2 "The evening meal" on anarthrous δείπνου: kept. It is a publisher row,
  and an English article on an anarthrous noun is linked with the noun
  elsewhere in this chapter (13:38 "the rooster", as Matthew 26:34). It is
  not an over-claim.
- 13:30 ἦν δὲ νύξ: agree with νύξ = "night", ἦν and δέ `s`, and `t into the`.
  A single group "into the night" would put the copula on "into the". Unlike
  13:12, "night" is the same noun, recast; it is not a different relation.
- 13:13 καλῶς λέγετε = "rightly so": agree. The publisher's λέγετε = "so"
  alone was weak, and "and rightly so" renders "you say well" as a whole.

## Still uncertain (left as the author had them)

- 13:12 καί = "and#1": BSB moves the καί that joins ἀνέπεσεν to the clause
  before it to the place between "reclined" and "asked". Both join the
  reclining verb to its neighbour, so the link stands. `s` + `t and#1` would
  also be defensible.
- 13:2 opening καί `s` + `t and` between the two genitive absolutes: this
  follows the convention for an opening καί that links to the previous
  verse. The contrast with 13:12, where the moved καί is linked, rests on
  the καί's function, not on its position.
- 13:3 αὐτῷ + τάς = "His": defensible, because the dative names the
  possessor. αὐτῷ = "His" with τάς `s` would also work.
- 13:4 ἑαυτόν = "His waist": "waist" is implied by διέζωσεν ("girded") more
  than by the reflexive. `t waist` is an alternative.
- 13:17 ἐστε = "you will be" (present rendered as future) has no note, while
  13:10 ἔστιν = "he will be" has one. This is acceptable, but not
  consistent.
