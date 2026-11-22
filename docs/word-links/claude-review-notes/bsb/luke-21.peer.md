# BSB Luke 21: independent peer review (Claude)

Checked: 38 of 38 verses (21:1-38), including 21:37, which the author kept
unchanged from the earlier Codex review. I checked every `g`, `s` and `t`
line against N1904, the displayed BSB, the publisher record in
`public/data/original-languages/bsb-word-links/luke.json` (its groups and its
`partial` counts) and the reviewed parallels Mark 12:41-44, Mark 13 and
Matthew 24.
Final check: `fromtext` → `{"versesOk": 38, "problems": 0}`.

## Reading claims

The publisher record has a `partial` entry only for 21:11, 21:19, 21:34 and
21:35 (sourceWords / matchedSourceWords / publisherGreekWords below). The
author claims a reading only in those verses.

- 21:11: 18/15/18. Three N1904 words are unmatched, and the publisher has
  the same number of words. The publisher groups leave only six N1904 tokens
  without a link: τε (1), καί (3), λοιμοὶ καὶ λιμοί (6-8) and ἔσται (17). Of
  these, λοιμοὶ καὶ λιμοί is the only run of three that the English order
  ("famines, and pestilences") explains. That fits the same two nouns in the
  other order. Linking each noun by meaning, with a note that
  says only "follows a reading that differs from N1904 here", is right
  (rule 9, same-meaning case). Kept.
- 21:19: 8/7/8. The one unmatched N1904 word is κτήσεσθε (the publisher
  groups cover every other word, and "you will gain" was the only English
  left without a group). The note says only "BSB's Greek differs at this
  word" and does not name the publisher's form. The English future renders
  N1904's future exactly, so the link with a note is right. Kept.
- 21:34-35: 21:34 is 24/24/26 (every N1904 word matched, two extra publisher
  words); 21:35 is 13/11/11 (two N1904 words unmatched, publisher has two
  fewer). The publisher's own 21:35 groups start at γάρ and cover nothing
  before it. This shows a real verse-division difference: ὡς παγίς ends 21:34
  in BSB's Greek and starts 21:35 in N1904. The cross-verse links
  (`g @21:35 0 = like`, `g @21:35 1 = a snare`, `m 0 1 > 21:34`) are right.
  Kept.
- All other verses have no `partial` key, so the publisher Greek equals
  N1904. No reading is claimed there. The `t here` in 21:6, `t these` in
  21:32 and `s` ταῦτα in 21:36 are worded as English additions or omissions,
  not as readings. Correct.

## Changes (3 verses)

- 21:30: `g 0 2` ὅταν … ἤδη = "When" → `g 0` ὅταν = "When" and `s 2 8` = "ἤδη
  ('already', twice) is not expressed in this English wording." Plain "When"
  does not mean "already". The author left the second ἤδη `s` but folded the
  first into "When". In Mark 13:28, ὅταν ἤδη is joined only because BSB says
  "As soon as" there, which does carry "already". Here BSB says only "When".
- 21:37 (Codex KEEP): `g 0 7` Ἦν … διδάσκων = "Jesus taught" → "taught", with
  `t Jesus` ("English names the subject; the Greek gives it only in the verb
  Ἦν … διδάσκων"). The name is English-only, as the old note itself admitted.
  The author treats it the same way in 21:1, 21:5 and 21:29. I also replaced
  the long, technical notes with one plain sentence each (Ἦν … διδάσκων;
  τὰς ἡμέρας = Every day; τὰς … νύκτας = every evening; ἐξερχόμενος = He went
  out; ηὐλίζετο = to spend the night, now with a note). The `s 1` δέ and
  `s 16 17` τὸ καλούμενον reasons are now plain sentences. All other links
  are unchanged.
- 21:4 (notes only): τοῦ ὑστερήματος was glossed "her lack" → "the lack"
  (αὐτῆς = "her" is its own group). τὸν βίον was glossed "πάντα τὸν βίον,
  'her whole living' … all … to live on" → "τὸν βίον, 'the livelihood', is
  rendered to live on". The group has only τὸν βίον (πάντα = "all" is
  separate), and "her whole living" is Mark 12:44's ὅλον τὸν βίον αὐτῆς, not
  Luke's Greek. The links are unchanged.

## Answers to the author's doubts

- 21:4, ἔβαλον εἰς τὰ δῶρα = "contributed": **agree**. "Contribute" means to
  give into a common fund or collection, so the one English verb carries
  "put into the offerings". Leaving εἰς τὰ δῶρα `s` would say the phrase is
  unexpressed, which understates BSB's verb choice. The other option is
  defensible because BSB uses the same "contributed" for bare ἔβαλον in Mark
  12:44, but I don't think it is better. οὗτοι = "they" and πάντες = "all"
  are also right (Luke has the extra οὗτοι that Mark 12:44 lacks).
- 21:3, πάντων = "than all" + `t the others`: **agree**. In Mark 12:43
  "the others" renders τῶν βαλλόντων, which Luke does not have. Here it is
  English clarification, not a meaning of πάντων.
- 21:13, "opportunity" on ἀποβήσεται: **agree**. ἀποβαίνω εἰς means "turn out
  as / lead to". "This will be your opportunity to …" is the usual
  idiomatic rendering of that verb plus εἰς. Making "opportunity" `t` would
  leave the verb only "This will be" and understate it.
- 21:11, τε (11) = "along with": **agree**. The τε is additive. BSB's "along
  with" is how that addition is expressed when the second clause joins the
  list. An `s` + `t` would be a split pair. τε (1) stays `s`, correctly,
  because nothing in English renders it.
- 21:5, "with" on καλοῖς ("with beautiful"): **agree, keep**. καλοῖς is in
  the same instrumental dative as λίθοις, and "with beautiful" is a
  contiguous publisher row. Moving "with" to λίθοις would be a change of
  taste, not a correction. 21:35 πάσης = "of all" is the same pattern.

## Other points checked

- 21:12: the explicit ὑμᾶς (in ἐφ’ ὑμᾶς) carries "you#0". The objects after
  "persecute" and "deliver" are not expressed in Greek, so `t you#1` and
  `t you#2` are right. ὑμᾶς is the object of ἐπί inside the idiom
  "lay hands on". Unlike Mark 13:11, it is not a shared direct object of the
  later verbs. "you#3" stays with ἀπαγομένους: that participle is accusative,
  and its referent is "you" (passive "being led away"). BSB recasts it as
  active "they will bring you". This matches the precedent in reviewed
  1 Peter 2, where a passive participle carries its whole active recast. No
  "you" is over-claimed. `t and#2` is right.
- 21:38: ὤρθριζεν = "early in the morning + would come", with πρὸς αὐτόν
  `s`: **agree**. ὀρθρίζω (πρός τινα) means "come early in the morning (to
  someone)". The imperfect gives "would". English "Him" is the object of
  "hear" (αὐτοῦ), so πρὸς αὐτόν has no English of its own.
- 21:2, ἐκεῖ = "in" (publisher row): kept. "Put in" = put there, into the
  treasury.
- The author's parallels check out against the reviewed files: Mark 13:2
  (λίθος = one stone; ὃς οὐ = every one), Mark 13:8 (one "There will be"
  for two verbs), Mark 13:17 (How + miserable, for pregnant, `t will be`)
  and Mark 13:29 (ὑμεῖς = you, ἴδητε = see).

## Still uncertain

- 21:4: whether εἰς τὰ δῶρα should be joined into "contributed" or left `s`
  (see above). Both are defensible. I kept the author's join.
- 21:11: whether the second τε belongs with "along with" or is only the
  "both" of τε … καί. I kept the publisher/author link.
