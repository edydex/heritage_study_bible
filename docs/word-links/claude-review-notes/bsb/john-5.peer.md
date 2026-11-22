# BSB John 5: independent peer review (Claude)

Checked: 47 of 47 verses (5:1-47, including 5:4, which has no BSB verse).
I checked every `g`, `s`, `t` and `x` line against N1904, the BSB English,
the publisher rows in the draft, and the publisher record in
`public/data/original-languages/bsb-word-links/john.json` (its `partial`
counts, its group spans and its `unavailable` entry). I also compared
reviewed precedents (Mark 6:35, 12:29 and 16:99, Luke 13:23 and 19:35, and
the "extra word … N1904 has only the article" notes).
Final check: `fromtext` → `{"versesOk": 47, "problems": 0}`.

## Changes

Two verses changed. Everything else is kept as the author left it.

- 5:5: ἀσθενείᾳ = "an invalid" with ἐν τῇ … αὐτοῦ `s` ("BSB renders ἐν τῇ
  ἀσθενείᾳ αὐτοῦ ("in his illness") as the noun an invalid.") →
  ἐν τῇ ἀσθενείᾳ αὐτοῦ = "an invalid", with the note "ἐν τῇ ἀσθενείᾳ αὐτοῦ
  "in his illness" is rendered as the noun an invalid." Why: the `s` reason
  itself said these words are rendered by "an invalid", which makes it a
  split pair. The author joins whole prepositional phrases in the same way
  elsewhere in this chapter: ἐν τῷ τόπῳ = "there" (5:13) and παρὰ ἀνθρώπου
  = "human" (5:34).
- 5:9: Ἦν = "this happened" → Ἦν = "happened" (note: "BSB recasts Ἦν "(it)
  was" as happened."), plus `t this` ("English supplies a subject referring
  to the healing; the Greek says "it was Sabbath on that day"."). Why: in
  Ἦν δὲ σάββατον the clause is about the day being a Sabbath. BSB's "this"
  points to the healing, which the Greek does not mention here. So "this"
  is English-only, as the conventions say, and is not a subject built into
  Ἦν. Reviewed precedent treats a supplied subject the same way
  (`t This`, Mark 6:35, "the place is desolate"). 5:10 is different and
  stays: in Σάββατόν ἐστιν "This" stands for the impersonal subject of
  ἐστιν (today), so ἐστιν = "This is" is all right.

## Points to settle

- 5:4 `x targetAbsent`, all 27 tokens `s`: correct. The publisher file lists
  5:4 under `unavailable` as `greek-edition-differs`, and BSB's English has
  no 5:4. The reason ("BSB has no verse 5:4; it follows a reading without
  this account of an angel stirring the water.") is factual. It names no
  word of BSB's Greek and claims nothing beyond the missing verse. It matches
  the Mark 16:99 precedent. Kept.
- 5:3 tokens 9-13 `s`: the counts agree. The record is 14 N1904 words, 9
  matched, 9 publisher Greek words. The publisher's group spans cover
  exactly tokens 0-8 (ἐν … ξηρῶν). So the five unmatched words are
  ἐκδεχομένων τὴν τοῦ ὕδατος κίνησιν, and BSB's Greek adds nothing. The
  quoted gloss is an English rendering of N1904, not BSB's Greek. Kept.
- 5:16 τὸν Ἰησοῦν: Ἰησοῦν = "Him", with the earlier "Jesus" `t`. Kept.
  "Him" fills the role of τὸν Ἰησοῦν, the object of "persecute". "Jesus" is
  the subject of "was doing", which the Greek gives only in the ending of
  ἐποίει (rule 7). This is also the publisher's own row. Reviewed
  precedent does the same where BSB moves a name ("τὸν πῶλον … is rendered
  it, since English names the colt earlier", Luke 19:35; John 3:26
  Ἰωάνην = "him").
- 5:32: ἣν μαρτυρεῖ = "His", ἡ `s`. Kept. "His testimony" compresses "the
  testimony which he testifies". "His" stands for the subject of μαρτυρεῖ.
  The article is only "the", which "His" replaces. If "His" sat on ἡ (the
  publisher's row), a finite verb would be left `s`, and the
  article-as-possessive convention does not fit: the article has no
  possessive sense here.
- 5:5: ἦν … ἔχων = "had been". Kept. BSB drops the existential "there was"
  and makes "had been" the only finite verb. ἦν gives the past time and
  ἔχων with the time phrase gives "had been … for". Leaving ἦν `s` would
  also work, but the join is not wrong. (For ἐν τῇ ἀσθενείᾳ αὐτοῦ, see
  Changes.)
- Double-negative and negative joins: all right. οὐ … οὐδέν = "nothing"
  (5:19, 5:30) and οὐδέ … οὐδένα = "no one" (5:22) are single negations in
  English. In οὔτε … πώποτε = "never" (5:37), the second οὔτε = "nor". καί
  … οὐκ = "nor" (5:38). οὐκ ἔξεστιν = "It is unlawful" (5:10) and οὐ
  θέλετε = "you refuse" (5:40) are lexicalised negatives. Other negatives
  are split off their verbs.
- Readings: 5:10 `t your` is right. The record is 15/15/16 (one extra
  publisher word, none missing), and "your" is the only English word the
  publisher left unlinked. The wording matches the reviewed "N1904 has only
  the article" notes. 5:29 `t and#1` is right. The record is 16/16/17, the
  publisher's 16 groups cover all N1904 words, and the second "and" is the
  one unlinked English word. 5:12 (12/12/13) correctly claims no reading.
- Same-meaning notes: 5:2 (Bethesda, 16/15/16), 5:15 (told, 14/13/14),
  5:19 (ἂν μή → unless, 37/36/37), 5:33 and 5:36 (John, 8/7/8 and 32/31/32)
  each have exactly one N1904 word unmatched and one publisher word
  different. The English word in question was the publisher's unlinked
  word in each. 5:17 (12/12/13, "Jesus") has one extra publisher word. The
  link ὁ δέ = "Jesus" stands on the reviewed ὁ δέ precedent (Luke 13:23)
  even without the reading. All six notes are soft: none states the
  publisher's spelling or word. Kept.

## Answers to the author's other doubts

- 5:34 ἀλλά = "Even though": agree. The contrast BSB turns into a
  concessive clause is the one between the two clauses, which ἀλλά marks.
  δέ only links back to 5:33. This is the same reasoning as the convention
  that puts "When" on the καί between two clauses.
- 5:6 `t in this condition`: agree. ἔχει with a time phrase means "he has
  been (so) a long time". The state comes from 5:5 and is not in ἔχει.
- 5:9 ἐκείνῃ `s`: agree. BSB's "this" is the new subject (see Changes), not
  "that" day.
- 5:39 "very" `t`, "words" in the αἱ μαρτυροῦσαι group: agree. This is the
  same pattern as "The man who made" (5:11) and "the man who had been
  healed" (5:10).

## Still uncertain

- 5:5 ἦν: joining it with ἔχων and leaving it `s` are both defensible.
- 5:9 versus 5:10: the line between "This" as a built-in impersonal subject
  (5:10, kept) and "this" as a new English subject (5:9, now `t`) is a
  judgment call. Reviewed precedent is mixed for "This is" (Mark 12:29 has
  `t This`).
- 5:12: BSB's Greek has one extra word with no English owner (probably an
  untranslated connective). The chapter makes no claim about it.
