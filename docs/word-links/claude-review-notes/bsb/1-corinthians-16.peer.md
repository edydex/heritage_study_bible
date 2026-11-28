# BSB 1 Corinthians 16: independent peer review (Claude)

Checked: 24 of 24 verses (16:1-24). There are no KEEP blocks. I checked
every `g`, `s` and `t` line against the Greek, BSB's English, the publisher
rows and the publisher record for each verse in
`public/data/original-languages/bsb-word-links/1-corinthians.json`.
Final check: `fromtext` → `{"versesOk": 24, "problems": 0}`.

## Changes

There are two changes, in 16:2 and 16:22. Every other verse in the peer
JSON is identical to the author's.

- 16:2: ὅ τι ἐάν = "a portion" and εὐοδῶται = "of his income" are now
  joined: ὅ τι ἐὰν εὐοδῶται = "a portion of his income". The new note is
  "The clause ὅ τι ἐὰν εὐοδῶται ("whatever he may prosper in") is rendered
  a portion of his income; BSB's Greek differs slightly here, with the same
  sense." Why: "a portion" does not render "whatever" on its own, and "of
  his income" does not render "he may prosper" on its own. BSB recasts the
  whole relative clause as one noun phrase, so only the whole clause matches
  the whole phrase. Luke 10:35 splits ὅ τι ἄν = "for any" from its verb, but
  there "any" really does render "whatever". "his" comes from the person
  ending of the finite εὐοδῶται.
  The reading note is now softer. The author's note said that BSB's Greek
  "writes this relative differently". The publisher record has only counts
  (20 N1904 words, 17 matched, 19 publisher words). Five N1904 words have
  no publisher row: ἑαυτῷ, ὅ, τι, τότε and λογίαι. Three of them are
  unmatched. λογίαι is almost certainly one of the three, as in 16:1. That
  the other two are ὅ τι is likely but cannot be proved, and John 14:13 has
  no `partial` record, so BSB's Greek does not always write ὅ τι
  differently. The new wording is the one used for ὅ τι ἄν in John 14:13
  and 15:16.
- 16:22: μαρὰν = "O Lord" and ἀθά = "Come" are now joined: μαρὰν ἀθά =
  "Come, O Lord". The note "BSB divides this Aramaic phrase differently and
  renders it as a prayer, Come, O Lord." is now "BSB renders this Aramaic
  phrase, written differently in BSB's Greek text, as the prayer Come, O
  Lord." Why: the phrase is a fixed Aramaic formula (rule 3). Splitting it
  word by word claims that each Greek half has its own English word, and
  that depends on which word division is right. The joined link makes no
  such claim. The old note also stated the publisher's word division as a
  fact. The record shows only that both words differ: 10 words, 8 matched,
  and the 8 matched words are exactly the other eight. "Written
  differently" is therefore all it can support.

## Answers to the author's doubts and the points to settle

- 16:22 (link or `s`/`t`): I kept a link, joined as one unit. The two
  divisions (μαρὰν ἀθά / μαράνα θά) are the same Greek letters split in
  different places. The split is an editor's choice, not a different
  wording. So BSB's "Come, O Lord" still renders the letters N1904 prints.
  The link and its note do not say which division, or which meaning ("our
  Lord has come" / "Lord, come"), is right. A strict reading of rule 9
  could still prefer `s`/`t` (see "Still uncertain").
- 16:2 ("a portion" / "of his income"): the author's split over-claims.
  The joined group is described above.
- 16:2 (κατά = "On + every", μίαν = "the first", "day" `t`, σαββάτου =
  "of#0 + week"): confirmed. κατά is the only preposition in the phrase and
  gives both the time "On" and the distributive "every". Acts 20:7 puts
  "On" on its preposition Ἐν. John 20:1 puts "on" on the dative μιᾷ only
  because no preposition is present. "day" is `t` in both of those verses.
  παρ’ ἑαυτῷ = "aside" and "it" `t` (a supplied object of the participle
  θησαυρίζων) are also confirmed.
- 16:10 (γένηται = "he#0 has + he#1 is", ἀφόβως = "nothing to fear",
  "while" `t`): confirmed. γένηται is a finite aorist subjunctive, so both
  "he"s may sit on it under the person rule. Neither "he" sits on a
  participle. BSB splits "that he may be without fear with you" into two
  clauses, so the verb is rendered twice. "nothing to fear" renders the
  α-privative adverb ἀ-φόβως ("without fear") honestly. Putting "has" on
  ἀφόβως would give a verb to an adverb. "am" in "just as I am" stands for
  "am doing", so it resumes ἐργάζεται. Reviewed files link such resumptive
  "did/do" to their verbs (Acts 3:17, John 4:12, Hebrews 11:9). It is not a
  supplied copula like "as I am" in 1 Corinthians 7:7-8.
- 16:9: confirmed. The first καί is `s`, and "for" does not mean "and", so
  there is no split pair. In the author's file "for" is not `t`; it is part
  of ἐνεργής = "for effective work". BSB recasts the adjective as a purpose
  phrase, like ἀξίως = "in a manner worthy" in 3 John 6, so I left it.
  θύρα = "a + door", the second καί = "even though" and "me#1" `t` are also
  confirmed.
- 16:12: "He" `t` is confirmed. The Greek subject of ἦν is θέλημα, whose
  owner is not stated. BSB makes Apollos the subject, so "He" is a supplied
  possessor-turned-subject with no Greek word.
- 16:4: confirmed. τοῦ joins πορεύεσθαι ("to go", Acts 10:25). κἀμέ = "for
  me + also": the crasis καί + ἐμέ gives "me … also", and "for" marks the
  English subject of the infinitive.
- 16:19-20: confirmed. "send + greetings" with "you" on ὑμᾶς matches Romans
  16:16 and Philippians 4:21. "greet + so does" on ἀσπάζεται matches the
  resumptive "do/does" on the greeting verb in Romans 16:21 and 16:23,
  Colossians 4:10, 1 Peter 5:13 and 2 Timothy 4:21. "province of" and
  "that meets" `t` match Romans 16:5. "here" `t` is an added place word.
- 16:21: confirmed. The rows match Colossians 4:18 exactly (Ὁ = "This",
  τῇ χειρί = "in + hand", ἐμῇ = "my own", "is" `t`).
- Readings: the claims in 16:1, 16:2 (λογίαι), 16:6, 16:22 and 16:24 all
  fit the counts in the record.
  - 16:1: one word is unmatched, and λογίας is the only likely candidate
    among the words without a publisher row.
  - 16:6: one word is unmatched. Of the three words without a row, δέ and
    ἐάν are stable, so it is καταμενῶ. The same-meaning "stay" link is
    right.
  - 16:24: no word is unmatched and the publisher has one extra word, so
    "Amen" `t` with the extra-word reason is right.
  - No note now names or spells the publisher's Greek.
- Brief rules, checked across the chapter:
  - No lone article carries "of the"/"to the": in 16:15 τοῖς = "the#2" and
    ἁγίοις = "of + saints"; in 16:23 τοῦ = "the" and Κυρίου = "of + Lord".
  - Supplied copulas ("is" in 16:21, "be" in 16:23 and 16:24) are `t`.
  - Supplied objects ("it" in 16:2, "me#1" in 16:9) and "He" in 16:12 are
    `t`.
  - Added adverbs ("awhile" in 16:6, "only" in 16:7, "as well" in 16:18,
    "here" in 16:20) are `t`.
  - No participle carries a person (θησαυρίζων, ἀντικείμενοι,
    συνεργοῦντι).
  - Negatives are split from their verbs (16:7, 16:22).
- 16:17 (ἐπί = "that"): I considered making "that" an added `t`. I kept
  the link, because ἐπί is the Greek word that gives the cause of the
  gladness ("glad at the coming"). BSB turns that phrase into a that-clause,
  so this is not an English-only "that". The publisher's "I am glad that"
  on χαίρω over-claimed, and the author was right to move it.

## Still uncertain

- 16:22: someone who reads rule 9 as "a different word division is a
  different reading with a different meaning" would make μαρὰν ἀθά `s` and
  "Come, O Lord" `t`. I think the shared letters make the joined link with
  a neutral note the more honest choice, but a human reviewer should decide.
- 16:2: we cannot tell for sure which two N1904 words besides λογίαι are
  unmatched. The note now says only that BSB's Greek differs slightly here.
- 16:9 "for" (part of ἐνεργής's recast, or `t`) and 16:17 "that" (on ἐπί,
  or `t`) are borderline. I left both as the author had them.
