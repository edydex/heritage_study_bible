# BSB John 7: independent peer review (Claude)

Checked: 53 of 53 verses (7:1-53). I checked every `g`, `s` and `t` line
against N1904, the displayed BSB, the publisher rows for John 7 in
`public/data/original-languages/bsb-word-links/john.json`, and the
`partial` counts there for each reading claim. I also compared the reviewed
precedents for supplied "the" (John 3:5, 3:23, 3:29), "such" (Luke 5:6,
Mark 2:2) and reading notes (Mark 7:4, Matthew 19:29, Luke 23:31).
Final check: `fromtext` → `{"versesOk": 53, "problems": 0}`.

## Changes

No link changed. Four reasons in three verses were reworded.

- 7:8 `s` on the first οὔπω: "N1904 has οὔπω ("not yet"); BSB's "not"
  follows a different reading here." → "N1904 reads οὔπω ("not yet"); BSB's
  Greek text differs at this word, and its "I am not going up" does not
  render οὔπω." Why: the old wording said "BSB's "not"" in the line for a
  Greek word that "not" does not render. The new wording says plainly that
  the word has no counterpart.
- 7:8 `t not#0`: "BSB follows a reading with a plain negative here, where
  N1904 has οὔπω ("not yet")." → "BSB's "not" follows a different reading
  here; N1904 has οὔπω ("not yet")." Why: "a plain negative" describes the
  publisher's Greek, which is not in the repo. The new reason states only
  what the record shows.
- 7:3 `s` on the second σοῦ: "The second possessive σοῦ ("your") is left to
  You are doing." → "BSB leaves the second σοῦ ("your") implicit in "the
  works You are doing"." Why: the old sentence was hard to parse.
- 7:18 `s` on οὗτος: "… is not rendered; He who stays the subject." →
  "… is not rendered; BSB keeps "He who seeks" as the subject." Why: the
  old wording read as "He who stays".

## Reading claims checked against the record

- 7:8 (18/17/18): one N1904 word has no counterpart and nothing is extra.
  The publisher's "has not yet" belongs to the second οὔπω. The first οὔπω
  has no publisher row, and "am not" has no publisher owner. So the
  differing word is the first οὔπω. "Not yet" (he will go later, as in 7:10)
  and "not" mean different things, so rule 9 applies: οὔπω `s`, "not" `t`.
  "am" stays with ἀναβαίνω (negatives are split off verbs).
- 7:9 (8/7/8): αὐτοῖς is the differing word. It has no publisher row, and
  BSB has no "to them". The `s` reason says so. The publisher's own row puts
  "Jesus remained" on ἔμεινεν. So "Jesus" is a named subject (rule 7), not
  BSB's rendering of the differing word. `t Jesus` with "English names the
  subject of remained" is right, and the reason makes no reading claim.
- 7:34 (13/13/14) and 7:36 (20/20/21): BSB's Greek has one extra word, and
  every N1904 word has a counterpart. The second "Me" is the only English
  word with no publisher owner. `t Me#1` "BSB follows a reading with an
  extra word here." is right and names no word.
- 7:19 (17/16/17), 7:24 (9/8/9), 7:53 (7/6/7): in each verse, the verb
  (ἔδωκεν, the second verb κρίνατε, ἐπορεύθη) is the only content word with
  no publisher row. Its English ("given", the second "judging", "went") is
  the only content English with no owner. So the verb is the differing
  word. The English still renders the same verb, so the link with the
  neutral note "Same verb, in another form in BSB's Greek text." is right
  (rule 9, same meaning). The other words with no row (the second τόν in
  7:19, κρίσιν in 7:24, τόν in 7:53) cannot be the differing word: if they
  were, the verb's row would have carried over.
- 7:25 (12/11/12): Ἱεροσολυμειτῶν. "of Jerusalem" has no publisher owner.
  The spelling note is right.
- 7:16 (16/16/17) and 7:50 (13/13/14): one extra publisher word each, but
  every publisher English word has an owner. Nothing is claimed, which is
  right.

## Answers to the author's doubts

- 7:8: agree with οὔπω `s` + "not" `t`. Linking οὔπω to "not" with a note
  would show "not yet" under an English word that says something different.
  Rule 9 does not allow that.
- 7:4: agree with αὐτός = "who" (the publisher's row) and καί `s`. "who"
  is the subject of "wants", which is αὐτός's role. The same pattern is used
  in 7:45 (ἐκεῖνοι = "who", καί `s`). The "When" convention is for a
  temporal clause, not for a relative pronoun that has its own Greek owner.
- 7:22: agree with διὰ τοῦτο = "because", καί `s` and "But" `t`. διά +
  accusative is causal, so it fits "because" better than καί does. The
  publisher's table put "But because" on διά, so "But" was not tied to καί
  there either. "But" belongs at the start of the verse, and the καί is
  mid-verse; linking them would move a connective and change its meaning.
- 7:52: agree with joining Μή … εἶ = "Aren’t". The English contraction
  needs an owner for "n't", and the chapter joins the same way in 7:25 (Οὐχ
  … ἐστιν = "Isn’t"), as Mark 6:3 does (οὐχ … ἐστιν = "Isn’t", οὐκ …
  εἰσίν = "Aren’t").
- 7:15: agree with keeping "such learning" on γράμματα (the publisher's
  row). "such" adds emphasis to the noun; it does not render any other Greek
  word. Reviewed chapters keep this kind of word on the content word (Luke
  5:6 "such + large", Mark 2:2 "in such large numbers").

## Other points checked and kept

- Supplied "the" `t` in 7:22 ("the Sabbath"), 7:23 ("the Sabbath" twice,
  "the whole man") and 7:39 ("the Spirit"): each noun has no article. This
  follows John 3:5, 3:23 and 3:29 in the same book.
- 7:39: οὔπω = "not yet", ἦν = "had + been", `t given`. The publisher's
  Greek is the same as N1904 here (no `partial`), so "given" is English
  only and makes no reading claim.
- 7:33: Ἔτι = "longer", χρόνον μικρόν = "a little while", `t only`.
  The publisher had "only" on Ἔτι and "longer" on χρόνον; the author's fix is
  right.
- 7:23 `t why`, 7:28 `t still`, 7:16 `t It comes` (ἀλλά `s`), 7:3 `t there`
  (καί "also" `s`): each English word means something its old Greek owner
  does not, so `s` + `t` is right and these are not split pairs.

## Still uncertain

- 7:4: εἶναι = "to be known" (the publisher's row, with a note). "known" is
  supplied English and could be `t`. I kept it because "to be known
  publicly" renders "to be in the open" as a whole.
- 7:36: ἐστιν ὁ λόγος οὗτος = "does He mean" is a four-word group for a
  recast. The other option, λόγος alone with ἐστιν, ὁ and οὗτος `s`, is also
  defensible.
- 7:17: πότερον = "whether" + "whether" with ἤ = "or" (the author's choice).
  The publisher's ἤ = "or whether" was not wrong either. I did not change it,
  because both are correct and the choice is one of style.
