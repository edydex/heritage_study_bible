# BSB Luke 7: independent peer review (Claude)

Checked: 50 of 50 verses (7:1-50). I checked every `g`, `s` and `t` line
against N1904, the displayed BSB, the publisher record in
`public/data/original-languages/bsb-word-links/luke.json` and the reviewed
parallels Matthew 8:5-13, Matthew 11:2-19 and Mark 1:2. Final check:
`fromtext` → `{"versesOk": 50, "problems": 0}`.

## Reading claims

The publisher record has a `partial` entry for 7:18, 7:19, 7:20, 7:22, 7:24,
7:28, 7:29, 7:33, 7:45 and 7:47. I mapped the publisher's groups onto N1904
to see which English words are left without a link:

- 7:18-19, verse division: N1904 7:18 has 18 words, of which the publisher's
  7:18 matches 8 out of only 9 publisher words. N1904 7:19 has 12 words, all
  matched, while the publisher's 7:19 has 21 words. 18 + 12 = 9 + 21, so 9
  words move from verse 18 to verse 19. These are exactly N1904's last 9
  tokens of 7:18 (καὶ προσκαλεσάμενος δύο τινὰς τῶν μαθητῶν αὐτοῦ ὁ Ἰωάνης),
  and the English left unlinked in 7:19 is "So John called two of his
  disciples". The verse division really differs, and the author's `m … >
  7:19` / `g @7:18 …` cross-verse link is right. The one other unmatched
  word in 7:18 sits in the first half; "him" (Ἰωάνει) is the only unlinked
  English word there, which fits the spelling note on Ἰωάνει.
- 7:20, 7:22, 7:24, 7:28, 7:29, 7:33: equal word counts, and only the
  English for John ("John", "to John", "John's", "than John", "of John") is
  left unlinked. That fits "Same name, spelled differently in BSB's Greek
  text".
- 7:45: equal counts, one word differs, and "has not stopped" is the only
  unlinked English. That fits the author's note that διέλειπεν is the same
  verb in a slightly different form; the note does not state the
  publisher's spelling.
- 7:47: all 19 N1904 words match and the counts are equal, so no reading is
  claimed (correctly). Only the English side differs: 23 of 24 words match,
  and "because" is the one unlinked word.

## Changes (3 verses)

- 7:42: τίς = "Which", αὐτῶν = "one" → τίς αὐτῶν joined = "Which one" (same
  note). "one" does not render αὐτῶν ("of them"); together the two words
  mean "which of them". This was a publisher row that the author kept. No
  reviewed Gospel file links αὐτῶν to "one".
- 7:22: link unchanged, note corrected. The note on εὐαγγελίζονται said it
  is rendered "the good news is preached to", but "to" is linked with
  πτωχοί ("to the poor"). New note: "The passive εὐαγγελίζονται ("have the
  good news preached to them") is recast with the poor as recipients: "the
  good news is preached"."
- 7:19: link unchanged, note removed. I removed the spelling note from
  `g @7:18 17 = John`. The publisher counts cannot show how this moved
  occurrence is spelled, because all 9 moved words count as unmatched in
  both verses. The link Ἰωάνης ↔ John is obvious without a note.

## Answers to the author's doubts and the points raised

- 7:18-19 cross-verse link: confirmed by the counts above. Kept.
- 7:19-20 ὁ ἐρχόμενος joined = "the One who was to come": kept. Rule 3
  joins an article with its participle, and the reviewed Gospel files
  mostly join this phrase: Matthew 3:11, 21:9, 23:39 and Mark 11:9. Matthew
  11:3, which splits it ("the One who" / "was to come"), is the exception.
- 7:22 the one καί → the list-final "and": kept. The Greek list has one
  coordinator and BSB's English has one. The publisher had folded that "and"
  into εὐαγγελίζονται, which over-claimed. Leaving καί `s` with `t and`
  would be a split pair. Matthew 11:5 has four καί and links "and" to the one
  before πτωχοί, so it is not a direct model.
- 7:4 ᾧ = "to#1", παρέξῃ = "have You grant": kept. The relative clause after
  ἄξιος does the same work as ἵνα in 7:6 and Matthew 8:8, where ἵνα = "to"
  and the verb = "have You come". The note explains that the relative
  pronoun is recast. The publisher's version (ᾧ `s`, παρέξῃ = "to have You
  grant") would also be acceptable, but the author's version is not wrong
  and matches 7:6.
- 7:25 οἱ … ὑπάρχοντες = "those who + wear + live", ἐν = "in#1": kept.
  "wear" and "live" both render the participle "being [in]", which BSB
  applies to each noun. "wear" does not render ἐν. Linking ἐν = "wear +
  in#1" would put a verb on a preposition.
- 7:37 "there" = ἐν … οἰκίᾳ, τοῦ Φαρισαίου `s`: kept. Folding Φαρισαίου (a
  content word) into "there" would over-claim. 7:36 already names the
  Pharisee's house, so the `s` reason is accurate.
- 7:45 same-verb note: kept (see Reading claims).
- 7:47 ὅτι = "because": kept. ὅτι is the only Greek word that "because" can
  render. The note states the change of position plainly. `s` with
  `t because` would be a split pair.
- 7:8 τασσόμενος `s`: kept. BSB's "a man under authority" has no word for
  "placed".

I also checked these against precedent and kept them: ὁ (with δέ) = "Jesus"
in 7:43 (Mark 5:34, 6:37, 12:15, 14:61; Matthew 12:39, 19:4, 22:37), ἐκείνῃ
= "that very" in 7:21 (Matthew 8:13), and ἄνθρωπος φάγος = "glutton" with
`t this` in 7:34 (Matthew 11:19).

## Still uncertain

- 7:4: either way of anchoring "to" is defensible (see above). I kept the
  author's choice.
- 7:11: καί = "accompanied by" (a publisher row) is a recast of "and a large
  crowd", not a translation of the conjunction. I kept it because the note
  explains it and the alternatives (`s` + `t`) would be a split pair.
