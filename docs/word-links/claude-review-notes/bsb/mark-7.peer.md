# BSB Mark 7: independent peer review (Claude)

Checked: 36 of 36 verses (7:1–37; 7:16 is empty in both texts). This
includes 7:36 from the earlier review.

Final check: `fromtext` → `{"versesOk": 36, "problems": 0}`.

I read every `g`, `s` and `t` line against N1904 and the displayed BSB.
I checked the textual claims against the publisher rows and the `partial`
word counts in `public/data/original-languages/bsb-word-links/mark.json`.

## Changes (8 in 6 verses: 7 link changes, 1 note-only)

Five article + participle units were still split. Rule 3 joins them, as
Mark 4:16 and 4:18 already do when other words stand between the article
and the participle. Left split, the article alone stood under "Anyone
who", "What" or "the things".

- 7:10: Ὁ = "Anyone who", κακολογῶν = "curses" → Ὁ κακολογῶν = "Anyone
  who curses".
- 7:15: τά = "the things", ἐκπορευόμενα = "that come" → τὰ … ἐκπορευόμενα
  = "the things that come".
- 7:15: τά = "what", κοινοῦντα = "defile" → τὰ κοινοῦντα = "what defile".
- 7:18: τό = "that", εἰσπορευόμενον εἰς = "enters" → τὸ … εἰσπορευόμενον
  εἰς = "that enters". The note now covers the article.
- 7:20: Τό = "What", ἐκπορευόμενον = "comes" → Τὸ … ἐκπορευόμενον = "What
  comes".

Other changes:

- 7:13: πολλά = "in many" → πολλά = "many", plus `t in`. πολλά is the
  direct object of ποιεῖτε, so "in" comes only from BSB's recast ("you do so
  in many such matters"). Linked to πολλά, it showed "many" under "in".
  This answers the author's doubt.
- 7:36 (earlier review): διεστείλατο = "Jesus ordered" → "ordered", plus
  `t Jesus`. The Greek gives the subject only in the verb ending (rule 7).
  This is how the chapter treats the supplied "Jesus" in 7:14, 7:17, 7:24,
  7:29, 7:31 and 7:33.
- 7:36 (note only): I removed the three-sentence note on αὐτοῖς = "them".
  The link is obvious, and the note described the publisher's rows rather
  than the text. Matthew 18:21 got the same cleanup.

The author's 52 corrections of publisher rows are right. They include the
supplied "Jesus"/"The people" and participle "and" moved to `t`, the
negatives taken out of verbs, κατ’ ἰδίαν = "privately" with ἀπολαβόμενος =
"took + aside" (7:33), ἀνὰ μέσον = "into" (7:31), ἡ = "she" (7:28), and
"devoted to God", "on returning" and "including" made `t`.

## Textual claims

- 7:4: N1904 has 21 words, 20 of them matched, and the publisher has 23.
  So one N1904 word has no exact counterpart and the publisher has three
  that N1904 lacks. That fits βαπτίσωνται in place of ῥαντίσωνται, plus
  καὶ κλινῶν. The publisher rows link nothing to "they wash" or to "couches
  for dining". The claim holds.
- 7:21/7:22: 15/15/16 and 10/9/9. The publisher's 7:21 has one extra word
  and its 7:22 lacks one N1904 word. This is μοιχεῖαι moved across the
  verse break, a verse-division difference only.
- 7:24 (19/18/19): one word is spelled differently. The note says ἠδυνάσθη
  is an alternative form, and the word is linked normally.
- 7:37 (15/15/16): the publisher has one extra word, τοὺς before ἀλάλους
  (`t the#1`).
- No other verse has a `partial` key, and no other reason claims a
  different reading.

## Answers to the author's doubts

- 7:4, `s` ῥαντίσωνται + `t they wash`: **agree.** The counts show a
  different word in this slot, not just a different wording. Linking
  "wash" to ῥαντίσωνται would show "sprinkle" under "wash". This is the
  Matthew 19:29 case (πολλαπλασίονα / "a hundredfold"), so the pair is not
  a split pair. `t and couches for dining` is also right: N1904 has no
  κλινῶν, and "for dining" is BSB's gloss on it.
- 7:17, εἰσῆλθεν = had + gone, εἰς = into, ἀπό = "left": **agree.** BSB
  turns "away from the crowd" into "had left the crowd". Leaving ἀπό `s`
  with `t left` would create a split pair. "had" belongs to the Greek
  verb's tense, which BSB uses for both clauses. `t and` is right.
- 7:15, τοῦ ἀνθρώπου = "a man", εἰς joined to "enters", αὐτόν `s`:
  **agree.** "man" should show ἄνθρωπος. Linking εἰς αὐτόν would show
  "him/into" under "a man".
- 7:18, καί = "still": **agree.** No other Greek word gives "still".
  Leaving καί `s` with `t still` would create a split pair. The note gives
  the literal sense.
- 7:19, "it goes" on εἰσπορεύεται: **agree.** The one verb governs both
  clauses. Reviewed chapters link a gapped verb to its second English form,
  including a different English verb: εἰσελθεῖν = "to pass + to enter"
  (Matthew 19:24), ἦν = "was + were" (Matthew 28:3).
- 7:23, "these" on κοινοῖ with `t are what`: **agree.** The subject is
  only in the verb ending (rule 4). In 7:15 the subject is written out
  (τὰ … ἐκπορευόμενα), so `t these` there is consistent.
- 7:3, γάρ = "Now" and πυγμῇ = "ceremonially": **agree.** Both are BSB's
  renderings, and each has a note.
- 7:13, "in" of "in many": **disagree**, changed to `t` (see above).
- 7:21/7:22, `g @7:22 0` + `m 0 > 7:21`: **agree** (see the counts above).
- 7:26, ἡ γυνή = "she" and Ἑλληνίς = "a Greek woman": **agree.**
  Ἑλληνίς is itself the feminine noun "Greek woman". γυνή is the Greek
  subject, and BSB renders the subject as "she". The publisher's γυνή =
  "woman" put the subject noun into the English predicate.

## Still uncertain (left unchanged)

- 7:13: παρόμοια = "such matters" and τοιαῦτα = "so" (publisher rows).
  τοιοῦτος is the usual word for "such", so the reverse mapping is also
  defensible. Neither mapping misleads.
- 7:36: ἵνα μηδενὶ λέγωσιν = "not to tell anyone" is one unit from the
  earlier review. Splitting it would match 7:24, 7:26 and 7:32 (ἵνα …
  λέγωσιν = "to tell", μηδενί = "not + anyone"). The unit is accurate, so
  it was left.
- 7:9 links ἵνα = "to" and τηρήσητε = "maintain" separately, while 7:26 and
  7:32 join ἵνα + subjunctive. Both treatments are accurate.
- 7:11, `t devoted to God`: in this sense Δῶρον means a temple offering, so
  the publisher's whole-phrase link was also defensible. The `t` is kept
  because no Greek word gives "God".
- 7:15, 7:18, 7:20, 7:23: the generic article is linked to "a" ("a man"),
  following the publisher rows. `s` would be the stricter choice.
