# BSB 1 Corinthians 7: independent peer review (Claude)

Checked: 40 of 40 verses (7:1-40). No KEEP blocks in this chapter. Every
`g`, `s` and `t` line was checked against the Greek, BSB's English and the
publisher record for each verse in
`public/data/original-languages/bsb-word-links/1-corinthians.json`. Final
check: `fromtext` → `{"versesOk": 40, "problems": 0}`.

## Changes

Links changed in 3 verses; `s` reasons reworded in 3 more.

- 7:9: οὐκ = "cannot" and ἐγκρατεύονται = "they + control themselves" →
  joined οὐκ ἐγκρατεύονται = "they cannot control themselves", with the note
  "οὐκ ἐγκρατεύονται ("they do not exercise self-control") is rendered they
  cannot control themselves." "cannot" is one English word made of a modal
  and a negative. The Greek has no δύναμαι, so the "can" has no Greek owner.
  Putting it on οὐκ hangs a modal on the negative instead of the finite
  verb. The reviewed files join the negative and the verb when BSB says
  "cannot" with no ability verb: 1 John 5:18 (οὐχ ἅπτεται = "cannot touch"),
  2 Timothy 2:9 (οὐ δέδεται = "cannot be chained") and John 12:40 (μὴ ἴδωσιν
  = "they cannot see"). This was the author's own alternative.
- 7:10: ἀνδρός = "her husband" → "husband"; `t her` ("English supplies the
  possessive; ἀνδρός has no article or pronoun").
- 7:11: γυναῖκα = "his wife" → "wife"; `t his` ("English supplies the
  possessive; γυναῖκα has no article or pronoun"). In 7:10-11 both nouns
  have no article and no pronoun. In this chapter "his"/"her" otherwise
  always has a Greek owner: a possessive article (7:3, 7:11 τῷ, 7:14, 7:33,
  7:34, 7:39 ὁ) or a pronoun (7:36 αὐτοῦ, 7:39 αὐτῆς). The reviewed
  Mark 10:2 has the same wording, ἀνδρὶ γυναῖκα ἀπολῦσαι ("to divorce his
  wife"). There γυναῖκα = "wife" and the possessive is `t` ("English
  supplies the possessive; γυναῖκα has no pronoun"). Romans 7:2-3 likewise
  give "her husband" a Greek owner only through the article.
- 7:27 (`s 7`), 7:36 (`s 13 15`), 7:37 (`s 25`): the reasons said "BSB
  renders X with Y, words of different meaning". That contradicts the `s`,
  because the token is deliberately left unlinked. They now read "BSB has
  no word for γυναικός ("a wife") here; its commitment has a different
  meaning", and the same pattern for οὕτως … γίνεσθαι / "to marry" and τηρεῖν
  / "not to marry". The links and the `t` lines are unchanged.

Every other verse in the peer JSON is identical to the author's.

## Points settled

- Different meanings kept apart (all three confirmed `s` + `t`):
  - 7:27 γυναικός / "commitment". BSB's "free of commitment" names the
    marriage bond, which δέδεσαι ("committed") already expressed, and avoids
    "released from a wife". "commitment" does not mean "wife". Linked, it
    would tell a reader that γυνή means commitment. ἀπό = "of" stays linked.
  - 7:36 οὕτως … γίνεσθαι / "to marry". γίνεσθαι ("to happen, be done") is
    in the slot of "to marry", but BSB supplies the content of what should
    happen. That is not a shifted sense of γίνομαι.
  - 7:37 τηρεῖν / "not to marry". "Keep [his virgin]" and "not to marry" are
    equivalent only by interpretation. The English negative has no Greek
    owner at all.
- 7:1 γυναικὸς μὴ ἅπτεσθαι = "to abstain from sexual relations": confirmed
  as an idiom unit. "Touch a woman" is the euphemism, and "abstain" contains
  the μή, so no word can be split off. ἀνθρώπῳ `s` is correct (BSB has no
  "for a man"). περί = "for" (topic marker "Now for") is kept. The stranded
  "about" stays with ἐγράψατε.
- 7:17 ἑκάστῳ = "each one + to him": confirmed. The structure is that of
  the reviewed Romans 4:9 (τῷ Ἀβραάμ = "Abraham's + to him"). "to him" is
  the dative's own role and referent, the recipient of "assigned". "each
  one" is the word's lexical content, moved to the slot of the subject of
  περιπατείτω, and the fronted ἑκάστῳ/ἕκαστον are that verb's logical
  subject. There is no other Greek owner for "each one" (ἕκαστον already
  has "him#1"). Making "to him" `t` would leave a recipient that the Greek
  word really supplies without a link. The reading note on μεμέρικεν is
  sound: the publisher record has 20 of 21 words matched, and its own rows
  leave μεμέρικεν and "has assigned to him" unlinked.
- 7:24: confirmed. "God" on Θεῷ, παρά `s`, ἐν ᾧ = the closing "in",
  τούτῳ = "the situation". Θεῷ is the only God-word in the verse and "God"
  is BSB's only word for it. It is the same word and referent, with its
  role shifted, and the note says so. The alternative (God `t`, Θεῷ `s`)
  would make a split pair. The publisher had put "God" on ἐκλήθη, which
  folded a noun into the verb. ἐν τούτῳ is the actual complement of
  μενέτω, so "in#0 the situation" belongs to it, and the demonstrative
  carries the antecedent noun. ἐν ᾧ is the relative "in which", and BSB's
  "he was in" keeps only the stranded "in". This matches 7:20 (ᾗ = "in#1",
  "he was" `t`). The notes describe what BSB's English does and are honest.
- 7:28 καί `s` with "you#0 do marry" on γαμήσῃς: kept. The reviewed
  1 Corinthians 4:7 has the same construction (εἰ δὲ καὶ ἔλαβες = "if you
  did receive it"). There ἔλαβες = "you did + receive" and καί is `s`
  ("BSB leaves καί ("indeed") untranslated").
- 7:37 ἔχων = "under", ἔχει = "with": kept. Each stands in its verb's own
  slot ("under no constraint" = "not having constraint"; "with control
  over" = "having authority over"). These are shifted renderings of
  "having", and the notes say so. Unlinking them would make split pairs.
- 7:3 "marital duty" on ὀφειλήν: kept. BDAG gives the sense "conjugal duty"
  for ὀφειλή in this verse, so it is within the word, as "sexual
  immorality" is for πορνεία in 7:2.
- Readings: confirmed against the publisher record. 7:9 has 10 of 11 words
  matched, and the publisher leaves γαμεῖν unlinked. 7:17 has 20 of 21
  words matched, and the publisher leaves μεμέρικεν unlinked. Both are
  linked with "another form of the same verb" notes. 7:13 has 15 of 16
  N1904 words matched and 17 publisher words; the publisher leaves ἥτις,
  "if" and "a" unlinked. ἥτις is `s` and "if" is `t`: "if" does not render a
  relative pronoun. No note names or spells the publisher's Greek.
- Paul's first person: confirmed. "I" sits on the finite verbs (λέγω,
  θέλω, παραγγέλλω, διατάσσομαι, ἔχω, δίδωμι, νομίζω, φημι, δοκῶ) and on the
  explicit ἐγώ/κἀγώ/ἐμαυτόν (7:7, 7:8, 7:10, 7:12, 7:28, 7:40). Person words
  on participles and infinitives are `t`: 7:22 he#1/he#3, 7:29 they, 7:30
  they ×3, 7:36 he#0. 7:36 "they#0" with the impersonal ὀφείλει is `t`.
  7:39 "he#1" (ἐν Κυρίῳ has no verb) is `t`.
- Brief rules: rechecked across the chapter. Supplied copulas are all `t`:
  7:1, 7:7, 7:8, 7:17, 7:18, 7:19, 7:20, 7:21, 7:22, 7:24, 7:26, 7:29, 7:40.
  Added "that", "already", "still" and "even" are `t`. Supplied objects and
  complements are `t`: "this" in 7:8, 7:10, 7:12 and 7:28; "them" in 7:31;
  "her" in 7:38; "unmarried" in 7:8; "to live" in 7:15; "promote" in 7:35.
  No "of the"/"to the" sits on a lone article. Substantival τά = "the
  work"/"the affairs" follows the reviewed 1 Corinthians 2:11 (τά = "the
  thoughts"). Article = "this" follows Romans 7:3. Connectives rendered
  with another connective are linked: καί = "Then"/"or"/"but", ὁμοίως =
  "Conversely", ἵνα = "how" in 7:34. In 7:10-11 "must" on the infinitives
  of indirect command is the directive modal, as in 1 Thessalonians 4:3
  (ἀπέχεσθαι = "must abstain") and Acts 21:25.

## Answers to the author's doubts

- 7:17 double link: keep (see above).
- 7:9 οὐκ = "cannot": changed to the joined unit (see Changes).
- 7:28 emphatic "do": keep on the verb, with καί `s` (1 Corinthians 4:7).
- 7:37 ἔχων/ἔχει as prepositions: keep. τηρεῖν / "not to marry": keep
  `s` + `t`. It is not a same-meaning recast.
- 7:10, 7:11 "her husband"/"his wife": the possessive is now `t` (see
  Changes).
- 7:3 "marital duty": keep.

## Still uncertain

- 7:1 περί = "for" versus "about". Both English words relate to περὶ ὧν.
  The topic-marker reading is kept, and "about" stays with ἐγράψατε.
- 7:39 "is bound to" on δέδεται. The "to" introduces "her husband", which
  BSB moved from the subject of ζῇ. It could be argued as a supplied `t`.
  It was kept with the verb as part of "bound to".
- 7:21 "your freedom" (ἐλεύθερος) and 7:36 "beyond her youth" (ὑπέρακμος)
  keep their possessive inside the recast of an adjective into a noun
  phrase, as Titus 2:4 does (φιλάνδρους εἶναι = "to love their husbands").
  This is unlike the plain supplied determiners of 7:10-11.
