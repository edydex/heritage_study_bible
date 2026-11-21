# BSB Mark 3: independent peer review (Claude)

Checked: 35 of 35 verses

Final check: `fromtext` → `{"versesOk": 35, "problems": 0}`.

Every `g`, `s` and `t` line was read against N1904 and the displayed BSB.
Textual claims were checked against the publisher's rows and word-count
statistics in `public/data/original-languages/bsb-word-links/mark.json`.

## Changes (1 verse)

- 3:6: `g 0 4 = At this` (καί + εὐθύς) → `g 0 = At this` and
  `s 4` = "BSB leaves εὐθύς ("immediately") unexpressed in this verse."
  Why: the publisher linked "At this" to καί alone and left εὐθύς without a
  row. BSB uses "At this" for a plain connective elsewhere: καί in Mark 1:26,
  12:12 and Luke 4:35 (no εὐθύς in those verses), δέ in Mark 14:63, οὖν in
  John 6:41 and τότε in Matthew 26:65. When BSB renders εὐθύς it says "At
  once", "immediately" and so on (Mark 1:12, 2:8). Joining εὐθύς claimed that
  "At this" translates "immediately", so the publisher's row was right.

Nothing else was changed. The author's corrections of publisher rows are
right. These include the `t Jesus` lines, τήν/ὁ = "a" → `s` (as in
Matthew 12:10, where "a withered" goes with ξηράν), `t to see` (as in
1 John 4:1 and 2 Corinthians 13:5), οἱ δέ = they, the wrong τῇ = "their" and
καί(18) = "Then" in 3:5, have + ready in 3:9, ὅσοι = all who, οὐ + δύναται =
cannot, τέλος ἔχει = his end has come, οὐκ … εἰς τὸν αἰῶνα = never, and
πρός = "to" being the infinitive marker in 3:31.

## Textual claims

All seven claims are in verses with a `partial` record and fit its counts:

- 3:1 `t the`: publisher 14 words, all 13 N1904 words matched, and "the" is
  the only English word with no publisher row. The extra word is τήν.
- 3:5 `t your`: 25 N1904 words, 24 matched, publisher 26. The one unmatched
  N1904 word is συνλυπούμενος (publisher συλλυπούμενος). That leaves one extra
  publisher word. τήν(16) is matched but the publisher never linked it, and
  "your" has no surviving row, so "your" rendered the extra word σου.
- 3:14: 16 against 12, all 12 matched: four extra words, οὓς καὶ ἀποστόλους
  ὠνόμασεν.
- 3:32: 23 against 19, 18 matched. Four unmatched words are καὶ αἱ ἀδελφαί
  σου. The fifth is the other σου: the publisher's one σου after ἀδελφοί could
  pair with either N1904 σου, so the generator pairs neither. There is no
  further difference, so the `s` reason is correct.
- 3:33 `t My#1` (13 against 12, all matched; the second "My" has no row) and
  3:35 `t For` (16 against 15; "For" has no row): correct.
- Same word, different form (one-for-one counts): 3:4 ἀγαθὸν ποιῆσαι, 3:5,
  3:8 ποιεῖ, 3:17 Ἰωάνην and ὄνομα, 3:25 στῆναι. They are linked normally.
- The other 25 verses have no `partial` key and make no reading claim.

## Answers to the author's doubts

- 3:6 καί + εὐθύς = "At this": **disagree**, changed (see above).
- 3:5 καί(0) = Then: **agree.** The verse-opening καί heads the main clause
  with λέγει. BSB turned the participle into its own sentence, so the
  connective stands before "He said". The publisher's καί(18) = Then was the
  wrong καί, since καί(18) is "So".
- 3:5 "your" as a reading (`t`) with τήν `s`: **agree** (see Textual claims).
  Linking τήν = your would invent a link for BSB's σου.
- 3:31 πρὸς αὐτόν = "in": **agree.** "in" is the only English word that gives
  the direction toward Him. "Him" after summon is καλοῦντες' own αὐτόν.
- 3:4 ψυχήν = life + it: **agree.** ψυχήν is the one written object of both
  infinitives in the same clause, and "it" repeats it.
- 3:4 `t Which` and 3:8 `t The`: **agree.** The Greek is a yes-or-no
  question with no interrogative word. πλῆθος πολύ has no article; Matthew
  4:25 also uses `t The`.
- 3:1 `t the` as a reading: **agree.** The counts show the publisher's Greek
  has τήν here, so "the" renders a word BSB's text has (rule 9).

## Still uncertain (left unchanged)

- 3:10 ὥστε = so + that, πολλούς = many: correct, but reviewed Mark 2:2 and
  Matthew 13:2 put the degree word with the adjective (πολλοί = "in such large
  numbers" / "Such large", ὥστε = that), as the publisher did here.
- 3:5 `t it#0` (object of stretched): defensible. The parallel Matthew 12:13
  links that "it" to χεῖρα instead (hand + it + it).
- 3:3 εἰς τὸ μέσον = "among us": "us" has no Greek pronoun. It is kept as an
  idiom unit with the author's note; `t us` would also be defensible.
