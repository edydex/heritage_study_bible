# BSB 1 Corinthians 9: independent peer review (Claude)

Checked: 27 of 27 verses (9:1-27). 9:17 is a KEEP block (reviewed earlier by
Codex) and was checked but not edited. Every `g`, `s` and `t` line was
checked against the Greek, BSB's English and the publisher record for each
verse in `public/data/original-languages/bsb-word-links/1-corinthians.json`.
Final check: `fromtext` → `{"versesOk": 27, "problems": 0}`.

## Changes

Six changes in five verses (9:9, 9:12, 9:15 twice, 9:19, 9:25). Every other
verse in the peer JSON is identical to the author's.

- 9:9: ἀλοῶντα = "while it is treading out the grain" → "while + is
  treading out the grain"; "it#1" is now `t` ("English supplies the subject
  of the participle clause"). A participle has no person. This chapter
  already makes the supplied subject of a participle `t` in 9:19, 9:21,
  9:26 and 9:27, and the reviewed files do the same for a third-person
  subject (Romans 7:13 "it", Romans 1:21-22 "they", 1 Corinthians 7:22
  "he"). The progressive "is" stays on the participle, as "am beating" on
  δέρων in 9:26. "the grain" stays inside: "tread out the grain" is what
  ἀλοάω means, not a separate object. 1 Timothy 5:18 (Codex row, same
  quotation) still keeps "it" inside the participle. It may need the same
  fix, but that file is outside this review.
- 9:12: ὑμῶν = "to your support" → "to your"; "support" is now `t`
  ("English names what the right is to; the Greek has no noun here"). The
  genitive says only "(right) over you". "support" is a noun BSB supplies,
  the same kind of word as "offerings" (9:13), "blessings" (9:23) and "the
  harvest" (9:10), which the author already made `t`. The note now reads
  "The genitive ὑμῶν ("over you") is rendered to your."
- 9:15: τούτων = "of these rights" → "of these"; "rights" is now `t`
  ("English names what these refers to"). τούτων is a pronoun, and "these"
  already renders it. "rights" names what it refers to, like "apostles" in
  9:6, which the author made `t`. The referent (ἐξουσία) is in 9:12, and a
  cross-verse link is not allowed for that.
- 9:15: κενώσει = "let + nullify" → "nullify"; "let" is now `t` ("English
  supplies let; the Greek breaks off with a plain future (no one will
  nullify)"). This "let" is not a jussive, and κενώσει is a future
  indicative, so "let" (= allow) has no Greek word. A supplied non-jussive
  "let" is `t` in Romans 12:11. οὐδείς = "anyone" with its note is kept.
- 9:19: πάντων = "to anyone" → "anyone"; "obligation" `t` → "obligation
  to" `t`. πάντων is a genitive after ἐκ, and ἐκ already has "of" ("free
  of"). The "to" is the preposition that goes with the supplied noun
  "obligation", not a case word of πάντων.
- 9:25: πάντα `s` ("BSB does not render πάντα separately") and ἐγκρατεύεται
  = "trains with strict discipline" → πάντα ἐγκρατεύεται joined = "trains
  with strict discipline" // πάντα ἐγκρατεύεται ("exercises self-control in
  all things") is rendered trains with strict discipline. BSB folds "in
  all things" into "strict". Before the change, the verb alone carried
  "strict", and πάντα was marked as having no English. Linking πάντα alone
  to "strict" would over-claim, because "strict" and "in all things" do
  not mean the same thing. So the honest link is the joined unit.

## Answers to the author's doubts and the points to settle

- 9:6 οὐκ ἔχομεν ἐξουσίαν μή = "must": kept. "have no right not to" means
  "must" only with all four words: without ἐξουσίαν, "not have … not"
  does not give "must". So ἐξουσίαν is not left without English, and making
  it `s` would split the idiom. There is no split pair and no over-claim.
  "are" (copula), "apostles" (supplied noun) and "who" (relative) are
  correctly `t`. ἐργάζεσθαι = "work for a living" is kept as BSB's
  contextual sense of the verb.
- 9:10 both ἐπ’ ἐλπίδι = "expect": kept. BSB's "they" (on ὀφείλει) covers
  the plowman and the thresher, and "expect" is said of both. Linking only
  the second would leave the plowman's hope without its English. "threshes"
  `t` is right: the Greek states no verb for the thresher (only ὁ ἀλοῶν,
  already "the thresher"). "Isn’t He + speaking" on λέγει follows Romans
  6:3 ("aren’t you aware", no Greek negative).
- 9:21 ὤν = "though + am#0 + am#1": kept. The single participle governs
  both predicates (μὴ ὢν ἄνομος Θεοῦ ἀλλ’ ἔννομος Χριστοῦ). The second "am"
  is the same verb with the same role in the same clause, not a copula
  supplied for a verbless clause. The "supplied copula is `t`" rule (John
  14:10, 15:5) is about a clause with no εἰμί. "am" carries the verb's
  meaning. "I#1" stays `t` (no person on a participle), as does "I#0
  became" (the verb is in 9:20, and no cross-verse link).
- 9:24 "the#2 prize#1" = τὸ βραβεῖον understood again: kept. λαμβάνει τὸ
  βραβεῖον / καταλάβητε is a parallel pair with the same object left
  understood. BSB repeats the noun, not a pronoun, and the rule allows a
  change of mood (John 15:4).
- 9:15 οὕτως `s` and "something" `t`: kept. "something" is an indefinite
  subject and οὕτως is a manner adverb, so the meanings differ and this is
  not a split pair. ἵνα = "to + that" with "suggest" `t`: kept. ἵνα is both
  the purpose marker ("to") and the word that opens the clause whose verb
  is γένηται ("that … be done"). Only "suggest" is English-only.
- 9:11 εἰ = "for": kept. After μέγα, εἰ opens the subject clause. BSB's
  "for (us) to reap" opens the same clause, so it is the same role with a
  different word. The publisher's "for us" on ἡμεῖς would put a clause
  marker on a pronoun.
- 9:25 πάντα: changed (above).
- 9:9 ἀλοῶντα: "it" changed (above). "while", "is treading out the grain"
  kept. Οὐ = "not", κημώσεις = "Do + muzzle", βοῦν = "an ox" confirmed. The
  cleft "Is it … that" is `t`. τῶν βοῶν = `s` + "about oxen", and μέλει =
  "is concerned" is confirmed.
- Rhetorical questions: confirmed. Every μή question marker (9:4, 9:5, 9:8,
  9:9) is `s`. Every οὐ/οὐκ/οὐχί is linked alone (9:1 ×4, 9:4, 9:5, 9:7 ×2,
  9:8 "Doesn’t", 9:12 "shouldn’t", 9:13, 9:24). "Am I", "Have I", "Have we"
  and "Do you + know" stay on the verbs.
- 9:7 ἐσθίει = "does + drink": kept. It is the same verb in the same role
  (taking nourishment from the flock's milk). "drink" is the English verb
  that goes with milk, not a word of different meaning, so `s` + `t` is not
  needed.
- 9:13 reading: EVIDENCE shows exactly one N1904 word unmatched and one
  publisher word not in N1904. συνμερίζονται is the only token whose English
  ("partake") the publisher left unlinked. The note "Same word, spelled
  differently in BSB's Greek text" does not name the publisher's spelling.
  Kept. No other verse claims a reading, and none should, since every other
  EVIDENCE line says the Greek is identical.
- 9:13 τά = "the#0", ἱερά = "in + temple", θυσιαστηρίῳ (17) = "its#1" with
  "offerings" `t`: kept. τὰ ἐκ τοῦ ἱεροῦ = "its#0 food" as one unit: kept.
  τά has no English apart from "food".
- Lone articles: checked in every verse. None carries "of the", "to the" or
  "in the". τοῖς = "To#1 those" (9:20) and "To those" (9:21) are articles
  used as pronouns.

## KEEP block (9:17)

Not edited. I agree with the author's observation. The supplied copulas are
folded into Greek groups: "is#0" inside ἑκὼν τοῦτο πράσσω = "my preaching is
voluntary", and "it is#1" inside ἄκων = "it is not voluntary". Current
convention would make them `t`. The meaning is not wrong. "still" `t` and
γάρ `s` are fine.

## Still uncertain

- 9:8 καί `s` with ταῦτα = "the#1 same thing". "same" may partly reflect
  καί ("also"). Kept, because "the same thing" is fully explained by ταῦτα
  pointing back to the first ταῦτα.
- 9:6 "for a living" kept inside ἐργάζεσθαι. `t` would be the stricter
  option.
- 9:9 and 1 Timothy 5:18 now treat "it" differently. If Codex revisits 1
  Timothy 5:18, "it" `t` there would match.
