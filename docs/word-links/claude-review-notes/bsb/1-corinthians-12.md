# BSB 1 Corinthians 12: author review (Claude)

Verses reviewed: all 31 (12:1-31). No KEEP blocks in this chapter. Final
check: `fromtext` → `{"versesOk": 31, "problems": 0}`.

94 of the 408 publisher `g` rows changed, in 25 of the 31 verses. 12:4,
12:5, 12:8, 12:9, 12:18 and 12:30 keep every publisher row (they only
gained `s` for TODO connectives and articles, or a link for a TODO token).
6 of the 94 only join a TODO token into a unit with the English unchanged
(listed under "Joined units"). Unchanged rows were checked too. No "of
the"/"to the"/"in the"/"for" now sits on a lone article or a number, no
copula supplied for a verbless clause ("is", "were", "would … be") sits on
a Greek word, and no
person or modal word sits on a participle.

Readings: EVIDENCE shows the publisher's Greek differs from N1904 only in
12:18 and 12:26.
- 12:18: the unmatched word is the one BSB renders "in fact" (probably νυνί
  for N1904 νῦν). Same meaning, so νῦν = "in fact" with a note.
- 12:26: the unmatched word is the one for "suffers with" (probably
  συμπάσχει for N1904 συνπάσχει). Same meaning, so it is linked with a
  note. BSB's Greek also has an extra word that BSB renders "one" in "if
  one part is honored" (probably ἕν before the second μέλος). N1904 lacks
  it, so "one#1" is `t` with the reading reason.
No cross-verse links.

Conventions followed: Romans 1:13 and 11:25 for οὐ θέλω (οὐ = "not",
θέλω = "I do + want"). 2 Timothy 4:8 for "there is given" kept on the
passive verb (12:8). Matthew 25:15 for δέ in a list: `s` when BSB uses a
comma, linked to the final "and" (12:8-10). John 4:23, Luke 1:66 and Acts
19:40 for καὶ γάρ = "For". Matthew 3:14, 1 Thessalonians 4:9 and 1 John
2:27 for χρείαν ἔχω joined as "I do + need" (12:21). John 15:2, 15:4 and
12:13 for words understood again (12:17 σῶμα, 12:21 εἰπεῖν and οὐ
δύναται). Acts 15:11 and 1 Thessalonians 2:7 for ἀλλά = "On the contrary".
1 Corinthians 2:13 and 6:3 for a head noun BSB supplies for a substantival
adjective staying inside it ("spiritual gifts", "all people",
"(un)presentable parts"). 1 Corinthians 3:12 and 5:10 for an article
rendered as a demonstrative (12:9 τῷ = "that"). 1 Corinthians 6:15 for an
"and" joining a participle to the main verb and a supplied object (`t`).
Romans 9:14 for a supplied copula `t`. Mark 4:21 and John 4:29 for an
interrogative μή linked to BSB's question word (12:29-30, as instructed).
README rule 3 for article + participle units.

## Publisher rows corrected

Lone articles and numbers carrying case or other words (the article gets
"the" or `s`, the case word goes to the noun or verb):

- 12:7 τοῦ "of the" → "the"; Πνεύματος → "of + Spirit".
- 12:15, 12:16 τοῦ "to the" → "the"; ἐκ "belong" → "to"; εἰμί "I do" →
  "I do + belong".
- 12:17 ἡ "would the" (twice) → "the"; ἀκοή "sense of hearing be" and
  ὄσφρησις "sense of smell be" lose "be"; σῶμα "body were" → "body";
  "were/would/be" `t` in both questions (the Greek has no verb).
- 12:19 τό "would the" → "the"; σῶμα "body be" → "body"; "would", "be" `t`.
- 12:21 τῇ and τοῖς "to the" → "the"; "to + hand", "to + feet".
- 12:22 τοῦ "of the" → "the"; σώματος → "of + body".
- 12:25 τό "should have" → joined τὸ αὐτό = "mutual"; μεριμνῶσιν
  "concern" → "should have + concern" (modal on the finite verb).
- 12:11 ἕν "of one" → "one"; ἐνεργεῖ "are the work" → "are the work of"
  (the "of" comes from BSB's recast of the verb; ἕν is nominative).
- 12:14 ἕν "of one" → "one"; πολλά "of many" → "many"; ἔστιν "does not
  consist" → "does + consist of + of" (the repeated "of" belongs to the
  same verb); οὐκ (TODO) = "not".
- 12:12 πολλά "of many" → "many"; ἔχει "it is composed" → "it is composed
  of".
- 12:24 τῷ "to the parts" + ὑστερουμένῳ "that lacked it" → joined τῷ
  ὑστερουμένῳ = "to the parts that lacked"; "it" `t`.

Negatives, modals and person moved:

- 12:1 θέλω "I do not want" → "I do + want"; οὐ (TODO) = "not".
- 12:21 δύναται "cannot" → οὐ δύναται = "cannot + can" (οὐ was TODO;
  "can" after "Nor" is the same verb understood again); ἤ "Nor can" →
  "Nor"; κεφαλή "head say" → "head"; εἰπεῖν = "say + say"; Χρείαν "need" +
  ἔχω "I do" → joined "I do + need" (twice); πάλιν (TODO) `s`.
- 12:12 πάντα "they all" → "all", "they" goes to the finite ἐστιν ("they +
  form"); δέ "And although" → "And", "although" goes to the participle
  ὄντα ("although + are").
- 12:13 ἐβαπτίσθημεν "were all baptized" → "were + baptized" and
  ἐποτίσθημεν "we were all given" → "we were + given + to drink"; both
  πάντες (TODO) = "all"; Πνεῦμα "Spirit to drink" → "Spirit".
- 12:27 ἐκ "each of you is" → ἐκ μέρους = "each of you" (μέρους was TODO);
  "is" goes to ἐστε ("are + is"); μέλη "a member of it" → "a member", "of
  it" `t`.

Supplied words moved off Greek words (`t`):

- 12:2 "and" off ἀπαγόμενοι (joins the participle to the main verb).
- 12:3 "be" off ΑΝΑΘΕΜΑ ("cursed"); "is" off ΚΥΡΙΟΣ ("Lord").
- 12:10 "speaking in" off γλωσσῶν, whose "various" moves to γένη (TODO);
  "still" off ἄλλῳ ("to + another").
- 12:11 "them" off διαιροῦν ("who apportions").
- 12:12 καί "it is" → καί `s` ("also"); Χριστός "with Christ" → "Christ";
  "it is with" `t` (verbless frame).
- 12:20 "there are" off πολλά ("many"; the clause has no verb).
- 12:24 "such" off οὐ ("no"); "and" off δούς ("has given").
- 12:26 "it" off συνχαίρει ("rejoices with"), and off the publisher's
  "suffers with it".
- 12:28 "workers of" off δυνάμεις ("miracles"); "those with" off χαρίσματα
  ("gifts"); "and" off γένη ("various").
- 12:29 "work" off πάντες ("all").

Other content fixes:

- 12:6 διαιρέσεις "different ways" → "different" (as in 12:4-5);
  ἐνεργημάτων "of working" → "ways of working" ("ways" renders the plural
  "workings", not "varieties").
- 12:11 ἰδίᾳ "one" → `s` (BSB does not render "individually");
  ἑκάστῳ "to each" → "to each one" (as in 12:7).
- 12:12 τοῦ "its" (lone article) → τοῦ σώματος = "its" (σώματος was TODO).
- 12:15, 12:16 παρά "that" → παρὰ τοῦτο = "that" (τοῦτο was TODO); οὐκ
  "make it any less" → "any less" (the second negative); ἔστιν "would" →
  "would + make it" (the Greek verb recast as BSB's main verb).
- 12:23 ἅ "the" + σώματος "parts" → ἅ = "the parts" (the relative stands
  for the members), τοῦ σώματος `s` ("parts" does not mean "body");
  περισσοτέραν "with greater" → "greater"; περιτίθεμεν "we treat" → "we
  treat with"; τούτοις (TODO) `s` (resumptive).
- 12:25 ἀλλά "but that" → "but"; ἵνα "so that" → "so that + that" (ἵνα
  governs both clauses).

Joined units (English unchanged): 12:3 εἰ μή = "except"; 12:6 ὁ ἐνεργῶν =
"works", τὰ πάντα = "all things"; 12:13 and 12:14 καὶ γάρ = "For"; 12:31
καθ’ ὑπερβολήν = "the most excellent". 12:12 τοῦ σώματος = "its", 12:21 οὐ
δύναται and 12:25 τὸ αὐτό are listed above as fixes.

## Notable decisions

- The gift terms are linked word by word with no interpretive notes:
  χαρισμάτων/χαρίσματα = "gifts", διακονιῶν = "ministries", ἐνεργημάτων =
  "ways of working", ἐνεργήματα = "the working", φανέρωσις =
  "manifestation", προφητεία = "prophecy", διακρίσεις = "distinguishing",
  πνευμάτων = "between spirits", γένη = "various", γλωσσῶν/γλώσσαις =
  "tongues"/"in tongues", ἑρμηνεία = "the interpretation", μέλος/μέλη =
  "part(s)"/"members"/"a member", σῶμα = "body", ἀποστόλους = "apostles",
  διδασκάλους = "teachers", ἀντιλήμψεις = "helping", κυβερνήσεις =
  "administration".
- Lists (12:8-10, 12:28): each "to another" goes to its own ἄλλῳ or
  ἑτέρῳ; every list δέ is `s` except the last, which is "and" (12:10).
  The second ἔπειτα keeps the publisher's "and" (12:28); the final "and"
  in 12:28 has no Greek (`t`).
- 12:29-30: each μή is linked on its own to BSB's question word ("Are"/
  "Do"), with a note on the first; πάντες = "all", and each predicate word
  goes to its own Greek word (ἀπόστολοι, προφῆται, διδάσκαλοι, δυνάμεις,
  χαρίσματα … ἰαμάτων, ἔχουσιν, γλώσσαις, λαλοῦσιν, διερμηνεύουσιν).
- 12:4-6: διαιρέσεις = "different" each time; εἰσίν = "There are"
  (existential with its verb); καί (12:5) and δέ (12:4, 12:6) = "but".
- 12:12: Καθάπερ `s` (BSB drops "just as"; οὕτως = "So"); καί = "though".
- 12:17: the second question has no σῶμα in Greek; "the … body" is linked
  to τό and σῶμα as understood again; ἀκοή = "an ear" (hearing → ear).
- 12:22: ἀλλά = "On the contrary"; πολλῷ μᾶλλον `s` (BSB has no "much
  more").
- 12:2: ὡς ἄν `s`; ἤγεσθε = "you were influenced".
- 12:31: ἔτι = "now" (publisher row, kept).

## Doubts for the peer

- 12:15-16 (hardest): παρὰ τοῦτο = "that", ἔστιν = "would + make it",
  second οὐκ = "any less", ἐκ = "a part of". The alternative is παρὰ
  τοῦτο = "that + make" (the causal phrase as the causative verb) with
  ἔστιν = "would + it".
- 12:29-30: μή = "Are"/"Do" follows the instruction and Mark 4:21, but
  Romans 9:14 and 3:5 make a verbless "Is" `t` and μή `s`; "Are" here is
  also a supplied copula.
- 12:27: "is" linked to ἐστε as the same verb understood again (one Greek
  clause with two predicates). `t` is the alternative if this is treated
  as a supplied copula.
- 12:25: "that#1" linked to ἵνα (same purpose role); `t` is the
  alternative if read as an added "that".
- 12:14: the repeated "of" before "many" is linked to ἔστιν with "consist
  of"; `t` is the alternative.
- 12:23: ἅ = "the parts" with τοῦ σώματος `s`; the alternative is ἅ =
  "the", "parts" `t`.
- 12:28: the second ἔπειτα = "and" (publisher row, kept as a connective
  rendered by another connective); `s` + `t` is the alternative.
- 12:6: changing "different ways"/"of working" to "different"/"ways of
  working" is a meaning fix for consistency with 12:4-5; the publisher's
  split is defensible.
