# BSB Romans 10: independent peer review (Claude)

Checked: 21 of 21 verses (10:1-21; no KEEP blocks). Started from the
author's final file, rendered with `totext --all`, and checked every line
against the Greek, the BSB English, the brief rules and the publisher's
per-verse record in `public/data/original-languages/bsb-word-links/romans.json`.
Final check: `fromtext` → `{"versesOk": 21, "problems": 0}`.

Changes: 2 verses (2 link changes). All other author decisions are kept.

## Changes

- 10:5: δικαιοσύνην "concerning + righteousness" → "righteousness";
  "concerning" `t` ("BSB follows a reading in which Moses writes concerning
  this righteousness; in this Greek text τὴν δικαιοσύνην is the object of
  ποιήσας ('who does')"). In N1904 (ὅτι before the phrase, no object
  pronoun) the sentence is "the man who does the righteousness that is from
  the law will live by it": the accusative is the object of the participle,
  and αὐτῇ refers back to it. BSB's "concerning" exists only because its
  reading makes the phrase the topic of "writes" and gives "does" its own
  object ("these things"). The noun is still rendered "righteousness", so
  that link stays; the relation word has no owner in this Greek text.
  The record (sourceWords 15, matched 15, publisherGreekWords 18) shows
  extra publisher words in exactly this verse, so a reading reason is
  allowed. The reason describes BSB's reading, not the publisher's words.
- 10:12: Κύριος "Lord#0 + Lord#1" → "Lord#0" only; "is#1 Lord#1" `t`
  ("English supplies the copula and repeats Lord as the predicate; the
  Greek clause ὁ αὐτὸς Κύριος πάντων has no verb"). A second English
  rendering may share a Greek word only in the same role; here the two
  "Lord" words are subject and predicate. Κύριος stands in the attributive
  pattern article + αὐτός + noun, "the same Lord" (as ὁ αὐτὸς κύριος in
  1 Corinthians 12:5), so it renders the subject. πάντων keeps "of all";
  the publisher row also had Κύριος on the first "Lord".

## Answers to the author's doubts

- 10:5: changed, see above. "concerning" is `t`, not part of the noun.
  "these things" `t` with the reading reason and "them" on αὐτῇ with its
  note are kept: αὐτῇ fills the same slot (object of ἐν, "by it"), and the
  note says why BSB's pronoun is plural.
- 10:12: changed, see above. Lord#0 = Κύριος; Lord#1 is `t` with "is".
- 10:10: agreed. εἰς ("unto") is `s` and both "and" words are `t`: "and"
  does not mean εἰς. δικαιοσύνην = "are justified" and σωτηρίαν = "are
  saved" keep the theological nouns linked, each with a note that BSB turns
  the noun into a verb; "are" is the English passive auxiliary of that
  verb, not a supplied copula. "you" is `t` on both impersonal passives,
  per the rule that an impersonal verb carries no supplied person. No
  English is over-claimed.
- 10:14: agreed. εἰς = "in#0" (πιστεύω εἰς); ὅν = "the One … whom" and
  οὗ = "the One of whom" (headless relatives, as Acts 13:37, John 10:36);
  "call on" with ἐπικαλέσωνται (Acts 9:14). "in#1" on πιστεύσωσιν is right:
  the second clause has no Greek preposition, and οὗ is the genitive object
  of ἤκουσαν ("of whom"), so "in" belongs to English "believe in".
- 10:18: agreed. "they did" stays `t`. The rule for words understood again
  covers a repeated content word; "did" is a pro-verb in a short answer,
  not a repeat of "hear", and μενοῦνγε keeps "Indeed".

## Points checked and settled

- 10:12: τε `s` (BSB has no "both"); "between Jew" on the genitive
  Ἰουδαίου with its note; existential "there is" stays on ἐστιν (brief
  convention; Romans 3:10, 3:22). "and#1" before "gives richly" is `t`
  (participle, no καί).
- 10:3: τῇ `s`, "to + righteousness" on δικαιοσύνῃ (no preposition on a
  lone article); "of" belongs to "were ignorant of" on ἀγνοοῦντες, since
  the genitive Θεοῦ is already "God's"; "they#0" `t` for the participle.
- 10:19: "did + understand" on ἔγνω (the finite verb), "Israel" alone on
  Ἰσραήλ. ἀλλά = "instead" with its note kept.
- 10:11: γάρ = "just as" kept with its note; "It is" `t`. Reviewed
  chapters link γάρ to BSB's shifted connective in the same role (Romans
  5:7 "though", 9:11 "Yet", Mark 16:4 "even though").
- 10:2: ἔχουσιν = "they are" with its note (ζῆλον ἔχουσιν, "they have
  zeal" → "they are zealous") kept; the finite verb keeps the person.
- Readings: 10:15 record (sourceWords 15, matched 14, publisherGreekWords
  16) fits one N1904 word replaced and one added. As = καθάπερ with the
  same-meaning note used in Romans 3:4 is right, and nothing is claimed for
  the extra word. 10:3 and 10:20 (one extra publisher word each, nothing
  unmatched): BSB prints no English for an extra word (10:3), and in 10:20
  "by" is carried by the dative article + participle, so no reading claim
  is needed. No note in the file names or spells the publisher's Greek.
- Old Testament quotations spot-checked word by word: 10:5 (Leviticus
  18:5), 10:6-8 (Deuteronomy 30:12-14), 10:11 (Isaiah 28:16), 10:13 (Joel
  2:32), 10:15 (Isaiah 52:7), 10:16 (Isaiah 53:1), 10:18 (Psalm 19:4),
  10:19 (Deuteronomy 32:21), 10:20-21 (Isaiah 65:1-2). Negatives are split
  off verbs, supplied copulas ("is", "are", "it is") are `t`, article +
  participle units are joined, and "of the"/"to the" never sits on a lone
  article (10:18 "of + world", 10:13 "of the Lord" on the anarthrous noun).

## Still uncertain

- 10:12: Κύριος can also be read as the predicate ("the same one is Lord of
  all"), which would put it on Lord#1 with Lord#0 `t`. I chose the subject
  because of the attributive pattern ὁ αὐτὸς κύριος; either way only one
  "Lord" may carry it.
- 10:15: τῶν εὐαγγελιζομένων ἀγαθά joined as "of those who bring good
  news" is kept. ἀγαθά `s` with "good news" on the verb alone would also be
  defensible; the join does not over-claim, because "good news" renders the
  verb and its object together.
