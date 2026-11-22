# BSB Luke 23: independent peer review (Claude)

Checked: 55 of 55 verses (23:1-16, 23:18-56). 23:17 has no N1904 Greek and
no BSB text, so it has no block. No verse was kept from an earlier review.
I checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher record in `public/data/original-languages/bsb-word-links/luke.json`
(its groups and its `partial` counts, and the draft's EVIDENCE lines) and
the reviewed parallels Mark 15 and Matthew 27.
Final check: `fromtext` → `{"versesOk": 55, "problems": 0}`.

## Reading claims

`partial` records exist for 23:1, 3, 4, 6, 11, 12, 13, 18, 20, 24, 25, 26,
28, 30, 31, 39, 48, 50 and 52.

- One unmatched N1904 word, same word count (23:1, 3, 4, 6, 12, 13, 20, 24,
  52): the only candidate is Πειλᾶτος/Πειλάτῳ. Note "Same name, spelled
  differently in BSB's Greek text". Correct.
- 23:18 (11/10/11), 23:30 (13/12/13), 23:48 (16/15/16): one unmatched N1904
  word each. In the draft, the unmatched words are πανπληθεί, Πέσατε and
  συνπαραγενόμενοι, and their English ("in unison", "Fall", "who had
  gathered") is the English the publisher left unlinked. The spelling notes
  do not name the publisher's form. Correct (23:48 reworded, below).
- 23:11 (18/17/19): Pilate's spelling plus one extra publisher word, and
  "even" was the only English left without a link. `t even` is correct.
- 23:39 (16/16/17): one extra publisher word, and "he said" was left without
  a link. `t he said` is correct.
- 23:31 (12/12/13): one extra publisher word. The publisher linked "tree"
  alone to ξύλῳ and left "the" outside it. Changed (below).
- 23:28 (21/21/22) and 23:50 (11/11/12): one extra publisher word with no
  English left over, so no claim. Correct.
- 23:25 and 23:26: the Greek counts are equal (19/19/19); only the English
  word count differs by one. That is tokenization, not a reading, and nothing
  is claimed. Correct.

## Changes (5 verses)

- 23:11: `g 15` αὐτόν = "Him#2" and `t Him#1` ("περιβαλών has none in
  Greek") → `g 15` αὐτόν = "Him#1 + Him#2" ("The one object αὐτόν serves both
  περιβαλών and ἀνέπεμψεν; BSB repeats it as Him."). περιβαλὼν … ἀνέπεμψεν
  αὐτόν is the same pattern as 23:53 καθελὼν ἐνετύλιξεν αὐτό (it + it), which
  the author linked to both verbs, and as 23:16/23:22. It also follows Mark
  15:17 (στέφανον = a crown + it).
- 23:12: `g 15` προϋπῆρχον = "before this time" (the note said only the
  prefix προ- was rendered) and `g 19` ὄντες = "they had been" → `g 15 19` =
  "before this time they had been". The finite verb carries "they" and "had
  been". The participle ὄντες only completes it. Splitting them gave the
  subject and tense of the finite verb to the participle. The English is
  continuous, so this is one group with one note, like the periphrastics in
  23:8 and 23:19.
- 23:31: `g 4` ξύλῳ = "the tree" (with a reading note) → `g 4` = "tree" and
  `t the` = "BSB follows a reading with an extra word here that N1904 lacks."
  N1904 has no article before ὑγρῷ ξύλῳ. The publisher's extra word is the
  only Greek that can stand behind "the", and its own links kept "the" off
  ξύλῳ. Rule 9 says not to invent a link for a word N1904 lacks.
- 23:49: `g 3` οἱ = "those who" and `g 4` γνωστοί = "knew" → `g 3 4` = "those
  who knew" ("The article with the adjective γνωστοί "acquaintances" is
  rendered those who knew."). A lone article carried the relative "who".
  Joining fits rule 3 and how the author handles αἱ συνακολουθοῦσαι in the
  same verse. It also matches earlier Luke reviews (8:12, 8:36, 19:32 "those who
  …").
- 23:48 (note only): "same word, spelled differently" on the group οἱ
  συνπαραγενόμενοι → "the participle is spelled differently in BSB's Greek
  text". The group has two words, so the note now names which one.

## Answers to the author's doubts

- τῶν = "the", Ἰουδαίων = "of + Jews" (23:3, 23:37, 23:38): kept. This is
  the Luke convention, and it follows the rule that a lone article never
  carries a preposition. The difference from Mark 15:2/26 and Matthew
  27:11/37 should be settled when those chapters are aligned. It is not a
  reason to change it here.
- 23:31 ἐν τῷ ξηρῷ: agree with τῷ ξηρῷ = "it + dry" and `t is` twice. The
  article makes the adjective a noun ("the dry [wood]"), and English "it"
  stands for that whole noun phrase. So the article does not carry the
  pronoun alone. `τῷ s` + `t it is` would leave "it", which really does
  render the substantive, with no link. The only change in this verse is
  "the" (above).
- 23:38 "was posted": agree with ἦν = "was" and `t posted`. ἦν only says the
  inscription was there. "Posted" adds an action. (Matthew 27:37 is
  different: it has ἐπέθηκαν.)
- 23:5 καί `s` + `t and has come`: agree. The Greek καί joins διδάσκων and
  ἀρξάμενος, and BSB replaces it with a sentence break. The English "and"
  starts the verb phrase BSB adds for ἕως ὧδε, so it does not render that
  καί. This is not a split pair.
- 23:50 ἰδού + ὑπάρχων = "there was": agree. In Luke 19:2, ἰδού alone takes
  "there was" because that clause has no verb. Here ὑπάρχων ("being [a
  Council member]") supplies the "was", and ἰδού the presentational "there".
  The first ἀνήρ `s` is right.

Also confirmed: 23:34a is linked normally, and the publisher Greek equals
N1904 there.

## Still uncertain

- 23:7: καί (13) is `s` and αὐτόν = "himself". "Who himself was" may carry
  the "also" of καὶ αὐτόν, so the two could be joined. Either is defensible,
  so I left it.
- 23:51: ὅς = "and" (the relative clause becomes a coordinated clause). This
  follows the precedent of Luke 10:42 (ἥτις = "and it"). Another option is `s` + `t and`.
- 23:31: the exact place of the extra publisher word cannot be checked, since
  the publisher's Greek table is not in the repo. The `t the` relies on the
  publisher leaving "the" unlinked to ξύλῳ.
