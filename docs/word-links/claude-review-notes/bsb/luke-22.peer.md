# BSB Luke 22: independent peer review (Claude)

Checked: 71 of 71 verses (22:1-71), including 22:43-44, which N1904
double-brackets. They are linked like any other verse. I checked every `g`,
`s` and `t` line against N1904, the displayed BSB and the publisher record in
`public/data/original-languages/bsb-word-links/luke.json` (its rows in the
draft and its `partial` counts). I also checked the reviewed parallels Mark 14
and Matthew 26 and the earlier Luke chapters.
Final check: `fromtext` → `{"versesOk": 71, "problems": 0}`.

## Reading claims

The publisher record has a `partial` entry (sourceWords / matchedSourceWords /
publisherGreekWords) only for 22:7, 8, 18, 23, 24, 31, 60, 66 and 67.

- 22:7 (11/11/12): every N1904 word is matched and the publisher has one
  extra word. "on which" is linked to the dative ᾗ with the note "BSB
  follows a reading with an extra word here". Kept. The dative of time alone
  already means "on which", so this is rule 9's same-meaning case. The
  publisher row (ᾗ = which, "on" left over) cannot be followed without
  inventing a link for a word N1904 lacks.
- 22:8 (13/12/13) and 22:23 (16/15/16): one word differs on each side. The
  publisher left John and "to question" unlinked, so the notes "Same name,
  spelled differently" and "Same word, spelled differently" are right.
  Neither note names the publisher's form. Kept.
- 22:18 (21/21/22): one extra publisher word. "that" is the only English word
  the publisher left unlinked. `t that` with the reading reason is right.
  Kept.
- 22:66-67: this is a verse-division difference, confirmed by the counts.
  22:66 is 20/20/21: every N1904 word is matched and the publisher has one
  extra word. 22:67 is 17/16/16: one N1904 word is unmatched and the
  publisher has one word fewer. The publisher left "and said" at the end of
  v. 66 unlinked, and λέγοντες at the start of N1904's v. 67 unlinked. N1904's
  v. 66 has no verb of saying. So λέγοντες ends v. 66 in BSB's Greek. Kept:
  `g @22:67 0 = said` in 22:66, `m 0 > 22:66` in 22:67, and `t and#1`.
- 22:24 (12/12/12), 22:31 (12/12/12) and 22:60 (16/16/16): no Greek word is
  unmatched in either direction, so no Greek reading may be claimed. The
  author claims none. In these verses the differences are on the English
  side. For example, 22:60's publisher English has 22 words against 20
  displayed.
- All other verses have no `partial` key. No reading is claimed there.

## Changes (2 verses)

- 22:44: `g 1 2` γενόμενος ἐν = "in" → `g 2` ἐν = "in", and `s 1` = "The
  participle γενόμενος ('having come to be') is not separately expressed; in
  His anguish renders ἐν ἀγωνίᾳ." The English "in" means only ἐν. Joining the
  verb to it puts a content word on a preposition that does not mean it.
  Luke 1:2 likewise leaves an unexpressed γενόμενοι as `s`. In 22:40,
  γενόμενος keeps "When … came" because BSB does render it there.
- 22:60 (note only): `s 10` "BSB leaves παραχρῆμα ('immediately')
  unexpressed in this verse" → "BSB leaves παραχρῆμα ('immediately')
  untranslated." The words "in this verse" suggested the word is rendered in
  another verse, and it is not. The displayed BSB and the BSB audio
  transcript in the repo both have no word for it here.

Every other line, including all 167 rows the author corrected, is unchanged.

## Answers to the author's doubts

- 22:7 "on which" on ᾗ: agree (see Reading claims).
- 22:47 ἰδού = "arrived": agree, keep. The clause ἰδοὺ ὄχλος has no verb. The
  presentational ἰδού is the only thing that supplies its predicate, and
  BSB's "a crowd arrived" renders that sudden appearance. Reviewed Luke
  chapters link the presentational ἰδού the same way: Luke 5:12 καὶ ἰδού =
  "came along", 19:2 ἰδού = "there was", 13:11 = "there". Matthew 26:47 is
  different because ἦλθεν supplies "arrived" there. So `s` + `t` would be a
  split pair here.
- 22:36 μάχαιραν = "a sword + one": agree. μάχαιραν is the actual object of
  ἀγορασάτω, so "one" stands in its own slot, and BSB also reads the noun with
  ὁ μὴ ἔχων ("without a sword"). Making "a sword" `t` would leave the noun
  unlinked.
- 22:44 γενόμενος ἐν = "in": changed to `s` (above).
- 22:29 `t one`: agree, keep. βασιλείαν is normally read as the object of
  διατίθεμαι, with the καθώς clause in between. That is where BSB puts "a
  kingdom". "one" is the object English supplies for διέθετο, which has none
  expressed. This matches reviewed Mark 14:1 (`t Him`, "αὐτόν serves both
  verbs") and this chapter's 22:54 (`t Him#0`, `t Him#1`) and 22:19 (`t it`).
  Luke 18:33 links both "Him"s to one αὐτόν, so the precedent is mixed. Here
  "one" does not stand at the Greek noun's position, so `t` is right.
- 22:24 δοκεῖ εἶναι = "would be considered" and τὸ τίς = "as to which":
  agree. The publisher left all three English words unlinked only because
  of an English-side difference (16 of 17 matched). The meaning fits exactly.
- "of"/"to" moved from the article to the noun (22:1, 7, 11, 18, 22, 25, 50,
  54, 55, 66, 69): agree. This follows the brief's rule even where Mark 14
  and Matthew 26 still have "of the" on the article. The indeclinable δώδεκα
  (22:47) and Ἰσραήλ (22:30) correctly keep the case word on the article.

## Other points checked

- 22:71: `s 9` γάρ with αὐτοί = "for ourselves": agree. The English "for
  ourselves" means "personally", not "because", so the publisher's γάρ =
  "for" was a false link.
- 22:65: ἕτερα = "other + things", πολλά = "many": agree. The publisher's
  πολλά = "many other" put "other" on the wrong word.
- 22:18 `t that`, 22:43-44 linked normally: agree.
- 22:64 matches reviewed Matthew 26:68 (ὁ παίσας = "hit", ἐστιν `s`).
- 22:41 καί = "where" follows reviewed Mark 14:16.

## Still uncertain (left as the author had them)

- 22:10: εἰς ἣν εἰσπορεύεται is joined = "he enters" (English zero relative).
  `s` for εἰς ἥν would also be defensible.
- 22:39: ἐξελθὼν ἐπορεύθη is joined = "went out". The alternative is
  ἐξελθών = "went out" with ἐπορεύθη `s`.
- 22:22: μέν = "Indeed" (publisher) with ὅτι `s`. "Indeed" could be taken as
  rendering either word.
- 22:29 / 22:54 compared with Luke 18:33: the project has no single rule yet
  for an English object repeated from one Greek object.
