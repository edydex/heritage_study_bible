# BSB Luke 11: independent peer review (Claude)

Checked: 54 of 54 verses (11:1-54). I checked every `g`, `s` and `t` line
against N1904, the displayed BSB, the publisher record in
`public/data/original-languages/bsb-word-links/luke.json` and the reviewed
parallels Matthew 6:9-13, 6:22-23, 7:7-11, 12:22-45, 23:4-36, Luke 8:16 and
Luke 9:18. Final check: `fromtext` → `{"versesOk": 54, "problems": 0}`.

## Reading claims

The publisher record has a `partial` entry for 11:1, 11:2, 11:8, 11:11,
11:15, 11:24, 11:30, 11:32, 11:39, 11:41-43 and 11:46-47 only. Every reading
note in the file sits in one of these verses, and none states the
publisher's spelling as fact:

- 11:1 (John), 11:2 (come), 11:8 (persistence), 11:15 (said), 11:30
  (Ninevites), 11:32 (of Nineveh): the publisher has as many Greek words as
  N1904, one N1904 word is unmatched, and that word is the one the
  publisher's own rows leave unlinked. A same-meaning spelling note with a
  link is right under rule 9.
- 11:11: 16 N1904 words, 15 matched, 16 publisher words, so one word is
  different. μή is the word the publisher's rows leave unlinked, and the
  English question renders neither μή nor a replacement. `s` with a reading
  reason is right.
- 11:24: 25 N1904 words, all matched, 26 publisher words, so BSB's text has
  one extra word. "Then" is the word the publisher left unlinked. `t Then`
  with "BSB follows a reading with an extra word here" is right.
- 11:39, 11:41-43, 11:46-47: all Greek matched; only English counts differ.
  The author correctly claims no reading there.

## Changes (4 verses)

- 11:1: `ἐν τῷ εἶναι` = where → `ἐν τῷ` = where, `s εἶναι`. In every
  reviewed Luke chapter ἐν τῷ alone carries the conjunction BSB uses
  (1:21 "why", 5:1 "with", 5:12 "While", 9:18 "as"), and the infinitive is
  linked separately. Here BSB has no "was": "had just finished praying"
  renders ὡς ἐπαύσατο with the participle. So εἶναι has no English word,
  and folding it into "where" over-claimed.
- 11:39: Νῦν = Now, δέ = then → `Νῦν` = Now then, `s δέ`. δέ is the
  narrator's connective on "said" (εἶπεν δὲ ὁ Κύριος). "Now then" opens the
  Lord's own words and renders Νῦν. Linking the narrative δέ to a word
  inside the quotation put it in the wrong speaker's mouth. The publisher
  row was wrong, not just a matter of style.
- 11:46: προσψαύετε = will + lift + to lighten → `προσψαύετε` = will + lift,
  `t to lighten`. "Lift a finger" is BSB's idiom for "touch with one of your
  fingers", so "lift" is the counterpart of "touch". "To lighten" adds a
  purpose that no Greek word states. τοῖς φορτίοις stays "their load".
  "Lighten" does not mean "touch", so linking it to the verb over-claimed.
- 11:32: note only. Νινευεῖται is a gentilic noun in apposition to ἄνδρες,
  not an adjective. The link is unchanged.

## Answers to the author's doubts

- 11:1 ἐν τῷ εἶναι = "where": partly agreed. "Where" stays linked, but only
  to ἐν τῷ, and εἶναι is `s` (see above). `t where` would break the Luke
  convention that ἐν τῷ carries BSB's recast conjunction, even an unusual
  one ("why", "with").
- 11:46 "to lighten": changed to `t`, as the alternative proposed.
- 11:5 Τίς = "Suppose one": kept. BSB recasts the hypothetical question
  Τίς … ; ("which of you …?") as "Suppose one". Both words come from the
  interrogative, and nothing else in the Greek supplies them.
- 11:7 `t suppose`: kept. εἴπῃ is already linked to "answers", with
  ἀποκριθείς. "Suppose" only repeats the 11:5 frame.
- 11:36: kept. ἔσται = "you will be" follows rule 4, and the note explains
  that BSB changes the subject from the body to "you". φωτίζῃ … τῇ ἀστραπῇ
  = "were shining" (τῇ `s`) is a fair merge: "shine on" covers "light up
  with its beam". The publisher had put "were shining" on ἀστραπῇ alone
  and left φωτίζῃ unlinked.
- 11:49 ἐξ = some of + others: kept. The one partitive ἐξ αὐτῶν governs
  both verbs. BSB splits it into "some of them … and others", so "others"
  is the partitive understood again, not a new word.
- 11:39 δέ = "then": changed (see above).

## Points checked on request

- 11:1: Καὶ ἐγένετο = One day (as Luke 9:18) and ὡς ἐπαύσατο = had just
  finished (ὡς "when" joined with the verb; the publisher's ὡς = where was
  wrong) are kept. καθώς = "just as" with καί `s` is kept. BSB gives "just
  as" for a bare καθώς in Luke 1:2 and 2:20, and reviewed files handle
  καθὼς καί both ways, so changing it would only be style.
- 11:29: αὕτη = This, γενεά (second) = a + generation, `s Ἡ γενεά` kept.
  BSB says "this generation" only once, as "This". Folding Ἡ γενεά into
  "This" would put a noun on a pronoun.
- 11:30: σημεῖον = a sign + a sign kept. σημεῖον is understood with ἔσται
  in the second clause. The file treats every such repeat this way
  (11:17 divided, 11:27 blessed, 11:33 puts + he sets; Matthew 12:44
  house + the house).
- 11:36: checked word by word against the realigned rows. Every Greek word
  and every English word is placed correctly, including μὴ … τι = no,
  ἔχον = with, `t of it`, `t is` and ὡς ὅταν = as though.
- 11:10, 11:13, 11:23 (and 11:27-28, 11:33, 11:40, 11:44, 11:50-52): the
  article and participle are joined under rule 3, as in Luke 8:16 and the
  other reviewed Luke chapters. 11:23 keeps μή separate (not), as rule 2
  requires. Matthew 7:8, 7:11 and 12:30 split these pairs, but that is the
  older convention, and I kept the joins.

## Still uncertain

- 11:14: the bare episode-opening Καί stays linked to "One day" (publisher
  row). It follows the "At this" convention for connectives, but unlike
  11:1 there is no ἐγένετο here. `s` with `t One day` is the alternative.
- 11:39: my move of "then" from δέ to Νῦν is a judgment about the speaker
  frame. A reviewer who reads BSB's "then" as δέ moved into the quotation
  could restore the publisher row.
- 11:21: τὰ ὑπάρχοντα is article + participle, but the article is `s`
  ("his possessions", with "his" from αὐτοῦ). This is not wrong; joining it
  to "possessions" would also fit rule 3.
