# BSB Mark 13: independent peer review (Claude)

Checked: 37 of 37 verses (13:1-37), every `g`, `s` and `t` line, against
N1904, the displayed BSB, the publisher record in
`public/data/original-languages/bsb-word-links/mark.json`, and the reviewed
parallel Matthew 24.

Check after my edits: `fromtext` → `{"versesOk": 37, "problems": 0}`.

## Changes (5: 4 links, 1 note)

- **13:22** ποιήσουσιν / "perform": `s 6` + `t perform` → `g 6 = perform`
  with the note "BSB's own Greek has δώσουσιν ("they will give"); N1904's
  ποιήσουσιν ("they will do") has the same sense here." This follows refined
  rule 9 (as Mark 6:39): the English correctly renders the N1904 word.
  δέ (`s`) and "For" (`t`) stay as the author had them.
- **13:11** τὸ Πνεῦμα τὸ Ἅγιον: "the" moved from the second article (τό 29)
  to the first (τό 27); 29 is now `s`. Every reviewed "the Holy Spirit" (Mark
  3:29, Ephesians 4:30, Hebrews 3:7, 10:15) gives "the" to the first article.
- **13:14** τὸ βδέλυγμα τῆς ἐρημώσεως: τῆς = "of" + ἐρημώσεως = "desolation"
  → τῆς `s`, ἐρημώσεως = "of desolation". Greek and English are identical to
  Matthew 24:15, which links it this way. I changed it only to keep the
  parallel the same.
- **13:36** ἐλθών = "he may arrive", εὕρῃ = "find" → ἐλθών = "arrive",
  εὕρῃ = "he may + find", with a note. "may" comes from the subjunctive after
  μή ("lest he find"), and "he" from the finite verb, as in Matthew 2:23. The
  participle had claimed both (rule 2).
- **13:1** note only. The old note called ἐκπορευομένου αὐτοῦ ἐκ the genitive
  absolute, but ἐκ is not part of it and αὐτοῦ is linked to "Jesus". New
  note: "The genitive-absolute participle ἐκπορευομένου with ἐκ, "going out
  of", is rendered As … was leaving."

## Publisher record checks

- **13:2** "here": N1904 has 20 words, all 20 matched; the publisher has 21.
  The one extra word is ὧδε, so `t here` with the reading note is right.
  Matthew 24:2 links "here" only because N1904 has ὧδε there.
- **13:22**: 2 of 17 N1904 words are unmatched, and the publisher has 17.
  This fits δέ→γάρ and ποιήσουσιν→δώσουσιν. The publisher's "For" and
  "perform" rows are the two that did not transfer. The counts do not
  contradict the call: δέ cannot mean "for", so `s δέ` / `t For` stays.
  The two English words that differ are in "that would" (publisher English
  wording), not in the Greek.
- **13:31** "never": all 12 N1904 words are matched; the publisher has 13
  (the added μή of οὐ μή). οὐ = "never" with the reading note is correct.
  "will never pass away" still renders N1904's negated future.
- **13:3**: the one unmatched word is the spelling Ἰωάνης/Ἰωάννης.
- **13:15**: the publisher has one extra word, all N1904 words matched
  (probably δέ). BSB does not render it, so nothing is claimed.
- **13:19**: the Greek is identical (24/24/24). The one difference is in the
  English (the publisher row for "unmatched" did not transfer), not a
  different reading. The author's wording "counted difference is not
  rendered" fits 13:15 but not 13:19; the file itself claims nothing, so no
  change.

## Answers to the author's doubts

- **13:22**: resolved as above. ποιήσουσιν is linked with a note; δέ/"For"
  remain `s`/`t`.
- **13:6** "I am He": agree on `t He`. Ἐγώ εἰμι has no predicate, and the
  parallel Matthew 24:5 has an explicit ὁ Χριστός there instead.
- **13:11** one ὑμᾶς → both "you"s: agree. The single object serves ἄγωσιν and
  παραδιδόντες. Linking both is clearer than `t you#1`.
- **13:15** καταβάτω … εἰσελθάτω = "Let + go back inside": agree. BSB folds
  "come down … go in" into one action, and the note says so. Linking only
  εἰσελθάτω would leave καταβάτω unexplained. μὴ … μηδέ = "no" goes with it.
- **13:29** ὑμεῖς = "you": agree. Mark's BSB has no "you" with "know".
  Rule 4 favours linking the explicit pronoun to the one English "you", which
  is the same people.
- **13:9** Βλέπετε … ἑαυτούς = "be on your guard", ὑμεῖς `s`: agree. It is the
  idiom "watch yourselves". 13:23 also has ὑμεῖς `s`.
- **13:14** δεῖ = "it should", `t be`: agree. Matthew 26:54 has δεῖ = "it
  must"; "be" stands for the understood infinitive.

## Checked without change

All Matthew 24 parallels match: 13:2/24:2, 13:4/24:3, 13:5/24:4,
13:7/24:6, 13:8/24:7-8, 13:13/24:9,13, 13:14b/24:16, 13:16/24:18, 13:17/24:19,
13:18/24:20, 13:19/24:21, 13:20/24:22, 13:21/24:23, 13:23/24:25, 13:24-25/24:29,
13:28/24:32, 13:30/24:34, 13:31/24:35. 13:22 `t even` is correct: N1904 Mark
has no καί before τοὺς ἐκλεκτούς, unlike Matthew 24:24. The other author fixes
are correct: 13:2 `t all`, 13:12 `t his`/`t their`, 13:21 the second Ἴδε `s`,
13:33 `t and`, and 13:7 `t is`.

## Still uncertain

- 13:15: someone could instead link only εἰσελθάτω ("go back inside") and
  leave καταβάτω as `s`. I kept the author's joined link.
- 13:14: the "it" of "where it should not be" refers to the abomination,
  but it is folded into δεῖ because of the Matthew 26:54 precedent.
- Within the chapter, articles are linked to "of" in 13:1 (τῶν) and 13:35
  (τῆς), but 13:14 now follows the Matthew 24:15 parallel. Both styles occur
  in reviewed files.
