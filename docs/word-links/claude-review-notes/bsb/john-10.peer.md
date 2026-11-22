# BSB John 10: independent peer review (Claude)

Checked: 42 of 42 verses (10:1-42). No verse was kept from an earlier review.
I checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher rows for John 10 in
`public/data/original-languages/bsb-word-links/john.json`, and the `partial`
counts there for every reading claim. That file compares the publisher's
Greek with N1904 by exact word form, with accents removed, so no `partial`
key means the same word forms, not just the same word count. I also compared
the reviewed precedents for a relative rendered "and" (Luke 10:42 ἥτις = "and
it", Luke 23:51 ὅς = "and"), οὐκ rendered "refused" with its verb kept
separate (Luke 9:53), same-verb tense changes (John 7:19, 7:24) and the
article rendered as the possessive "My" (John 7, Luke 11, Mark 14).
Final check: `fromtext` → `{"versesOk": 42, "problems": 0}`.

## Changes (4 verses, 6 lines)

- 10:12, link: `g 6` οὗ = "his" + `t and#0` → `g 6` οὗ = "and#0 + his"
  (note "The relative οὗ ('whose') is rendered and … his, as a new clause.").
  Why: BSB turns the relative clause into an and-clause, so "and" does the
  job of the relative and is not English-only. Luke 10:42 (ἥτις = "and it")
  and Luke 23:51 (ὅς = "and") link the relative the same way. This settles
  the author's doubt.
- 10:26, link: `g 2 3` οὐ πιστεύετε = "refuse to believe" → `g 2` οὐ =
  "refuse" (note "οὐ ('not') with πιστεύετε is rendered refuse to believe.")
  and `g 3` πιστεύετε = "to believe". Why: this puts the publisher's split
  back. It was not wrong: it follows the rule that negatives are split off
  verbs, and Luke 9:53 does the same (οὐκ = "refused", ἐδέξαντο = "to
  welcome"). Joining the two words was only a matter of taste.
- 10:29, note: `g 3` ὅ = "who". Before: "The neuter relative ὅ ('what') is
  rendered who, referring to the Father." After: "The Greek relative ὅ is
  neuter ('what He has given Me … is greater'); BSB's English renders it who,
  so the Father is the one greater than all." Why: see the 10:29 answer
  below. The old note did not say that the meaning changes.
- 10:29, note added: `g 7` μεῖζον = "greater", "μεῖζον is neuter, agreeing
  with ὅ ('what'), not with Πατήρ." Why: a reader who taps "greater" would
  otherwise not see the ὅ note.
- 10:29, reason: `t them#0` "English supplies the object of has given." →
  "English supplies an object for has given; in the Greek the neuter ὅ is
  itself what was given." Why: in the Greek, the object of δέδωκεν is ὅ, so
  the old reason was not accurate.
- 10:36, link: `g 10 12` λέγετε … Βλασφημεῖς = "accuse Me of blasphemy" →
  `g 10` λέγετε = "accuse" (note "λέγετε ('you say') with the quoted charge
  is rendered accuse.") and `g 12` Βλασφημεῖς = "Me of blasphemy" (note "The
  quoted Βλασφημεῖς ('You blaspheme') becomes indirect speech: Me of
  blasphemy."). Why: each Greek word has its own English words. "Me" is the
  second-person subject of Βλασφημεῖς ("you blaspheme") turned into the
  person accused, not part of λέγετε. The two words are not a fixed idiom,
  so rule 3 does not join them. The publisher's old row λέγετε = "accuse Me"
  had put "Me" on the wrong word.

Every other line of the author's file is kept.

## Points I was asked to settle

- **10:29 ὅ → "who"**: the author's note was honest but incomplete; the note
  now has to say that the meaning changes. John 10:29 has no `partial` key,
  so the publisher's Greek has the same word forms as N1904: neuter ὅ and
  neuter μεῖζον. (The author wrote "equal counts"; the record shows more than
  that.) In that Greek, what the Father has given is greater than all. BSB's
  English makes the Father the one who is greater. So no different reading
  may be claimed, but the note must say that BSB's English gives a different
  sense. I kept the link: the publisher's own row has ὅ = "who", and "who" is
  the relative pronoun in the same place. The notes on ὅ, μεῖζον and `t them`
  now state the neuter sense plainly and claim nothing about another Greek
  text.
- **10:29 τοῦ → "My"**: agree. The publisher's τῆς = "My" was wrong: τῆς goes
  with χειρός ("the hand"), and in "My Father's hand" the word "My" belongs
  to Father. The article of Πατρός rendered as a possessive is linked to
  "My", as in John 7, Luke 11 and Mark 14. The evidence line shows no extra
  μου, so the note on the article is right.
- **10:36 frame words**: agree with `t then#0 what about`, `t How then can`,
  `t that` and `t the#3`. None of them has a Greek counterpart: there is no
  connective and no modal, and εἶπον quotes the words directly. Both ὅτι
  tokens are right: the first (recitative) is `s`, the second = "for". The
  link is now split (see above).
- **10:19 τούτους**: agree with `s 7 9` and `t Jesus`. τούτους ("these")
  points to the words, but "Jesus’" names the speaker. That is a different
  meaning, so it is not a split pair. This is unlike a personal pronoun
  rendered "Jesus" (10:42, 7:3), where the pronoun means Jesus.
- **10:18 ἦρεν → "takes"**: agree with the link and the same-verb note. The
  record (29/28/29) shows exactly one N1904 word without a publisher match,
  and "takes" is the only English word without an owner. The verb and its
  meaning are the same; only the tense differs. John 7:19 and 7:24 link
  tense changes with the same note. The added "N1904 ἦρεν means 'took'" is
  correct, and it says nothing about the publisher's spelling.
- **ἐγώ εἰμι (10:7, 10:9, 10:11, 10:14) and 10:30**: agree: word by word, no
  notes. This matches the reviewed John 6:35 and 6:48. In 10:30 each
  English word renders exactly one Greek word (ἕν = "one", ἐσμεν = "are").
  A note would only add commentary.
- **Readings 10:7 "to them" and 10:31 "At this"**: agree. In 10:7 (16/16/17)
  and 10:31 (8/8/9), every N1904 word has a match and there is one extra
  publisher word. The `t` English is the only English without an owner. The
  reason "BSB follows a reading with an extra word here" does not name the
  word, which is right.

## Other reading claims checked

- 10:16 (26/25/26), γενήσεται = "there will be"; 10:24 (22/21/22), εἰπόν =
  "tell"; 10:40 (18/16/18), ἔμενεν = "He stayed": each is the unmatched
  N1904 word, and its English has no other owner. The same-verb notes are
  right.
- 10:40 and 10:41 (22/20/22), Ἰωάνης: the spelling notes are right. In
  10:41, both unmatched words are the two Ἰωάνης.
- 10:33 (21/21/21): only the word order differs, so no reading is claimed.
  The author is right.
- 10:13 "The man runs away" has no `partial` key, so it is `t`, as an English
  restatement, not a reading. The author is right.

## Answers to the author's doubts

- 10:19: agree with `s` + `t` (see above).
- 10:36: I made the finer split (see Changes).
- 10:18: the same-meaning link stands (see above).
- 10:29: the link stands; the notes now say that the sense changes (see
  above).
- 10:14 τὰ ἐμά = "My sheep": kept. The publisher already had ἐμά = "My
  sheep", and the author only added τά. Precedent is mixed: Luke 15:12 joins
  "The younger son", but Luke 19 uses `t servant`. Joining is not wrong.
- 10:12 `t and`: changed to a link (see above).
- 10:26 οὐ πιστεύετε: the publisher's split is back (see above).

## Still uncertain (left as the author had them)

- 10:6 τίνα ἦν ἅ = "what": this puts ἦν on "what". An alternative is `s` for
  ἦν ἅ, with τίνα = "what".
- 10:33: "any" moved from καλοῦ to ἔργου ("any + work"). This is defensible
  (English determiners go with the noun), but it is close to a change of
  taste.
- 10:40: "been" moved from βαπτίζων to ἦν ("had + been"). Joining the
  periphrastic ἦν … βαπτίζων would also work.
- 10:25 πιστεύετε (present) = "did believe" and 10:28 ἁρπάσει (future) =
  "can snatch" have no tense notes. They are acceptable, but a reader may
  wonder about them.
