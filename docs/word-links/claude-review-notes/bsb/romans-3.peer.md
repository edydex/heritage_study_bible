# BSB Romans 3: independent peer review (Claude)

Checked: 31 of 31 verses (3:1-31). The chapter has no KEEP blocks. I read
every line of every verse in the author's file (`totext --all`) against the
Greek, the publisher draft rows and each verse's EVIDENCE line.

Final check: `fromtext` → `{"versesOk": 31, "problems": 0}`.

## Changes (2 verses, notes only; no link changed)

- **3:7**: the reason on `t` "the increase of" was: English expands "to His
  glory" as "to the increase of His glory". → Now: English adds the noun
  increase, drawing on ἐπερίσσευσεν ("abounded"), which is linked to
  accentuates. Why: "increase" is not just an expansion of "to His glory".
  BSB takes it from the meaning of περισσεύω, and a reader who taps it should
  be pointed to that verb. The link itself stays `t` (see the answer to doubt
  1).
- **3:12**: the note on ἕως = "even" was: ἕως ("as far as") in ἕως ἑνός is
  rendered not even one. → Now: ἕως ἑνός ("as far as one") is rendered even
  one. Why: "not" belongs to οὐκ, not to ἕως ἑνός. The old note gave the
  phrase a word from another group.

## Answers to the author's doubts

1. **3:7 "the increase of"**: keep `t`. ἐπερίσσευσεν is a finite verb and is
   rendered "accentuates", with "my falsehood" as its subject. "increase" is a
   noun at the head of the purpose phrase "to the increase of His glory". The
   meaning is related, but the role is different. A Greek word links to a
   second English rendering only when the role and the meaning are the same.
   This is also not a word understood again in a parallel clause. The new
   reason names the verb, so a reader still finds the source.
2. **3:10-12 "one"**: confirmed. Οὐκ ἔστιν δίκαιος means "there is not a
   righteous person". So "no" = οὐκ, and "one righteous" = the adjective used
   as a noun. In 3:11 and 3:12 the article + participle is "one who
   understands / seeks / does" (rule 3). The negative keeps its own word,
   as everywhere else in the chapter.
3. **3:20 οὐ … πᾶσα = "no", σάρξ = "one"**: confirmed. In the Hebrew-style
   "not … all flesh", πᾶσα gives "any" and the negative cancels it, so the
   two together are English "no". σάρξ is the person, so it is "one". The
   publisher's row (one = πᾶσα, σάρξ unlinked) left the real noun without a
   link. ἐνώπιον = "in + sight" and αὐτοῦ = "His" are right.
4. **3:27 On#1 = διά, "that#0" `t`, "that#1" = νόμου**: confirmed.
   - The Greek elides both διά and νόμου before τῶν ἔργων.
   - "On#1" is the same preposition, repeated in the parallel elliptical
     question, with the same role and meaning. Reviewed chapters link a
     repeated English preposition to the one Greek preposition (Acts 12:11,
     26:18, Luke 23:19, 1 Timothy 2:9).
   - "that#0" is not a repeat of "principle". It is a demonstrative pronoun
     that English supplies for the elided noun. A supplied demonstrative is
     `t`.
   - In the third clause νόμου is printed and BSB renders it "that", so
     "that#1" = νόμου avoids a split pair.
   - τῶν agrees with ἔργων (genitive plural). It cannot stand for the head
     noun, so the publisher's "On that" on τῶν was rightly removed.
5. **3:8 "say#0"**: keep `t`. λέγειν is the reported infinitive ("claim that
   we say"). "Why not say" is BSB's own main verb for an elliptical question.
   It is not the same role, and it is not a parallel repeat. "Why" is `t` too.
   It comes from τί in 3:7, and καί does not mean "why".

## Points checked and confirmed

- **3:25/3:26 verse division**: this is a real division difference, not BSB
  reordering.
  - 3:26 EVIDENCE: 5 N1904 words unmatched, 0 extra. Its partial record has
    sourceWords 26, matched 21, publisherGreekWords 21.
  - 3:25 EVIDENCE: 0 unmatched, 6 extra publisher words (22 + 6 = 28
    publisherGreekWords). 3 of its 30 English words did not carry over.
  - In the draft, the English "in His forbearance" (3:25) and the Greek ἐν
    τῇ ἀνοχῇ τοῦ Θεοῦ (3:26, tokens 0-4) were left without an owner. The 3:25
    record matches 27 of 30 English words, which fits those three words.
  - So the publisher's Greek ends 3:25 with these five words, as English
    Bibles do. The sixth extra word has no unmatched English word, so nothing
    is claimed for it.
  - The mechanics match Acts 5:39-40, 13:38-39 and 24:18-19. The source verse
    has `m 0 1 2 3 4 > 3:25`, with the standard reason. The target verse links
    every moved token with `g @3:26`, and the first of those lines has the
    note.
  - The compiler requires every moved token to sit inside a target-verse
    group, and an `s` line cannot point to another verse. So τῇ cannot be
    `s`. Joining it to its noun (τῇ ἀνοχῇ = "forbearance") claims no English
    word for the article alone. τοῦ Θεοῦ = "His" is the genitive phrase
    rendered by a possessive, with a note. Both joins are honest.
- **3:25 ἱλαστήριον = "as the atoning sacrifice"**: confirmed. It is the
  predicate noun of προέθετο, the same pattern as reviewed 1 John 4:10
  ἱλασμόν. No interpretive note was added. διά = "through", πίστεως =
  "faith". The likely extra article in BSB's Greek is not claimed.
- **3:19 ὑπόδικος γένηται = "held accountable"**: confirmed. BSB lets the
  "may be" of "may be silenced" serve both verbs. τοῖς = "to those who" is a
  substantival article, which the lone-article rule exempts. "are" is `t`.
- **3:26 τὸν ἐκ = "the one who has"**: confirmed. It matches Galatians 3:7
  and 3:9, οἱ ἐκ πίστεως = "those who have". πρός = "to" (purpose), ἔνδειξιν
  = "demonstrate" and τὸ εἶναι = "to be" are right. αὐτόν is `s` and "He did
  this" is `t`.
- **3:29 "the God" `t`**: confirmed. Ἰουδαίων is a genitive predicate with no
  head noun, and English supplies "the God". ὁ belongs to the subject
  Θεός = "God#0", so it cannot carry the predicate's "the". "Is#1 He" is `t`.
- **μὴ γένοιτο = "Certainly not"** as one unit in 3:4, 3:6 and 3:31:
  confirmed, as in reviewed Galatians 2:17 and 3:21.
- **Modal and person words**: confirmed.
  - The modal or person word sits on the finite verb: 3:3 Will + nullify,
    3:6 could + judge, 3:7 am + condemned, 3:31 Do we + nullify.
  - In 3:7, "I" = κἀγώ, an explicit pronoun.
  - In 3:4, Let + be = γινέσθω (jussive on the imperative).
  - 3:8 "Let us do" is a hortatory subjunctive.
  - No participle carries a person: 3:5, 3:11, 3:12, 3:21, 3:22, 3:24, 3:26.
- **3:9 τε = "alike"**: confirmed. Same link and note as reviewed Acts 18:4,
  19:10 and 20:21.
- **3:4 καθάπερ = "As"**: confirmed.
  - EVIDENCE shows 1 word unmatched and 1 extra.
  - In the draft, "As" was the only English word without an owner. καθάπερ
    was the only unowned Greek word that could render it; the others were
    articles, μή, δέ and Ὅπως.
  - The review-file note ("BSB's Greek text has a different word for "as"
    here, with the same meaning") does not name the publisher's word.
- **Old Testament catena (3:10-18)**: every verse checked word by word.
  - Supplied copulas and verbs are `t`: 3:13 are/is, 3:15 are, 3:16 lie.
  - Shifted English idioms are linked with notes: 3:13 ὑπό = on, 3:16
    ὁδοῖς = wake.
  - The dative article of 3:13 ταῖς γλώσσαις is `s` with a reason.
  - Elided ἔστιν (3:11, 3:12) is `s`.
- **Brief rules**: no "of the", "to the" or "in the" sits on a lone article.
  - Every supplied copula, "there", object, demonstrative or adverb is `t`:
    3:1, 3:5, 3:13, 3:15, 3:16, 3:19, 3:22, 3:24, 3:27, 3:29 and 3:30. These
    include 3:5 "on us", 3:22 "this" and 3:30 "there is only".
  - Connectives rendered by a different connective are linked: 3:4 δέ =
    and, 3:6 ἐπεί = In that case, 3:7 δέ = However, 3:20 διότι = Therefore.
  - The anaphoric articles are linked: 3:30 τῆς = that same, 3:31 τῆς =
    this.

## Still uncertain

- 3:7: some reviewers could prefer "accentuates + increase" on ἐπερίσσευσεν.
  I kept `t` under the same-role rule, but this is a judgment call.
- 3:25: τῇ could also join "His" instead of "forbearance", since the English
  possessive takes the article's place. Both are honest. I kept the author's
  choice.
