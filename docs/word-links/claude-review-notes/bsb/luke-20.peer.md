# BSB Luke 20: independent peer review (Claude)

Checked: 47 of 47 verses (20:1-47; the chapter has no KEEP verses). I
checked every `g`, `s` and `t` line against N1904, the displayed BSB, the
publisher record in `public/data/original-languages/bsb-word-links/luke.json`
and the reviewed parallels Mark 11:27-12:40 and Matthew 21:23-22:46 (and
Luke 5:17, 8:22, 10:30, 11:18, 13:31, 14:16, 15:11 and 15:29 for Luke
conventions). Final check: `fromtext` → `{"versesOk": 47, "problems": 0}`;
a `totext` roundtrip of the final JSON is identical to the edited text.

## Reading claims

The publisher record has a `partial` entry for 20:4, 20:6, 20:9, 20:16 and
20:45 only.

- 20:4, 20:6: 1 N1904 word unmatched each, same word count. The publisher
  rows leave exactly Ἰωάνου / Ἰωάνην and "John’s" / "John" unlinked, so
  the name is spelled differently. The links with the soft note ("Same name,
  spelled differently in BSB's Greek text") are right.
- 20:16: all 16 Greek words matched both ways; the difference is on the
  English side (28 displayed words against 27 in the publisher's English,
  probably the second "will"). No reading claim is needed, and none is made.
- 20:45: 8 of 8 N1904 words matched, 9 publisher Greek words. The publisher
  rows link τοῖς = "to" and μαθηταῖς = "disciples" and leave "His" out of
  every N1904 row, so BSB's "His" renders the extra word (probably αὐτοῦ).
  `t His` as a reading is right (see below).
- 20:9: 20 of 20 N1904 words matched, 21 publisher Greek words. The author
  claimed no reading. I changed this (see below).

## Changes (2 verses: 1 link fix, 1 note-only fix)

- 20:9: ἄνθρωπος "A man" → ἄνθρωπος = "man"; new `t A` = "BSB follows a
  reading with an extra word here, rendered A, which N1904 lacks." Why: the
  publisher row is ἄνθρωπος = "man" without "A", although in the same verse
  the publisher puts the article with the noun (ἀμπελῶνα = "a vineyard",
  γεωργοῖς = "to some tenants"). So the publisher linked "A" to its extra
  word, probably τις ("a certain"). The reviewed Luke chapters link "A"/"a"
  to τις in ἄνθρωπός τις (10:30, 14:16, 15:11). Rule 9 says not to invent a
  link for a word BSB takes from a reading N1904 lacks. This restores the
  publisher row.
- 20:45: note only. `t His` now reads "BSB follows a reading with an extra
  word here, rendered His; N1904 has only the article." This is the wording
  of the reviewed Luke 15:29, and it says why τοῖς is not linked to "His".

## Points I was asked to settle, and the author's doubts

- 20:19, γάρ = "When", opening Καί `s`: **agree.** "When" is the English
  word that joins the realizing clause to the seeking clause, and γάρ is the
  Greek word that makes that join ("for they knew"). BSB moves the γάρ
  clause first and turns its causal link into a When-clause, which in this
  sentence still gives the cause. So "When" renders γάρ with a shifted
  meaning; `t When` + γάρ `s` would be a split pair. Reviewed chapters also
  link γάρ to shifted subordinators: "since" (Mark 11:13), "even though"
  (Mark 16:4), "because" (29 verses). The opening Καί, which the publisher
  linked to "When", only joins the verse to the parable; BSB's main clause
  "they sought" has no connective, so Καί `s` is right.
- 20:19, τῇ = "that", αὐτῇ = "very": **agree.** The reviewed Luke 13:31 links
  ἐν αὐτῇ τῇ ὥρᾳ "At that very hour" the same way (τῇ = that, αὐτῇ = very).
- 20:20, 20:26, αὐτοῦ = "Him + His": **agree.** In ἐπιλαμβάνομαι αὐτοῦ λόγου /
  ῥήματος, αὐτοῦ can be read as the person caught (genitive of person and
  of thing, the usual lexical reading) or as the owner of the word. BSB's
  "catch/trap Him in His words" expresses both, and αὐτοῦ is the only Greek
  word for Jesus in the clause. Linking it to both pronouns is like the one
  object linked to a repeated "him" (20:10-12, 20:15). The publisher had
  "Him" inside the verb row, which over-claims. `t Him` would call a word
  supplied that the standard reading takes from αὐτοῦ. The parallels Mark
  12:13 and Matthew 22:15 have `t His`, but their Greek has no genitive
  pronoun (λόγῳ / ἐν λόγῳ), so they do not apply here.
- 20:45, "His" as a reading vs τοῖς as possessive: **agree with `t`**, on the
  publisher rows as well as the EVIDENCE count (see Reading claims).
  Linking τοῖς to "His" would invent a link the publisher did not make.
  τοῖς `s` and μαθηταῖς = "to + disciples" follow the case-word convention.
- 20:35: **agree.** αἰῶνος = "age", ἐκείνου = "to come" (with a note:
  "that age" is the age to come), τυχεῖν = "to share in" + "in#1" (one verb
  governs both genitives; English repeats "in"), τῆς = "the", and οἱ
  καταξιωθέντες joined. The publisher's ἐκείνου = "in" and τῆς = "in the"
  were wrong. Joining αἰῶνος ἐκείνου = "age to come" would also be
  acceptable. It is not more accurate, so I did not change it.
- 20:18: **agree.** ἐφ’ = "on#1", ὃν … ἄν = "whom", αὐτόν = "he" (the active
  "it will crush him" made passive) match the reviewed Matthew 21:44 word for
  word. The publisher's ὅν = "he on whom" over-claimed.
- 20:6, 20:7, 20:41, "that" `t` before an infinitive clause: **agree.**
  This matches Luke 11:18 ("English introduces the reported statement; the
  Greek uses an infinitive").
- 20:40, οὐκέτι … οὐδέν = "not + any further": **agree.** The two negatives
  make one English negative, like οὐ μή = "never" and Matthew 22:46 οὐδὲ …
  τις = "and + no one". The publisher's οὐδέν = "any further" was the weaker
  link, since "further" comes from the ἔτι in οὐκέτι.
- 20:33, ἡ γυνή = "she", γίνεται = "will + be": **agree.** Luke has an
  explicit subject. Mark 12:23 has none, which is why "will she be" stays on
  the verb there.

## Other checks (no change)

- 20:2 ἤ = "and" matches the reviewed Mark 11:28. 20:32 καί ("also") = "And"
  matches Mark 12:22. 20:25 Τοίνυν = "So" placed before the speech matches
  Matthew 22:21 (οὖν = "So").
- 20:14 ἵνα = "and", 20:24 ἔχει = "are on it", 20:37 ὡς = "For" and 20:40
  γάρ = "And" are publisher rows. In each, the English is a loose rendering of
  that Greek word, not a word with another meaning, so I left them linked.
- 20:28 matches Mark 12:19 throughout. 20:47 matches Mark 12:40. 20:17
  (quotation) matches Mark 12:10.
- Case words and prepositions on articles: the author moved them to the noun
  in every verse. The reviewed Luke chapters do the same (746 article rows
  with "the" against 19 older ones in Luke 1 with a case word).

## Still uncertain

- 20:9: the extra publisher word is inferred from the word count and the
  publisher row without "A". If BSB's Greek has some other extra word,
  ἄνθρωπος = "A man" would be the better link.
- 20:20, 20:26: Him + His is a choice between two honest readings of one
  genitive. αὐτοῦ = "His" with `t Him` (the publisher's reading) is the
  fallback if a later reviewer wants one English word per Greek pronoun here.
