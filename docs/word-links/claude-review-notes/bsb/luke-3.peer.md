# BSB Luke 3: independent peer review (Claude)

Checked: 38 of 38 verses (3:1-38), every line, starting from the author's
finished file. Final check: `fromtext` → `{"versesOk": 38, "problems": 0}`.

Changes: 21 in 15 verses. One is a link change (3:23, two groups); the other
20 are notes that stated the publisher's exact Greek spelling, which the
repo cannot show.

## Reading claims checked against the publisher record

`public/data/original-languages/bsb-word-links/luke.json` has a `partial`
record in 3:1, 3:2, 3:5, 3:15, 3:16, 3:20, 3:23-30 and 3:33. In each one the
number of unmatched source words equals the number of words the author
treats as different, and the publisher's link for that word is the one
missing (Pilate, John, Heli, the names in the genealogy, "straight" in 3:5).
So each claimed difference is in the right place. The publisher's Greek
table is not in the repo, so its exact spellings cannot be checked and the
notes no longer state them. In 3:20 the publisher's Greek has one word more
than N1904 (11 against 10). No English word depends on it and no claim is
made for it, which is correct.

## Changes

Notes rewritten (links unchanged):

- 3:1 Pilate, 3:2 John, 3:16 John, 3:20 John, 3:23 Heli, 3:24 Matthat,
  Levi, Melchi, 3:25 Esli, 3:26 Semein, 3:27 Neri, 3:28 Melchi, Addi,
  3:29 Jorim, Levi, 3:30 Eliakim, 3:33 Admin, Arni (18 notes): "Same name;
  the publisher's Greek spells it …" → "Same name, spelled differently in
  BSB's Greek text." The old notes gave the publisher's spelling as fact.
- 3:5 εὐθείας = straight: "The publisher's Greek has the singular εὐθεῖαν,
  with the same meaning." → "BSB's Greek text has a different form of this
  word here, with the same meaning." Same reason. The link stays (rule 9):
  "straight" is the same English word, so the meaning is unchanged.
- 3:15 Ἰωάνου + αὐτός = John: "… the publisher's Greek spells it Ἰωάννου."
  → "… BSB's Greek text spells the name differently." Same reason.

Link change:

- 3:23 ὢν = "He was", ἐνομίζετο = "regarded" → ὢν = "He",
  ἐνομίζετο = "was regarded". In "He was regarded as the son of Joseph",
  "was" is the passive auxiliary of "regarded", and ἐνομίζετο is the
  imperfect passive ("was supposed"). Auxiliaries stay with their verb, as
  with do, will and should elsewhere. The participle ὢν ("being") has no
  English verb of its own. Its subject appears as "He", as in 3:23
  ἀρχόμενος = "when He began" and 3:21 προσευχομένου = "as He was
  praying". Both groups have new one-sentence notes.

## Answers to the author's doubts

- Genealogy, τοῦ = "the son": kept. The rule that a lone article never
  carries a noun is about an article whose noun is printed next to it. Here
  τοῦ stands alone for the person (ὁ τοῦ X = "the son of X"), so it is the
  only Greek word for "the son", and the genitive name gives "of". I checked
  every pair in 3:23-38 by script: all 76 τοῦ = "the son" and all 76 names
  = "of Name", plus υἱός = "the son" and Ἰωσήφ = "of Joseph" in 3:23. Ἰησοῦ
  = Joshua (3:29) has a correct note. The 3:31 Δαυείδ/David match is one of
  the publisher method's two allowed spelling pairs, so it needs no note.
- 3:23 ὢν/ἐνομίζετο: changed, as above.
- 3:18 καί = "and": kept. The καί of πολλὰ καὶ ἕτερα joins "many" and
  "other", and BSB's "these and many other" spells out that these are added
  to the sayings just reported. Linking the Greek "and" to the English "and"
  claims nothing false. `t these` is right: no Greek word points back.
  παρακαλῶν = "With + exhortations" is right: the participle of means is
  made into a noun phrase. μὲν οὖν is `s`.
- 3:15 one "John" for Ἰωάνου and αὐτός: kept. The English word names John
  and is also the subject of "could be", which is αὐτός. Splitting them
  would leave one of the two without its English word. περί is `s`.
- 3:5 second εἰς as `s`: kept. Joining it to λείας would make "smooth" claim
  a preposition. ἔσται εἰς = "shall be made" is right for the first clause.

## Other verses

Matthew 3, with Mark 1, is the parallel for 3:1-22. The Luke rows agree
with them: ἀξίους = "in keeping with",
Πατέρα = "as our father" with ἔχομεν = "We have", ἤδη … κεῖται = "lies
ready", οὖν = "and" (3:9), οὗ … αὐτοῦ = "whose" and ὁ = "One" (Mark 1:7),
and γεννήματα = "You brood". Every other verse was checked, including the
author's split negatives (3:8, 3:9, 3:14), the explicit ἡμεῖς (3:14), the
"t John"/"t Herod" rows (3:7, 3:11, 3:18, 3:20), ὑπ’ αὐτοῦ = "he" (3:19),
ἐν τῷ = "When" (3:21) and εἴδει = "in a + form" (3:22). No other errors
were found.

## Still uncertain

- 3:5: the differing word is inferred from the dropped publisher row and the
  20-of-21 count, not read from the publisher's Greek.
- 3:20: the extra publisher word cannot be identified from the repo.
- 3:18 καί and 3:15 John are judgment calls. The alternatives are listed
  above.
