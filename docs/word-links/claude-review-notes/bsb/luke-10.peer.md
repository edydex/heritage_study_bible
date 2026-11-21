# BSB Luke 10: independent peer review (Claude)

Checked: 42 of 42 verses (10:1-42). I checked every `g`, `s` and `t` line
against N1904, the displayed BSB, the publisher record in
`public/data/original-languages/bsb-word-links/luke.json` (its groups and
its `partial` counts) and the reviewed parallels Matthew 9:37-38, Matthew
10:10-16 and 10:40, Matthew 11:21-27, Matthew 13:16-17, Matthew 17:25,
18:12, 21:28, 22:37-42 and 26:66 (δοκεῖ), Mark 6:8-11 and Mark 12:29-31.
Final check: `fromtext` → `{"versesOk": 42, "problems": 0}`.

## Reading claims

The publisher record has a `partial` entry for 10:1, 10:7, 10:13, 10:15,
10:17, 10:19, 10:21, 10:30, 10:32, 10:33 and 10:40. I mapped the
publisher's groups onto N1904 to see which Greek and English is left
without a link:

- 10:17: all 17 N1904 words match and the publisher has 18, so one extra
  publisher word and none missing. The only English that no N1904 word can
  account for is the "two" of "seventy-two". 10:1 has the same
  "seventy-two" (and 28 publisher words against 24 matched). The author's split is right: ἑβδομήκοντα = "seventy"
  (that part is in both texts), `t two` with the reading reason. Linking
  "seventy-two" to ἑβδομήκοντα would claim the word means 72; `s` + `t` for
  the whole number would hide a correct link.
- 10:21: all 40 N1904 words match and the publisher has 41. The publisher's
  groups link "Jesus" to ἠγαλλιάσατο and have no group at all for "in", so
  the publisher's "in" sat on the extra word. `t in#0` with the reading
  reason is right, and "Jesus" is a plain `t`. Linking "in" to the N1904
  dative τῷ Πνεύματι would invent a link for a word BSB took from its own
  text.
- 10:7, 10:13, 10:15, 10:19, 10:33, 10:40: equal counts with one word
  different. In each verse the word the author notes as spelled differently
  (ἔσθοντες, Χοραζείν, Ἅιδου, ἀδικήσει, Σαμαρείτης, εἰπόν) has no publisher
  group, and no BSB English is left that would need another reading. The
  notes are worded correctly and do not state the publisher's spelling.
- 10:30 and 10:32: one N1904 name differs (Ἱερειχώ, Λευείτης) and the
  publisher has one more word. All BSB English in both verses is accounted
  for by N1904 words or ordinary `t` lines, so no reading is claimed
  (correctly).
- 10:42: no `partial` entry, so the publisher's Greek equals N1904 (ὀλίγων
  δέ ἐστιν χρεία ἢ ἑνός). No reading may be claimed here (see below).

## Changes (3 verses)

- 10:36: σοι = "do you", δοκεῖ = "think" → δοκεῖ = "do" + "think", σοι =
  "you" (note moved to δοκεῖ). The auxiliary belongs to the verb, not the
  dative pronoun. This is how the reviewed Matthew 17:25, 18:12, 21:28,
  22:42 and 26:66 link τί σοι/ὑμῖν δοκεῖ, and how the author linked μέλει
  σοι in 10:40.
- 10:36: λῃστάς = "hands of robbers" → λῃστάς = "of robbers", `t hands`
  ("English uses the idiom 'fell into the hands of'; the Greek says 'fell
  among the robbers' and has no word for hands"). λῃστάς means "robbers",
  not "hands". εἰς = "into" and τούς = "the" stay as the author linked them.
  λῃστάς now carries "of robbers" just as λῃσταῖς does in 10:30.
- 10:9: note only. ἐφ’ ὑμᾶς = "you" said "is rendered near you", but "near"
  belongs to Ἤγγικεν. Now: "is rendered you, after is near."

Every other line of the author's file is kept.

## Answers to the author's doubts

- 10:42 (ὀλίγων … ἤ `s`, "only" `t`): agreed. The publisher's rows were
  ὀλίγων = "thing", ἤ = "only", ἑνός = "one". "thing" plainly belongs to
  ἑνός ("one [thing]"). I considered keeping ἤ = "only" (as in "or
  indeed only one"), or joining ὀλίγων + ἤ = "only". I rejected both. BSB's
  English drops the whole "few things … or" contrast and keeps "only one
  thing is necessary". "only" stresses "one"; it does not translate "or" or
  "few". Linking it to ἤ would show a reader "or" for "only". Since the
  publisher's Greek is N1904 here, no reading can be claimed either. This
  is not a split pair: ὀλίγων … ἤ has no English counterpart, and "only"
  is not their rendering. The author's two notes say exactly that.
- 10:30 (καί = series "and" before "went away"): agreed, kept. The English
  "and" coordinates the series stripped–beat–went away, and the only Greek
  coordinator inside that series is the καί between the two participles.
  Writing καί `s` + "and" `t` would make a split pair. The `t` rule for
  "and" joining a participle to the main verb applies only where Greek has
  no καί.
- 10:36 (λῃστάς = "hands of robbers"): changed (above). This also does not
  mirror 10:30, where "the hands" sits on the verb, not the noun. In 10:30
  περιέπεσεν has no separate preposition, so "fell into the hands" is the
  verb's idiomatic rendering (publisher row kept, and I keep it too). In
  10:36 εἰς carries "into", so "hands" is the only English word left
  without a Greek counterpart.
- 10:1 and 10:17 ("seventy" linked, "two" `t`): agreed; see Reading claims.
- 10:21 ("in#0" as a reading): agreed; the publisher's own groups show its
  "in" was on the extra word, see Reading claims.
- 10:40 (πολλήν = "all", διακονίαν = "the preparations to be made"): agreed.
  These are free renderings of the same words, so links with notes are
  right, not `s` + `t`.

## Other points checked and kept

- 10:35: the author's swap is right. ἐγώ is the subject of ἀποδώσω ("I
  will repay") and με is the accusative subject of the infinitive in ἐν τῷ
  ἐπανέρχεσθαί με ("on my return"). The publisher had them reversed.
- ὁ δέ carrying the named subject (10:26 Jesus, 10:37 the expert in the
  law) follows the reviewed Matthew 22:37, Mark 6 and Mark 12.
- 10:2 τοῦ θερισμοῦ (τοῦ = "the", θερισμοῦ = "of" + "harvest") and 10:13,
  10:16 (article + participle joined) differ from older Matthew rows only
  where the current rules require it.

## Still uncertain

- 10:42 remains the hardest verse: BSB's English follows the sense of the
  shorter text while its Greek table matches N1904. If a later review of
  the publisher's table showed a different Greek there, the `s`/`t` reasons
  should become a reading reason.
- 10:36: τούς = "the" is kept, though the English "the" now stands before
  the supplied "hands". τούς `s` with "the hands" `t` is also possible; I
  kept the author's link because the English phrase still makes "the
  robbers" definite.
