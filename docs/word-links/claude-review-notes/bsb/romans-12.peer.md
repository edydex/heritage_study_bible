# BSB Romans 12: independent peer review (Claude)

Checked: 21 of 21 verses (12:1-21; no KEEP blocks). Started from the
author's final file, rendered with `totext --all`, and checked every line
against the Greek, the BSB English, the brief rules, the precedent chapters
and the publisher's per-verse record in
`public/data/original-languages/bsb-word-links/romans.json`.
Final check: `fromtext` → `{"versesOk": 21, "problems": 0}`.

Changes: none. Every link, `s`, `t` and note was checked and kept. The
peer JSON's verses are identical to the author's file.

## Reading claims checked against the publisher record

- 12:2: the record is `partial` with 27 source words, 26 matched, 27
  publisher Greek words (one N1904 word unmatched, one publisher word not
  in N1904). The publisher's own "Do not be conformed" group did not
  survive matching, so the differing word is the "be conformed" verb. The
  link with the note "Same verb; BSB's Greek text has another form of it
  here, with the same meaning" is supported and does not state the
  publisher's spelling.
- 12:14: `partial` with 7 of 7 N1904 words matched and 8 publisher Greek
  words, so one extra word. "you" after "persecute" is `t` with "BSB
  follows a reading with an extra word here; N1904 has no object for
  persecute." The note does not name the Greek word. Kept.
- 12:16: `partial`, but 18 of 18 Greek words match and the publisher has no
  extra Greek word; only the English counts differ. No reading is claimed,
  which is correct.
- Every other verse has no `partial` key (publisher Greek = N1904), and no
  note claims a different reading there.

## Points settled

- 12:7-8 (ἐν-phrases and "let him"): kept. Where the ἐν-phrase noun names
  the same activity, BSB's verb renders that noun (διακονίᾳ "serve",
  διδασκαλίᾳ "teach", παρακλήσει "encourage"; ἐν and the article `s`).
  Where the ἐν-phrase is the manner (ἐν ἁπλότητι "generously", ἐν σπουδῇ
  "with diligence", ἐν ἱλαρότητι "cheerfully"), the Greek leaves the
  predicate unstated and the understood predicate is the same verb.
  "give" (ὁ μεταδιδούς), "lead" (ὁ προϊστάμενος) and "do it" (ὁ ἐλεῶν) are
  therefore the verb understood again, with the same meaning and the
  predicate role the ellipsis implies. 1 Peter 4:11 (λαλεῖ = "speaks + he
  should speak") is the same pattern. For "do it", 3 John 1:13 (γράφειν =
  "to do so"), 2 John 1:12 and Philippians 1:16 link the pro-verb to the
  verb it resumes. Every "if it is" and "let him" is `t`: the εἴτε clauses
  have no verb, the participles have no person, and 12:8 has εἴτε only
  before ὁ παρακαλῶν (the author's "BSB continues the if-it-is frame" reason
  is correct).
- 12:11: "keep + fervor" on ζέοντες is kept. The participle is used as a
  command, so it carries its English command, as χαίροντες = "Be joyful"
  (12:12) and ἀποδιδόντες = "Do + repay" (12:17, 1 Peter 3:9). "keep" is not
  a frame around an adjective. "your" is not supplied: it renders the
  article τῷ used as a possessive, matching τῇ σπουδῇ = "your zeal" in the
  same verse and τοῦ νοός = "your mind" (12:2). "Do" and "let" around μὴ
  ὀκνηροί stay `t` (adjective, no verb; 1 Peter 3:8).
- 12:2: εἰς τό = "Then" kept (purpose/result marker; Romans 4:11 has εἰς τό =
  "So then", Romans 1:20 "so that"). "will be able to test and approve"
  stays on δοκιμάζειν. Philippians 1:10 has the identical Greek εἰς τὸ
  δοκιμάζειν ὑμᾶς with "may be able to test and prove" on the infinitive.
  The clause has no finite verb to take the modal, so the "modal on the
  finite verb" rule does not move it. The stricter `t` form would break
  that precedent.
- 12:5: τὸ καθ’ εἷς = "each" (idiom "individually") kept. ἀλλήλων =
  "belongs to one another" is not an over-claim: "belongs to" renders the
  genitive relation ("members of one another"), as Acts 27:1 links "who
  belonged to" to a genitive and Acts 28:7 links "belonging to" to a dative
  of possession. It is not a supplied copula and is not tied to ἐσμεν.
  ἐσμεν = "we + are" (person on the finite verb), οἱ = "who" with the first
  "are" `t` (Galatians 6:1 οἱ = "who"). Kept.
- 12:16: τὸ αὐτὸ … φρονοῦντες = "Live in harmony" (idiom; Philippians 2:2
  and 4:2 also join τὸ αὐτὸ φρονεῖν), τὰ ὑψηλὰ φρονοῦντες = "Do + be proud"
  (idiom, participle used as a command), γίνεσθε = "Do + be" (finite
  imperative), φρόνιμοι παρ’ ἑαυτοῖς = "conceited" (one expression, "wise in
  your own sight"). All kept.
- 12:20: αὐτόν = "him" in "give him a drink" (explicit object; the author
  correctly took it off πότιζε, which keeps "give + a drink"). τοῦτο = "so"
  in "in so doing" (same meaning: "in doing this"), ποιῶν = "in + doing".
  Kept.
- 12:19: "God's" `t` and τῇ `s` kept. The article gives no name, and README
  rule 7 makes a supplied name `t`. Linking the article to "God's" would
  tell a reader that "the" means "God's".
- 12:3 ἑκάστῳ = "you" (the prompt called this 12:6; it is 12:3): kept with
  its note. Both are the recipient of the giving (dative indirect object of
  ἐμέρισεν, "you" after "given"). BSB's "you" is the same individual
  addressee as "think of yourself", so the meaning has not changed.
- Imperatival participles and infinitives, 12:3 and 12:9-21: consistent.
  Participles and infinitives carry their English command (Detest, cling
  to, Outdo, keep, Be joyful, patient, persistent, Share with, Practice,
  Rejoice, weep, Live in harmony, Do + be proud, enjoy the company of, Do +
  repay, Carefully consider, live at peace, Do + avenge; 12:3 infinitive Do
  + think). Frames around verbless adjectives are `t` ("must be" 12:9,
  "Be" 12:10, "Do"/"let" 12:11).
- Brief rules: every supplied copula is `t` (12:1, 12:2, 12:5, 12:7-8,
  12:9 twice, 12:13, 12:17, 12:18, 12:19). So are supplied objects (12:3
  "of yourself" twice, 12:10 "yourselves", 12:6 "let him use it"), the
  added "and" in 12:1, the person words with no finite owner (12:3 "you"
  with δεῖ, 12:6 "We") and the reading word in 12:14. There is no added
  "there" or "that". "Carefully" (12:17) is not an added adverb:
  προνοέομαι means "give careful thought to". No preposition, copula or
  noun sits on a lone article. The articles rendered as "which" (12:1), "who"
  (12:5) and "what" (12:9) follow Galatians 6:1 and Philippians 1:10. Negatives
  are split off their verbs throughout.

## Answers to the author's doubts

1. 12:3 ἑκάστῳ = "you": keep the link (same recipient and role).
2. 12:8 "do it": keep it linked to ὁ ἐλεῶν. "give" and "lead" stay linked
   too (3 John 1:13, 2 John 1:12, Philippians 1:16, 1 Peter 4:11).
3. 12:11 "keep + fervor": keep. A participle used as a command carries its
   command verb. "Be" in 12:10 is `t` only because φιλόστοργοι is an
   adjective.
4. 12:2 "will be able": keep it in the δοκιμάζειν group (Philippians 1:10,
   same Greek).
5. 12:19 "God's": keep `t` with τῇ `s`.
6. 12:2 "to this" on τούτῳ: keep. τούτῳ is a dative demonstrative, not a
   lone article, so the lone-article rule does not apply, and the
   publisher row is not wrong (README rule 10).

## Still uncertain (kept, not changed)

- 12:4 ἐν = "with" (publisher): BSB turns "in one body … many members" into
  "one body with many members", so "with" states the same part-whole
  relation from the other side. ἐν `s` with "with" `t` would also be
  defensible. The note explains the recast.
- 12:3 εἰς τό = "with" (publisher εἰς, τό joined by the author): BSB turns
  the purpose infinitive ("so as to be sober-minded") into a manner phrase.
  It is kept as a recast, with its note.
- 12:4 ἔχομεν = "each of us has" (publisher): "each of" spreads the "we" of
  the person ending over each member. It is kept, as 1 Peter 3:8 folds "all
  of you" into πάντες.

## Coordinator adjustment at registration

- 12:4: "each of" is now `t` and ἔχομεν = "us has". The Greek verb says only
  "we have"; "each of" has no Greek word of its own (the open point above).
