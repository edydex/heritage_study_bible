# BSB John 9: independent peer review (Claude)

Checked: 41 of 41 verses (9:1-41), including 9:18, which the author kept
unchanged from the earlier Codex review. I checked every `g`, `s` and `t`
line against N1904, the displayed BSB, the publisher rows for John 9 in
`public/data/original-languages/bsb-word-links/john.json`, and the
`partial` counts there for each reading claim. I also compared the reviewed
precedents for a predicate noun with "as" (Mark 10:45, Matthew 20:28
λύτρον = "as a ransom"), "already" with no ἤδη (Luke 19:25), "but" joining
a participle clause, and ἀλλά after Οὐχί (Luke 1:60).
Final check: `fromtext` → `{"versesOk": 41, "problems": 0}`.

## Changes (6 verses)

- 9:18 (Codex KEEP), links: `s 5 6` περὶ αὐτοῦ + `t the man` → `g 6`
  αὐτοῦ = "the man" (note "αὐτοῦ ('him') is rendered the man.") and `s 5`
  περί ("about … BSB makes the man the subject of the that-clause"). Why:
  this was a split pair. The old reason itself said BSB "recasts its
  pronoun" as "the man". The author links a pronoun to "the man" the same
  way in 9:6, 9:13 and 9:35.
- 9:18 (Codex KEEP), links: `g 17 18 19` αὐτοῦ τοῦ ἀναβλέψαντος = "his#1"
  → `g 17` αὐτοῦ = "his#1" and `s 18 19` ("BSB does not render τοῦ
  ἀναβλέψαντος ('of the one who had received his sight') after his
  parents"). Why: "his" does not mean "the one who had received his
  sight". The brief does not allow several Greek content words on one
  English word that does not mean them.
- 9:18 (Codex KEEP), notes only: the long, technical reasons on ἀνέβλεψεν,
  οὖν, τούς and `t still` are now one plain sentence each (one mentioned
  "publisher vvv cells"). `s 2` οὖν and `t still` keep their status:
  "still" (even so) does not mean "so/therefore", so it is not a split pair.
- 9:22: `t as the` → `g 19` Χριστόν = "as + Christ" (note "Χριστόν is the
  predicate of confessed; English marks it with as.") and `t the#2`
  ("English supplies an article before Christ; Χριστόν has none."). Why:
  "as" marks the predicate role of the second accusative. The reviewed Mark
  10:45 and Matthew 20:28 link "as a ransom" to λύτρον the same way, and the
  publisher's row had "as" on Χριστόν. Only the supplied "the" is English-only,
  as in 9:5, 9:14 and 9:32.
- 9:6, note only: applied "BSB's Greek text has a different verb of similar
  meaning here." → "BSB's Greek text differs at this word; applied also
  fits N1904's ἐπέθηκεν ('put on')." Why: the counts (18/17/18) show only
  that one word differs. They do not show that it is a different verb.
- 9:16, note only: `t But` "BSB follows a reading with an extra connective
  here." → "BSB's But follows a reading with an extra word here; N1904 has
  no connective before others." Why: the record (32/32/33) shows an extra
  word, not what kind of word it is.
- 9:9, notes only: `s 8` ἀλλά "is not rendered separately" → "has no
  English word; BSB states the correction directly", and `t just` "for
  emphasis" → "English adds just ('merely'); the Greek says only ὅμοιος αὐτῷ
  ἐστιν ('he is like him')". Why: "separately" suggested ἀλλά was rendered
  together with another word. "just" means "merely", not emphasis.
- 9:37, note only: `t already` now says that the Greek has only the perfect
  ἑώρακας ("you have seen").

Every other line of the author's file is kept.

## Reading claims checked against the record

Only 9:2, 9:6, 9:16, 9:26, 9:28 and 9:40 have a `partial` record. No other
verse claims a reading.

- 9:2 (18/17/18): Ῥαββεί has no publisher row and "Rabbi" has no publisher
  owner. The spelling note is right.
- 9:6 (18/17/18): ἐπέθηκεν has no publisher row and "applied" has no owner.
  "applied" renders N1904's "put on" as well, so the link is right under
  rule 9 (same meaning). Note softened (see above).
- 9:16 (32/32/33): one extra publisher word. Every N1904 word has a row, and
  "But" is the only English without an owner. `t But` with the reading
  reason is right.
- 9:26, 9:28, 9:40 (11/10/11, 15/14/15, 17/16/17): in each, εἶπαν has no
  publisher row, and its English ("they asked", "said", "they asked") has no
  owner. The same-meaning link with "a different form of this verb" is
  right and matches the wording earlier peers accepted.

## Points I was asked to settle, and the author's doubts

- 9:31: **agree** with τούτου = "the one", ἐάν τις = "who", θεοσεβὴς ᾖ =
  "worships Him". τούτου ("this one") is the head of the English phrase "the
  one who …", and ἐάν τις ("if anyone") is what becomes the relative
  "who" (as ἐάν τις = "anyone who" in 9:22). The publisher's τούτου = "the"
  put a demonstrative pronoun on an English article and split "the one".
  θεοσεβής ("God-fearing", from θεός + σέβομαι "worship") with ᾖ ("is") is
  rendered "worships Him"; "Him" is the θεο- part.
- 9:9: **agree** with ἀλλά `s` and "just" `t`. "just" means "merely";
  ἀλλά means "but rather". BSB moves the correction into "No … just looks
  like". "just" does not translate ἀλλά, so this is not a split pair. Luke
  1:60 (Οὐχί, ἀλλά) also leaves ἀλλά `s`. Only the two reasons were
  reworded.
- 9:37: **agree** with "already" `t` and καί … καί `s`. The perfect ἑώρακας
  is fully rendered by "You have + seen". "already" is BSB's emphasis, as in
  Luke 19:25 (`t already`). Neither καί means "already": the pair means
  "both … and", and BSB makes two sentences. The note now names the perfect.
- 9:35: **agree** with καί = "When". BSB turns "Jesus heard …, and having
  found him he said" into a When-clause. By the convention, "When" goes on
  the καί between the clauses, not on Ἰησοῦς. The English "and" between
  "found the man" and "said" joins the participle εὑρών to the main verb,
  so `t and` is right.
- 9:20: **agree** with Οἴδαμεν = "We know + we know". The second ὅτι clause
  depends on the same Οἴδαμεν, and BSB repeats the verb. The convention
  lets an understood verb link to each English repeat. The publisher's
  ὅτι = "we know" was wrong.
- 9:41: agree with εἴχετε = "be guilty of" and ἁμαρτίαν = "sin". Keeping
  "sin" on ἁμαρτίαν shows the noun that means sin.
- 9:33: agree with οὐκ … οὐδέν = "no such thing". "no such thing" is one
  English idiom for "nothing"; splitting off "such" would leave "no … thing".
- 9:13: agree with ποτε = "had been". The English has no other word that
  says "formerly"; `s` + `t` would be a split pair. 9:24 has ἦν = "had been".
- 9:32: agree with ὅτι `s` and "of" in "heard of". "of" is needed by the
  English verb "hear of" before the -ing form; it does not mean "that".
  τις = "anyone" (same word, a different role) is also right, with its note.
- 9:16: agree with οὖν = "Because of this" (the publisher's row). It is a
  strong but fair rendering of inferential οὖν ("so, therefore").

## Still uncertain

- 9:22: `t as the` (the author's choice) was not wrong. I changed it because
  of the "as a ransom" precedent and the publisher's row. A reviewer who
  treats "as" as English-only could go back.
- 9:13: αὐτόν = "the man" and τόν = "who" (the publisher's rows) are kept.
  τόν = "the" with αὐτόν `s` would also be possible.
- 9:25: "but" in "I was blind, but now I see" stays `t`. Earlier chapters
  treat "but" joining a participle clause the same way. One could argue that
  the concessive sense belongs to the participle ὤν.
