# BSB Matthew 22: independent peer review (Claude)

Checked: 46 of 46 verses (22:1-46).

Final check: `fromtext` → `{"versesOk": 46, "problems": 0}`.

I read every `g`, `s` and `t` line against N1904 and the displayed BSB. I
checked the `#n` anchors of repeated words (the, to, and, You, his, of, with)
group by group. Textual claims were checked against the publisher-row
statistics in `bsb-word-links/matthew.json` at d05979a. Only four verses have
a different publisher Greek count or unmatched N1904 words: 22:10, 22:16,
22:21 and 22:39.

## Changes

None. The reviewed file is byte-identical to the author's.

I briefly made "You" in 22:18 ("You hypocrites") a `t` line, then reverted
it. The project convention keeps a vocative "You" linked with the vocative
noun, so ὑποκριταί = You hypocrites stays.

## Answers to the author's doubts

- 22:25 καί = "So", with "and" in "married and died" as `t`: **agree.** In
  N1904 the second καί joins ἐτελεύτησεν to ἀφῆκεν, and BSB's "So" stands
  exactly there. The "and" between married and died comes from the participle
  γήμας being turned into a finite verb. That is the same supplied
  coordinator as in 22:4, 5, 10, 13, 15, 18 and 22. The first καί stays `s`
  because BSB starts a new sentence.
- 22:3 / 22:8 "those he had invited" / "those I invited": **agree, kept.**
  The passive participle implies the king as the inviter. BSB's active clause
  restates the same participle, so "he" / "I" comes from the change of voice
  and is not new content. This matches 20:23, where "has prepared them" stays
  with ἡτοίμασται. `t he` / `t I` would also be defensible.
- 22:34 "they themselves gathered": **kept.** This is the publisher's own
  row. The publisher's Greek matches N1904 here, so no αὐτοί lies behind
  "themselves". It is either the reflexive sense of συνήχθησαν ("gathered
  themselves") or English emphasis. No other Greek word could own it, and
  keeping it on the verb does not mislead.
- 22:19 τοῦ = "used for the": **kept.** In this chapter, "of the" goes on the
  genitive article (22:28 and 22:31 τῶν = of the). "used for the" is BSB's
  wording for that same genitive "of the". Making "used for" `t` would be a
  matter of taste, not a fix.
- 22:16: **agree with all four.** οὐ … οὐδενός = no one: one English
  negative carries both Greek negatives, as with οὐδὲ … τις in 22:46.
  μέλει = seek favor: it is the only verb in BSB's paraphrase. περί = from:
  it is the preposition of the same phrase. πρόσωπον ἀνθρώπων = external
  appearance: "the face of men" is one idiom.

## Textual claims checked

- 22:39 `t And`: **correct.** The publisher's Greek has 10 words against
  N1904's 9, and all 9 match. The extra word is δέ (δευτέρα δέ).
- 22:21: the publisher's Greek has one extra word, probably αὐτῷ after
  λέγουσιν. BSB's "they answered" has no "him", so no row is affected.
- 22:16: one N1904 word is unmatched. BSB's "they said" has no publisher
  row, which points to λέγοντας; the publisher's Greek probably reads
  λέγοντες. The meaning is the same, so λέγοντας = they said is right.
- 22:7, 22:13, 22:23, 22:30, 22:32, 22:35, 22:37 and 22:44 have no
  publisher-statistics flag. The publisher's Greek matches N1904 there, so
  the author's "BSB follows N1904" statements hold. That includes ἔφη in
  22:37 and νομικός in 22:35.

## Also checked and kept

- No split pairs. In each verse with a `t and` (participle turned into a
  finite verb), any `s` καί/δέ belongs to a different clause.
- ὁ δέ = Jesus (22:37), ὁ δέ = the man (22:12), and αὐτῷ / αὐτόν / αὐτοῦ
  rendered with a name (22:15, 22:23, 22:45) follow the convention of
  Matthew 19 to 21.
- Vocatives: ὑποκριταί = You hypocrites (22:18). Ἑταῖρε, Διδάσκαλε have no
  "You".
- No note mentions Russian.

## Still uncertain

- 22:10: one N1904 word has no match in the publisher's Greek. The publisher
  rows leave νυμφών and the English "wedding hall" unlinked. That suggests
  BSB's Greek reads ὁ γάμος (the Byzantine reading). The other candidate is
  ὅσους for οὕς. I could not confirm which. Either way the English is the
  same and νυμφών = wedding hall is accurate, so no note was added.
- 22:21: BSB's opening "So" is linked to οὖν, and τότε is `s`. Taking τότε
  as "So" and leaving οὖν `s` is the alternative.
- 22:35 ἐπηρώτησεν = "with a question", 22:46 ἡμέρας = "day on" and
  22:26 ὁμοίως = "The same thing" (`t happened to`) are loose but functional.
  They are kept.
