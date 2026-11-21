# BSB Matthew 24: independent peer review (Claude)

Checked: 51 of 51 verses (24:1-51).

Check after the changes: `fromtext` → `{"versesOk": 51, "problems": 0}`.

8 changes in 7 verses: 4 link changes and 4 reason texts that claimed or
implied a textual difference that is not there.

To test the textual claims I used the publisher's own rows for Matthew 24
(`git show a8ec878:public/data/original-languages/bsb-word-links/matthew.json`).
A verse without a `partial` record has a publisher Greek table identical to
N1904, word for word. That holds for 24:2, 24:6, 24:26 and 24:38. In 24:31
the publisher's Greek has one word more than N1904 (24 against 23). The one
English word left unlinked there is "the" before "other". The extra word is
τῶν (Westcott-Hort / NA27: ἕως τῶν ἄκρων αὐτῶν).

## Changes

Link changes:

- 24:26: ἐστίν = "He#0 is + He#1 is" → "He#0 is", plus `t He#1 is`. ἐστίν
  belongs to the first saying. The second saying, Ἰδοὺ ἐν τοῖς ταμείοις, has
  no verb, just like Ὧδε in 24:23, where the author already made "He is" `t`.
  The old link pointed readers from the second saying to a word in the first.
- 24:31: ἄκρων αὐτῶν = "the#2 other" → "other", plus `t the#2`. BSB follows
  ἕως τῶν ἄκρων αὐτῶν, and its "the" renders that τῶν, which N1904 lacks
  (rule 9). The publisher's own rows leave this "the" unlinked for the same
  reason.
- 24:37: ἔσται = "will + be", with `t it#1` → ἔσται = "will it be".
- 24:39: ἔσται = "will + be", with `t it` → ἔσται = "will it be".
  For 24:37 and 24:39: the dummy subject goes with the verb, as with "there
  will be" / "there is" for ἔσται / ᾖ in 24:7, 21, 28 and 51. It also matches
  the same BSB phrase "so will it be at the end of the age" in Matthew 13:40
  (ἔσται = "will it be") and "will it be" in 12:45. "at" stays `t`; see below.

Reason texts:

- 24:2: Οὐ `s` "BSB renders the question … without the negative" → "Not a
  different reading: BSB turns the negative question Οὐ βλέπετε ("Do you not
  see") into a positive one, leaving Οὐ untranslated." The publisher's Greek
  has Οὐ (identical table) and gives it no English. N1904, NA and the
  Byzantine text all have Οὐ. So this is a translation choice, not a reading.
- 24:6: `t These things` "… which has none in N1904" → "English supplies a
  subject; δεῖ γενέσθαι ("must happen") has none." BSB's Greek is identical,
  so it has no πάντα. The Byzantine δεῖ γὰρ πάντα γενέσθαι would give "all
  these things", which BSB does not have.
- 24:26: `t or` "N1904 has no conjunction" → "the Greek has no conjunction
  between the two sayings." BSB's Greek is identical, and no ἤ stands there.
- 24:38: ἐκείναις `s` "BSB does not render ἐκείναις, which some manuscripts
  omit" → "BSB leaves ἐκείναις ("those") untranslated; its own Greek has the
  word, though some manuscripts omit it." The publisher's Greek table includes
  the word but gives it no English. So BSB does not follow the shorter reading.

## Answers to the author's doubts

- 24:1 "As" with ἐξελθών: **agree.** This is how 9:27, 17:9, 18:24, 20:17
  and 20:29 link "As": with the participle or genitive absolute, as As + verb.
  The καί before προσῆλθον stays `s`, and "and" between "left" and "was
  walking away" stays `t`, as in Matthew 21.
- 24:17, 24:18 ὁ = one, μή = no: **agree.** Separate links show readers that
  the negative belongs to the imperative.
- 24:37, 24:39 "it" and "at": **partly changed.** "it" now joins ἔσται (see
  above). "at" stays `t`, and so does "it was in" in 24:37. In 13:40 "at"
  renders ἐν, but here ἡ παρουσία is a nominative subject with no
  preposition. "at" comes only from BSB recasting the subject as an
  adverbial phrase. A lone article cannot carry it (the publisher's ἡ = "at
  the"), and putting "at" on παρουσία would give the noun a preposition it
  does not have. ἡ = the and παρουσία = coming are right.
- 24:21 "again", 24:33 "right at", 24:2 "one stone", 24:43 "of the night":
  **agree.** "again" has no counterpart: γένηται only says "happen". The other
  three are BSB's renderings of one Greek word each (ἐπί, λίθος, φυλακή) and
  are not over-claims.
- 24:31 "trumpet call": **agree, keep on σάλπιγγος.** The one extra word in
  the publisher's Greek is τῶν, not φωνῆς, so BSB does not follow σάλπιγγος
  φωνῆς μεγάλης. "call" is idiomatic English for the trumpet (ESV has the
  same), and the publisher links "trumpet call" to σάλπιγγος too.
- 24:46 ὃν … αὐτοῦ = whose + him: **agree.** "whose" combines ὅν (the
  relative) and αὐτοῦ (possession), and "him" renders ὅν as the object. One
  joint group is the honest pairing.

Other points the coordinator asked about: 24:3 τῆς = "the" before "end" is
right, because the one article governs both παρουσίας and συντελείας.
24:38 and 24:6 are covered above.

Vocatives: Matthew 24 has no vocative, so the later instruction to link
"You" with a vocative changes nothing here.

## Still uncertain

- 24:31: τῶν is identified from the publisher's word count, the one unlinked
  "the" and the Westcott-Hort/NA27 text. I did not see the publisher's table
  row itself.
- 24:30: the publisher's Greek again has one word more than N1904, but every
  English word is linked, so no `t` is needed. The extra word is probably an
  article.
- 24:29, 24:50: "of" sits on the demonstrative ("of#0 those", "of that")
  while the article is `s`. This follows the publisher and is acceptable,
  since all three Greek words are genitive.
- 24:9: "deliver you over to be persecuted and killed" folds the second
  verb's ὑμᾶς into one "you". This is kept as the author linked it, ὑμᾶς … ὑμᾶς
  = you.
