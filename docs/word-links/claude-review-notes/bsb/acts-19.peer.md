# BSB Acts 19: independent peer review (Claude)

Checked: 41 of 41 verses (19:1-41), every `g`, `s`, `t`, `m` and `x` line,
against the Greek, the BSB English, each verse's EVIDENCE line and the
publisher record in `public/data/original-languages/bsb-word-links/acts.json`.
Final check: `fromtext` → `{"versesOk": 41, "problems": 0}`; `check` gives
the same result.

Changes: 3 verses (19:34, 19:39, 19:40): two link changes and one note
softened. The other 38 verses are kept exactly as the author left them.

## Changes

- 19:40 δυνησόμεθα / ὑπάρχοντος: before ὑπάρχοντος = "we have" and
  περὶ οὗ οὐ δυνησόμεθα `s` → after ὑπάρχοντος = "have", δυνησόμεθα =
  "we" (the second "we"), περὶ οὗ οὐ `s`. The "we" of "we have" has no
  basis in ὑπάρχοντος, a genitive participle whose subject is αἰτίου
  ("cause"). The only first-person plural form in the clause is
  δυνησόμεθα ("we will be able"), and the brief puts person endings on the
  finite verb. "have" stays with ὑπάρχοντος, which is where BSB's recast
  of "there being no cause" as "we have no justification" comes from.
  BSB's English has no "will not be able". Its "be able" and the οὐ are
  folded into "have no justification to account", so δυνησόμεθα keeps
  only "we", and the note says so.
- 19:39 "beyond this": before περαιτέρω = "beyond this" → after
  περαιτέρω = "beyond", "this" `t` ("English supplies the point of
  comparison for beyond; the Greek has no demonstrative"). περαιτέρω means
  "further". A supplied demonstrative is `t` (brief; Luke 8:14, Mark 4:19),
  as the author already did for the supplied "this" in 19:5 and 19:28.
- 19:34 reading note: before "BSB's Greek text has the participle in
  another form, same meaning" → after "BSB's Greek text differs from N1904
  by one word in this verse, without changing the sense". The EVIDENCE
  (1 N1904 word unmatched, 1 publisher word not in N1904) does not show
  which word differs. In the publisher's rows "they all shouted in unison"
  sat on φωνή, and six tokens, κράζοντες among them, were TODO. So the
  review file must not name the participle; the "probably κραζόντων" stays
  only in the author note. The link ἐγένετο … κράζοντες = "shouted" is
  unchanged.

## Answers to the author's doubts and the points raised

- **19:40/41 verse division**: confirmed. The publisher record for 19:40
  counts 27 N1904 words, 21 of them matched, against 21 publisher Greek
  words, so the six unmatched words are καὶ ταῦτα εἰπὼν ἀπέλυσεν τὴν
  ἐκκλησίαν. acts.json has no 19:41 record, because N1904 has no 19:41. In
  19:40, tokens 22-26 are `m … > 19:41`. The opening καί (21) is correctly
  `s` and not moved: BSB's 19:41 has no "And", and the build's moved-word
  check requires every moved token to have a linked counterpart in the
  target verse. 19:41 links all nine English words (After, he, had, said,
  this, he, dismissed, the, assembly) with `g @19:40`, so no English word is
  left without an owner. `x sourceAbsent` is required:
  `compile-reviewed-links.py` refuses a verse number missing from N1904
  unless it carries this flag, and then accepts only foreign-reference
  groups. The accepted LSV
  `scripts/original-languages/reviewed-lsv/acts-19.json` handles 19:41 the
  same way (`sourceAbsent: true`, every group `sourceReference` 19:40). A
  test build of this file alone into a scratch folder (the real compiler,
  writing nothing in the repo) passed the moved-word check. It produced a
  19:41 entry with 5 groups, all anchored to 19:40
  (εἰπὼν/ταῦτα/ἀπέλυσεν/τὴν/ἐκκλησίαν) and `completeAccounting: true`, so
  the published file shows 19:41's words linked. "After" sits on the
  participle εἰπών, following the convention for When/As/After.
- **19:40 fold of περὶ οὗ οὐ δυνησόμεθα**: see the change above. Neither
  the author's ὑπάρχοντος = "we have" nor the alternative δυνησόμεθα =
  "we have" with ὑπάρχοντος `s` is kept. "have" does not mean "be able",
  and "we" does not come from ὑπάρχοντος. μηδενός = "no", αἰτίου =
  "justification", ἀποδοῦναι λόγον = "to account", περί = "for", ταύτης =
  "this", συστροφῆς = "commotion" and τῆς `s` are all confirmed.
- **19:6 τε = "and"**: kept. The clause ἐλάλουν τε … has no other word
  linking it to ἦλθε … ἐπ’ αὐτούς, so τε does that connecting work, and
  BSB's first "and" is its rendering. Precedents: Acts 2:37, where εἶπόν τε
  = "and asked", and the brief's note that a lone τε may carry a
  connective (Acts 9:3). The καί keeps the second "and". Leaving τε `s`
  with "and" `t` would be a split pair.
- **19:6 "his"**: `t` with the reading reason is confirmed. EVIDENCE shows
  0 N1904 words unmatched and 1 extra publisher word. "his" was the only
  English word the transferred publisher rows left uncovered, which fits
  an extra word rendered "his" in BSB's Greek. The note names no
  publisher spelling.
- **19:9 and 19:28 moved καί**: both kept, consistently with Acts 8:36,
  14:19 and 18:21. In 19:9 the series ἐσκληρύνοντο καὶ ἠπείθουν
  κακολογοῦντες has one καί. BSB folds the first two verbs into
  "stubbornly refused to believe" and has one "and", before "maligned".
  The καί of the series goes to that "and". The other "and" ("took his
  disciples and left") joins the participle ἀποστάς with no καί, so it is
  correctly `t`. In 19:28 the καί between ἀκούσαντες and γενόμενοι sits in
  a participle chain, and BSB's "and" before "began shouting" closes it,
  which is exactly the Acts 14:19 pattern.
- **19:24 γάρ = "It began with"**: kept. It is a publisher row, and BSB
  uses the phrase to open the background that γάρ introduces (rule 10).
- **19:15 δέ = "Eventually"**: kept, but this was not a publisher row. The
  draft had δέ in TODO. The publisher record for 19:15 matches only 15 of
  the 20 current English words, because the publisher table's English
  differs from the current text here. So the link is the author's own
  choice. It is supported by reviewed Acts 16:18 (δέ = "Eventually") and
  Luke 15:17 (δέ = "Finally"). The author note's list of "kept publisher
  connective renderings" should not include 19:15.
- **19:18 τε = "now"**: kept (publisher row; τε moves the story on).
- **19:36 "Since"**: kept on the genitive absolute ὄντων, with οὖν `s`.
  BSB's "Since" makes ἀναντιρρήτων … ὄντων τούτων the ground of "you
  ought", which is the job of the causal genitive absolute. οὖν links the
  whole verse back to 19:35's question, and BSB does not express that link
  separately. The publisher's οὖν = "Since" was defensible too (compare
  John 4:6), so the author's choice is not wrong and is not reversed for
  taste.
- **19:23 "a" with the noun**: kept (τάραχος = a + disturbance, οὐκ
  ὀλίγος = great), following the brief's convention that English "a" goes
  with the noun. The earlier Acts 14:28 "a long" on οὐκ ὀλίγον is the
  older pattern. 19:2's anarthrous "the Holy"/"a Holy" on Ἅγιον are left
  as publisher rows, matching Acts 8:15, 8:17 and 8:19 ("the Holy" on
  Ἅγιον).
- **19:33 συνεβίβασαν = "to explain himself"**: kept. It is BSB's own
  alignment of "prompted (him to speak)". Moving "forward" to προβαλόντων
  ("putting forward" = pushed … forward) is right. αὐτόν `s` (Alexander
  named once) and Ἀλέξανδρος = "he" are also right.
- **19:41 `x sourceAbsent`**: confirmed, as above.
- **Readings**: 19:3 Ἰωάνου and 19:4 Ἰωάνης are linked with "Same name,
  spelled differently in BSB's Greek text". In both verses the name was
  the TODO token, and "John"/"John's" was the uncovered English word,
  which fits EVIDENCE 1/1. 19:8 and 19:15 (one extra publisher word each)
  and 19:13, 19:21, 19:26 (word order only) claim nothing, as they should.
  19:34 is softened as above.

## Brief rules re-checked across the chapter

- Supplied copula, "there", object or demonstrative are `t`: 19:5 "this",
  19:8 "there", 19:13 "there were", 19:19 "them", 19:28 "this"/"is", 19:31
  "him", 19:34 "is", 19:37 "here", 19:38 "there", plus 19:39 "this" (fixed).
- Supplied names are `t` (19:3, 19:8, 19:9 Paul; 19:25 Demetrius; 19:28
  "the men"). Pronouns BSB recasts as nouns or names are linked (19:9
  αὐτῶν, 19:19 αὐτῶν, 19:25 οὕς, 19:31 αὐτῷ, 19:33 Ἀλέξανδρος).
- Person endings and jussive "let" are on the finite verb: 19:38
  ἐγκαλείτωσαν = "Let them bring charges against", and 19:40 "we" (fixed).
- No lone article carries "of the"/"to the"/"in the" or anything other than
  "the" or a possessive. All article-only groups were checked by script.
- Second renderings (Some + some, one thing + another, so + that, pushed
  + forward and the others) all have the same role and meaning.

## Still uncertain

- 19:40: δυνησόμεθα = "we" alone is a minimal link. A reader tapping "we"
  sees "we will be able", and the note explains the fold. If later
  reviewers prefer, "we" could instead be `t`, with δυνησόμεθα in the `s`
  line. That is not a split pair, since "we" does not render "be able".
- 19:33 "so he" (ἤθελεν) and "could make his defense" (ἀπολογεῖσθαι) keep
  the publisher split. "could" might sit better with ἤθελεν, but the row is
  not wrong.
- 19:12 one English "left" for both ἀπαλλάσσεσθαι and ἐκπορεύεσθαι (Luke
  21:11 precedent) is kept.
