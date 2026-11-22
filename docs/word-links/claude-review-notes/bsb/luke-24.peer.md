# BSB Luke 24: independent peer review (Claude)

Checked: 53 of 53 verses (24:1-53), including the double-bracketed passages
(24:12, 24:36b, 24:40, 24:51b, 24:52a). Their EVIDENCE is N1904 and BSB
translates them, so they are linked like any other verse. I checked every
`g`, `s` and `t` line against N1904, the displayed BSB, and the publisher
record in `public/data/original-languages/bsb-word-links/luke.json` (its rows
in the draft and its `partial` counts). I also checked the reviewed parallels
Mark 16 and Matthew 28, Mark 15:20 and the earlier Luke chapters.
Final check: `fromtext` → `{"versesOk": 53, "problems": 0}`.

## Changes

One change. Every link is unchanged.

- 24:48 `t are` reason: "English verb; BSB follows a reading with an extra
  word here, but N1904 has no verb in this sentence." → "BSB follows a
  reading with an extra word here, rendered are; N1904 has no verb in this
  sentence." Why: the record supports the clearer wording. The publisher's
  six English words are all linked, but "are" is linked to none of the three
  N1904 words. So the publisher linked "are" to its extra word. This follows
  the earlier wording "BSB follows a reading with an extra word here,
  rendered you, which N1904 lacks". The note still does not name the word.

## Reading claims

The record has a `partial` entry (sourceWords / matchedSourceWords /
publisherGreekWords) only for 24:10, 15, 25, 45, 46, 48 and 50. Every
reading claim in the file is in one of these verses.

- 24:10 (21/20/21) and 24:15 (14/13/14): one word differs on each side. The
  publisher left "Joanna" and "deliberated" unlinked, and Ἰωάνα and
  συνζητεῖν are the only N1904 content words without a publisher link. So the
  notes "Same name/word, spelled differently in BSB's Greek text" are right.
  They do not name the publisher's form. Kept.
- 24:25 (19/19/19): no Greek word is unmatched either way. The difference is
  on the English side (20 publisher English words against 21 displayed). No
  reading is claimed. Right.
- 24:45/46: this is a verse-division difference, confirmed by the counts.
  24:45 is 12/9/9: three N1904 words are unmatched and the publisher's verse
  has only nine words. 24:46 is 13/13/16: every N1904 word is matched and the
  publisher has three extra words. The publisher left "And He told them"
  unlinked in 24:46, and καὶ εἶπεν αὐτοῖς unlinked at the end of N1904's 24:45.
  So BSB's Greek opens verse 46 with that clause. Kept: `m 9 10 11 > 24:46`
  in 24:45 and `g @24:45 9/10/11 = And / He told / them` in 24:46. This is
  the format used in Luke 7:18-19 and 22:66-67. It is not a reading claim.
- 24:47: no `partial` entry, so the publisher's Greek is N1904 here (εἰς).
  No καί reading may be claimed. Kept (see below).
- 24:48 (3/3/4): one extra publisher word, rendered "are". `t are` with the
  reading reason is right (only the reason's wording changed, above).
- 24:50 (13/13/14): one extra publisher word, which the publisher linked to
  "out". Kept as `g 0 = had led + out` with the note (see below).

## Answers to the author's doubts and the points to settle

- **24:45/46** `καὶ εἶπεν αὐτοῖς`: agree. The counts above confirm the
  division difference.
- **24:47** εἰς `s` + "and" `t`: agree. EVIDENCE says the publisher's Greek
  equals N1904, so "and" cannot be explained as a καί reading. "and" does not
  mean εἰς ("for", "leading to"). By the convention, a word with another
  meaning must not carry the Greek word, so `s` + `t` is right, not a split
  pair. The reasons claim no reading.
- **24:50** "out" on Ἐξήγαγεν: agree. ἐξάγω itself means "lead out", so
  "led … out" is a correct rendering of N1904's word alone. The reviewed Mark
  15:20 links ἐξάγουσιν = "they led + out". Luke 22:7 sets the pattern for an
  English word that the N1904 word already justifies when BSB's Greek has an
  extra word: link it and note "BSB follows a reading with an extra word
  here". `t out` would hide that the verb means "led out". The note does not
  name the extra word.
- **24:48** "are" `t`: agree (reason reworded).
- **24:21**: agree on all three. ταύτην = "the": the demonstrative is the
  determiner of ἡμέραν, and English weakens "this" to "the". ἄγει = "it is":
  ἄγει is impersonal, and its built-in subject stays with the verb. The
  publisher's ταύτην = "it" gave an accusative modifier the role of subject.
  σύν = "besides": BDAG gives "besides, in addition to" for σύν with exactly
  this verse. The publisher's γε = "besides" was wrong. ἀλλά γε καί = "And"
  as one group of particles is fine. Splitting off γε καί as `s` would also
  be acceptable, so I did not change it.
- **24:32** both ὡς = "as": agree. "and" does not mean ὡς, so the publisher's
  second ὡς = "and" was wrong. The one English "as" governs both coordinated
  verbs (spoke … and opened), so it does render both ὡς. 24:27 treats the two
  ἀπό = "with" the same way.
- **24:12 / 24:33** καί `s` + "and" `t`: agree. Neither is a split pair. In
  24:12 the καί before ἀπῆλθεν joined "he sees" and "went away". BSB turns
  that into subordination: "after … seeing …, he went away". The English
  "and" stands between the participle παρακύψας and βλέπει, where the Greek
  has no conjunction. In 24:33 the καί before εὗρον becomes a sentence break
  ("There they found"). The "and" joins ἀναστάντες to ὑπέστρεψαν. This
  matches Luke 8:7 (peer): when the καί's work is taken over by another
  structure, the remaining participle "and" is `t`. Luke 10:30 differs: there
  the καί and the English "and" coordinate the same series.
- **24:1** μιᾷ = On + first, `t day`, τῶν = the, σαββάτων = of + week:
  agree. Mark 16:2 keeps "on the"/"of the" on the articles, but the current
  rule is that a lone article carries only "the". The case words therefore
  go on the inflected words, as in later Luke chapters (Luke 9:22 "on +
  day"). σάββατα declines, so the indeclinable-name exception (24:9 τοῖς
  ἕνδεκα = "to the") does not apply. The parallels now differ only in where
  "on"/"of" sit; the meaning shown is the same.
- **24:24** οὕτως = "just", καθώς = "as": kept. This is the publisher's row.
  "just as" ("exactly as") does carry οὕτως ("so, in this way"), and the
  note says so. Joining them would be a choice of taste, not a correction.

## Also checked and kept

- When/As/While/After go on the participle, the genitive absolute or ἐν τῷ +
  infinitive (24:3, 5, 9, 12, 36, 40, 41; 24:4, 15, 30, 51). In 24:28 and
  24:50 they go on the καί between the two clauses BSB subordinates. The
  opening connective is `s`.
- Supplied subjects and objects are `t`, never folded into a Greek word.
  Pronouns that BSB names are linked with a note: 24:5 αὐτῶν = the women,
  24:23/31 αὐτόν = Jesus, 24:25 αὐτός = Jesus, 24:36 αὐτός = Jesus Himself,
  24:35 αὐτοί = the two.
- 24:11 ταῦτα = "their" (publisher row, with note): kept. The article τά is
  only the required article with the demonstrative, not a possessive. "their"
  replaces the demonstrative's pointing to the women's words.
- 24:13 / 24:33 αὐτῇ = same/very, τῇ = That/that: matches Luke 13:31 and
  20:19.
- 24:19 Τά = "The events" and 24:27/35 τά = "what": the article is the head
  here ("the things"), not an article of another noun. "was written" and "had
  happened" are `t`.
- 24:26 καί = "and then": matches the reviewed Luke 1:56, 9:62, 19:12 and
  Mark 7:19.
- 24:53 ἦσαν … εὐλογοῦντες = "praising" (periphrastic joined), καί `s`
  because BSB continues 24:52's sentence.
- No Russian in any note. No note states the publisher's exact Greek wording.

## Still uncertain

- 24:12: by the "When …, …" convention, "after" could instead go on the
  καί before ἀπῆλθεν, since BSB subordinates the βλέπει clause. I kept it on
  the aorist participle παρακύψας, which is the more natural reading and
  follows the participle rule.
- 24:7 "of#1 sinful" on ἁμαρτωλῶν and 24:42 "of broiled" on ὀπτοῦ: both
  words are genitive, so "of" is expressed either way. These are publisher
  rows, kept. Putting "of" on the head noun (ἀνθρώπων, ἰχθύος) would be
  equally valid.
