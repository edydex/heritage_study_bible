# BSB Luke 14: independent peer review (Claude)

Checked: 35 of 35 verses (14:1-35), including 14:18 and 14:31, which the
author kept unchanged from the earlier Codex review. I checked every `g`, `s`
and `t` line against N1904, the displayed BSB, the publisher record in
`public/data/original-languages/bsb-word-links/luke.json` (its groups and its
`partial` counts) and the reviewed parallels Matthew 22:1-14, Matthew 12:11,
Matthew 23:12, Matthew 10:37-38 and Mark 9:38 and 9:50.
Final check: `fromtext` → `{"versesOk": 35, "problems": 0}`.

## Reading claims

The publisher record has a `partial` entry only for 14:13, 14:21, 14:25 and
14:26. The author claims a reading only in those verses.

- 14:13 and 14:21: 9/8/9 and 37/36/37 (sourceWords / matchedSourceWords /
  publisherGreekWords). One N1904 word differs in each verse, and the
  publisher's "the crippled" / "crippled" is the only English left without a
  group. ἀναπήρους = crippled with "Same word, spelled differently in BSB's
  Greek text" is right and uses the approved softened wording. Kept.
- 14:25: all 10 Greek words match (10/10/10); only one English word lacks a
  publisher group. No reading may be claimed, and none is. Kept.
- 14:26: 37/36/37. The only N1904 word and the only English word without a
  publisher group are αὐτοῦ and "his#0", so the link αὐτοῦ = his#0 is right.
  The note said BSB's Greek has "a slightly different form of this pronoun",
  which says more about the publisher's word than the counts show. Softened
  (see below).

## Changes (6 verses)

- 14:10: ὅταν = "and#1" → `s 10` ("BSB turns the clause ὅταν ἔλθῃ ('when he
  comes') into the coordinated verb come, so ὅταν ('when') has no
  counterpart") and `t and#1` ("English joins come and tell; the Greek
  subordinates ἔλθῃ with ὅταν instead"). "And" does not mean "when". BSB
  dropped the temporal clause and joined the two verbs. That is not a
  translation of ὅταν, so this is not a split pair. It also matches 14:9,
  where the same English "will come and tell" renders ἐλθὼν … ἐρεῖ and "and"
  is `t`. As in Mark 9:38, an English word that does not mean a Greek word
  must not carry it.
- 14:18 (Codex KEEP): `s 0` καί ("rendered with BSB contrastive But") plus
  `t But` → `g 0 = But`. This was a split pair: the `s` reason itself said
  that καί is rendered "But". The reviewed files link καί = But in 111 places.
  I also replaced four long, technical notes with one plain sentence each,
  worded like the author's 14:19: ἀπὸ μιᾶς (literally "from one") = one after
  another; ἔχω ἀνάγκην = I need; ἐρωτῶ σε = Please; ἔχε … παρῃτημένον =
  excuse. The `s 9` reason is now "BSB leaves the addressee αὐτῷ ('to him')
  unexpressed", as in 14:16. All other links are unchanged.
- 14:31 (Codex KEEP): τῷ = "the one" and ἐρχομένῳ = "coming" → `g 20 24` =
  "the one coming". Rule 3 joins an article and its participle. The author
  did this everywhere else in the chapter (14:9-12, 14:15, 14:17, 14:24,
  14:29, 14:33, 14:35). I also wrote the notes on πορευόμενος (on his way),
  συμβαλεῖν εἰς πόλεμον (to war + with) and δυνατός ἐστιν (he can) as one
  plain sentence each. The `t and` reason now matches 14:28 ("English joins
  the participle καθίσας to the main verb"). All other links are unchanged.
- 14:1: αὐτοί = "those" with `t in attendance` → αὐτοί = "those in
  attendance" (the publisher row, restored; the `t` is removed). This is
  BSB's rendering of the pronoun "they", not an added word. The author's own
  note already said "rendered those in attendance", and the author links
  other pronouns rendered by a noun phrase whole (αὐτοῦ = "the other king",
  14:32; αὐτόν/αὐτῷ = "Jesus", 14:1, 14:15, 14:25).
- 14:7: πρὸς τοὺς κεκλημένους = "the guests" → τοὺς κεκλημένους = "the
  guests", with πρός as `s` ("The preposition πρός ('to') has no
  counterpart; BSB moves the guests into the noticing clause and says told
  them"). In BSB "the guests" is the subject of "chose", so "to" has no
  place in that phrase. πρὸς αὐτούς = "them" (object of "told") is kept.
- 14:26: note only. αὐτοῦ = his#0 now reads "BSB's Greek text has a slightly
  different word here, with the same meaning." The note no longer names
  what kind of word the publisher has.

Every other line of the author's file is kept.

## Answers to the author's doubts

- 14:10 ὅταν: changed to `s` + `t and#1` (see above).
- 14:7: the author's main choice is right. Link by meaning: κεκλημένους
  ("those invited") is "the guests", and αὐτούς is "them". Linking
  τοὺς κεκλημένους = "them" would hide the word that means "guests". Only
  the πρός is moved out (see above).
- 14:29 ἄρξωνται … ἐμπαίζειν = "will ridicule": keep. BSB drops "begin".
  The reviewed Luke 9:12, Luke 11:29 and Mark 6:55 join ἄρχομαι with its
  infinitive the same way. 14:9 is different: there BSB has "will have" for
  ἄρξῃ, so ἄρξῃ keeps that link.
- 14:25 δέ = "now": keep. BSB often renders narrative δέ as "Now", and here
  it only moves inside the verb phrase. `s` plus `t now` would leave δέ
  unexplained and add a bare English word.
- 14:1 αὐτοί: restored to "those in attendance" (see above).
- 14:28, three `t` (to see, the resources, it): agree. ἔχει means "has", εἰ
  means "if", and ἀπαρτισμόν means "completion". The supplied verb, object
  and pronoun do not belong to them. This matches the treatment of "the
  work" and "it" in 14:29.
- 14:24 ἐκείνων = "of those": keep. ἐκείνων is a genitive demonstrative,
  not a lone article, so it can carry "of". The publisher row is not wrong.

## Other points checked and kept

- 14:5: Τίνος = "Which + whose" is right. BSB splits the genitive
  interrogative into the question word and the possessive of "son".
  The publisher's "whose son" on υἱός claimed "whose" for a word that does
  not mean it. ἀνασπάσει = "will + pull + out" and αὐτόν = "him" are right
  (ἀνα-σπάω "draw up"). οὐκ = "not" is separate, as in Matthew 12:11.
- 14:16: ὁ (with δέ) = "Jesus" follows the reviewed files (27 such links).
- 14:21: `t all` with ταῦτα = "this" matches Mark 8:4 and Mark 13:2.

## Still uncertain

- 14:4: αὐτόν = "him#0" with `t him#1`. Matthew 12:11 links one shared
  αὐτό to both English "it"s. Either is defensible, so the author's
  choice is kept.
- 14:31: συμβαλεῖν εἰς πόλεμον = "to war + with" (Codex grouping). Linking
  "with" to συμβαλεῖν (συν-, "meet with") and "to war" to εἰς πόλεμον would
  be finer. The grouping is not wrong, so it is kept.
- 14:20: καί = "Still" ("Still another said") is the publisher row. It is
  kept as a rendering of the connective.
