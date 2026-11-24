# BSB Acts 28: independent peer review (Claude)

Checked: 30 of 30 verses

I started from the author's final file. I ran `totext --all` and checked every
line of every verse against the Greek, BSB's English and the publisher's record
in `public/data/original-languages/bsb-word-links/acts.json`. Then I ran
`fromtext` again. Final check: `{"versesOk": 30, "problems": 0}`. 28:29 is
absent from both N1904 and BSB's main text, and it stays out. Three verses
changed links (28:1, 28:14, 28:19), and one note was reworded (28:23). The
other 26 verses are unchanged.

## Changes

- **28:1 ἐπέγνωμεν = "we#0 + we#1 learned" → "we#1 learned"; "we#0" `t`.**
  BSB says "Once we were safely ashore, we learned". The first "we" is the
  subject of the participle clause διασωθέντες. Under the project-wide person
  rule, a participle has no person, so a first-person "we" that BSB supplies
  for a participle clause is `t`. The verse has no explicit ἡμεῖς that could
  own a repeated "we". Registered 22:5 was changed to this rule, so it no
  longer supports a double link. New note: "A participle has no person; BSB
  supplies we for διασωθέντες (as Acts 22:5)."
- **28:14 παρεκλήθημεν = "we#0 + invited us" → "invited us"; "we#0" `t`.**
  BSB says "There we found some brothers who invited us". "We" belongs only
  to "found", which renders the participle εὑρόντες. The finite verb
  παρεκλήθημεν is recast as the relative clause "who invited us", and its
  ending is already given by "us". The author cited 22:5 for this link, but
  22:5 now makes the participle-clause "I" `t`. So linking "we" to
  παρεκλήθημεν over-claimed. The note on παρεκλήθημεν now says its ending
  gives "us" only.
- **28:19 ἠναγκάσθην = "I#0 was compelled + I#1" → "I#0 was compelled";
  "I#1" `t`.** The second "I" ("even though I have no charge to bring") is the
  subject of the participle ἔχων. There is no explicit ἐγώ, so it is `t`,
  as in 23:27–30. New note: "A participle has no person; BSB supplies I for
  ἔχων (have), and the first person comes from ἠναγκάσθην."
- **28:23 note on πρός `s` reworded (the link is unchanged).** The old reason
  said "BSB merges πρὸς αὐτόν ('to him') into to the place he was staying".
  But αὐτόν is linked to "he", so only πρός is left without English. New
  reason: "BSB's single to (to the place) renders εἰς, so πρός ('to') before
  αὐτόν has no separate word."

## Answers to the author's doubts

- **28:2 τὸν ἐφεστῶτα = "it was": agree, kept.** The perfect participle of
  ἐφίστημι means "having set in, being present". BSB turns "the rain that had
  set in" into the clause "it was raining". The English past progressive "was
  …-ing" is what carries the participle's "present, ongoing" sense. If the
  Greek had only διὰ τὸν ὑετόν, "because of the rain" would be the natural
  rendering. So this is a real correspondence, not a supplied copula. `s` plus
  `t` would hide it. The note says the participle is folded into "it was
  raining", which is accurate.
- **28:14 παρεκλήθημεν = we + invited us:** changed (above).
- **28:18 με = me + me: agree, kept.** ἀνακρίναντές με ἐβούλοντο ἀπολῦσαι is
  one clause. The single accusative με is the object of the participle and of
  the complementary infinitive of the main verb, and both English "me" are
  direct objects with the same referent. This is the 16:3 pattern (λαβὼν
  περιέτεμεν αὐτόν = him + him). It is not the 16:39 case, where a new clause
  after καί leaves its object understood. 28:7 ἡμᾶς = us + us
  (ἀναδεξάμενος … ἐξένισεν) fits the same rule and is kept.
- **28:5 οὖν = "But", μέν `s`: agree, kept.** Reviewed Acts treats μὲν οὖν
  the same way every time: οὖν carries BSB's connective, and μέν is `s` (11:19
  Meanwhile, 23:18 and 23:22 So, 25:11 however). ὁ = Paul matches 23:18 ὁ μὲν
  οὖν παραλαβών, where ὁ = "the centurion", and 5:41.
- **28:6 αὐτῶν = "they": agree, kept.** αὐτῶν is an explicit pronoun and is
  BSB's only "they" in the sentence. In BSB, "after waiting … and seeing …" is
  a participle phrase whose understood subject is that same "they". Rule 4
  links an explicit pronoun on its own, so ἔλεγον keeps "said" alone.
- **28:24 οἱ μέν = "Some of them" on the article: agree, kept.** This is
  consistent with 14:4 (οἱ = Some) and 19:9 (τινες = some of them), with μέν
  `s` and δέ = but.
- **28:25 ἐλάλησεν = "when He spoke": agree, kept.** It matches John 4:17,
  where Καλῶς = correct, εἶπες = You + to say, and the supplied copula is `t`.
  Here "was" is `t`, as it should be.

## Other points checked

- **28:17 Ἐγώ = I + I:** kept. Ἐγώ is the subject of the whole sentence, and
  ποιήσας agrees with it, so the explicit pronoun may link to the repeated "I"
  (22:3).
- **28:13 "we#0" on κατηντήσαμεν:** kept. Here the one "we" is the subject of
  the compound predicate "weighed anchor and came", and it includes the finite
  verb. This matches 21:2 and 21:4 (We + stayed). 28:10 "we" `t` is also
  correct, because the dative participle ἀναγομένοις has no pronoun.
- **Readings:** the three EVIDENCE verses (28:2, 28:13, 28:20) each show one
  N1904 word unmatched. In each, the publisher's unmatched English is the word
  the author discusses: "showed" in 28:2, "we weighed anchor" in 28:13 and
  "because of" in 28:20.
  - 28:2 παρεῖχαν = "showed": same verb, so it is linked with a note.
  - 28:20 εἵνεκεν = "because of": spelling only, linked with a note.
  - 28:13: "weighed anchor" renders a word meaning "having cast off", which is
    not "having sailed around". So περιελθόντες `s` plus "weighed anchor" `t`
    is right under rule 9.

  None of the notes states the publisher's exact spelling.
- **28:20 ὑμᾶς = first "you" only:** kept. ὑμᾶς is the accusative object of
  παρεκάλεσα, which BSB renders as the object of "see". προσλαλῆσαι takes a
  dative, so the "you" after "speak with" fills a different slot. It is
  understood, not shared, so it is `t`.
- **28:6 οἱ = The islanders, 28:21 οἱ = The leaders:** kept. In both, the
  article with δέ works as a pronoun that BSB names (as 10:4 and 23:18).
- **Isaiah quotation (28:26–27) against Matthew 13:14–15 (same Greek):**
  - 28:26 Ἀκοῇ = ever and ἀκούσετε = You will be + hearing, with βλέποντες =
    ever and βλέψετε = you will be + seeing. These are the same assignments as
    the study heads in Matthew 13:14, written as separate groups.
  - 28:27 βαρέως = hardly and ἤκουσαν = they + hear are the same as Matthew
    13:15.
  - 28:27 τοῖς/τῇ = their and the noun = with + ears/eyes/hearts differ from
    Matthew 13:15, which joins article and noun and makes "their" `t`. The
    Acts version follows the current conventions: an article used as a
    possessive links to the possessive, and the preposition goes on the noun.
    So Matthew 13:15 is the older row here, not a precedent to copy.
- **Lone articles and numbers:** none in the chapter carries "of the", "to
  the" or a preposition. The only "of" on an article is the indeclinable τοῦ
  Ἰσραήλ (28:20). The numbers τρεῖς, ἑπτά and μίαν carry only their number
  word.
- **Supplied English:** each of these is `t`: copula "was" (28:25), "there"
  (28:12, 28:18, 28:30), supplied objects and demonstratives ("them" 28:3,
  "It" 28:11, "this" 28:25, "you#1" 28:20) and the added adverb "even"
  (28:21). There is no jussive "let" in the chapter's English.
- **Participle "and":** καί inside a participle chain is linked to BSB's
  "and" in 28:3, 28:6, 28:8 and 28:23 (τε). Every English "and" that joins a
  participle to the main verb where the Greek has no καί is `t`.

## Still uncertain

- 28:2 τὸν ἐφεστῶτα = "it was" is a judgment call. I agree with it, but
  `s` plus `t` would also be defensible.
- 28:23 αὐτόν = "he" (in "the place he was staying") changes role from
  "to him" to the subject of BSB's relative clause. I kept it because it is
  the only English word for αὐτόν's referent, as with 28:22 ἡμῖν = "we".
- Third-person "They/he" stays on participles in 28:2, 28:3, 28:4, 28:23,
  28:25 and 28:31, by the existing convention (16:3, 16:39, 22:24, 22:30).
  The settled person rule covers only "I/we/you".
