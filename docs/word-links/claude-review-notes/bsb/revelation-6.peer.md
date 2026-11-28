# BSB Revelation 6: independent peer review (Claude)

Checked: 17 of 17 verses (6:1-17). This chapter has no KEEP blocks.
Final check: `fromtext` → `{"versesOk": 17, "problems": 0}`.

I started from the author's final file and exported every verse with
`totext --all`. I checked every `g`, `s` and `t` line against the Greek, the
BSB English, the publisher record and the Revelation conventions
(registered Revelation 1, 3 and 4). I also checked these points:

- No lone article carries "of", "to", "from", "by" or "in".
- No supplied copula, object, noun or "there" sits on a Greek word: "It
  was" (6:4), "was" (6:8), "what sounded" (6:6), "permission" (6:4), "make"
  and "men" (6:4), "goat" (6:12) and "it" (6:17) are `t`.
- No person word sits on a participle (ἔχων "held", λέγοντος "say",
  λέγουσαν "saying", σειομένη "shaken").
- Every "a/an" goes with its noun.

I changed one link and one note, both in 6:11. Everything else stays as the
author left it.

## Changes

- 6:11 (link): οἱ μέλλοντες ἀποκτέννεσθαι = "were killed + been killed" →
  ἀποκτέννεσθαι = "were killed + been killed", and οἱ μέλλοντες is `s`
  ("BSB makes the infinitive the main verb were killed and has no word for
  οἱ μέλλοντες ("who are about to")"). The note now reads
  "ἀποκτέννεσθαι ("to be killed") is rendered were killed, and BSB repeats
  it in been killed, the verb that ὡς καὶ αὐτοί leaves understood."
  Why: "been killed" belongs to the comparison ὡς καὶ αὐτοί, where Greek
  leaves only the verb "be killed" understood. It does not repeat οἱ ("who")
  or μέλλοντες ("are about to"). Those martyrs have already been killed. With
  the whole unit, tapping "been killed" showed "who are about to be killed",
  which is a different meaning. A second English rendering may link only
  when it has the same role and meaning (Revelation 5:8 ἔχοντες). The verb
  alone meets that test, so the repeat stays linked (README rule 7, John
  15:4). BSB has no word for "who are about to", so `s` is honest. "were" is
  the passive "be" of the infinitive, not μέλλω. "had" stays `t`.
- 6:11 (note only): καί (16) was in one `s` line with καί (20), with the
  reason "BSB sets their brothers beside their fellow servants with a
  comma". That fits καί (20) only. καί (16) stands before "their fellow
  servants" ("also"/"both"), so it now has its own reason: "BSB leaves this
  καί ("also") untranslated." The reason for καί (20) is unchanged.

## Points checked and kept

- 6:1 ὡς … βροντῆς = "thunderous" and 6:12 ὡς αἷμα = "blood red": **kept**.
  The English adjective carries the comparison: "thunderous" is "like
  thunder" and "blood red" is "red like blood". So ὡς is rendered and should
  not be `s`. Registered files fold ὡς + noun into one English word the same
  way: 2 Corinthians 9:5 ὡς εὐλογίαν = "generously" and ὡς πλεονεξίαν =
  "begrudgingly"; 1 Peter 2:16 ὡς ἐλεύθεροι = "in freedom". Joins of tokens
  that are not next to each other are also registered (2 Corinthians 13:7
  ὡς … ὦμεν, Acts 16:10 ὡς … εὐθέως). φωνῇ = "in a + voice" matches the
  convention for φωνῇ.
- 6:2 ἵνα = "to", νικῶν = "overcome": **kept**. The purpose in "to overcome
  and conquer" comes from ἵνα. The publisher's νικῶν = "to overcome" put
  that purpose on a participle of manner. One "to" covers both verbs, as the
  note says. νικήσῃ = "conquer". This matches ἵνα = "to" in 6:4 and 6:11.
- 6:6: **kept**. δηναρίου = "for a denarius" (genitive of price) is the same
  pattern as registered Matthew 10:29 (ἀσσαρίου = "for a penny") and Luke
  12:6 (ἀσσαρίων = "for + pennies"). ὡς = "like" with "what sounded" `t`
  matches the convention and Revelation 4:6 ("something" `t`). μή = "not",
  ἀδικήσῃς = "do + harm" matches the prohibition convention. τόν before οἶνον
  is `s` because BSB gives the oil and the wine one "the".
- 6:8 "Its rider’s": **kept**. The compiler reads "rider’s" as one word, so
  the ’s cannot carry αὐτῷ by itself. αὐτῷ (dative of possession, "his
  name") is what the ’s renders, so it joins the rider unit and is not left
  `s`. In 6:4 the dative τῷ καθημένῳ already carries the case and αὐτῷ is
  `s`, as in the convention from 3:21. ὄνομα = "name", "was" `t`, Ὁ `s`,
  Θάνατος = "Death". μετ’ αὐτοῦ = "close behind" and θανάτῳ = "plague" (with
  its note) are kept.
- 6:15: **kept**. Each "the" sits on its own article (οἱ ×5, τά, τάς, τῶν),
  and γῆς and ὀρέων carry "of". The four καί before μεγιστᾶνες, χιλίαρχοι,
  πλούσιοι and ἰσχυροί are `s` because BSB uses commas. καί (17) = "and#0"
  and καί (20) = "and#1". "free man" stays on ἐλεύθερος (Revelation 1:17
  νεκρός = "a dead man"). ἔκρυψαν ἑαυτούς = "hid".
- Seal formula (6:1, 6:3, 6:5, 6:7, 6:9, 6:12): **consistent**. In each
  verse καί = "And"/"Then", ὅτε = "when"/"as" and ἤνοιξεν = "opened"/"open".
  The first article = "the" and the repeated attributive article is `s`.
  ἤκουσα … λέγοντος = "I heard … say" and Ἔρχου = "Come". "the Lamb" is `t`
  in 6:3, 6:5, 6:7, 6:9 and 6:12; only 6:1 has τὸ Ἀρνίον.
- Readings: **confirmed**. Only 6:8 and 6:11 have a `partial` record with a
  word difference (6:8: 44 of 45 N1904 words matched; 6:11: 29 of 30). In
  each, the only English the publisher left unlinked is "Hades" and "rest".
  So the differences are at Ἅιδης and ἀναπαύσωνται. The notes ("Same name,
  spelled differently in BSB's Greek text"; "another form of this verb …
  the meaning is the same") do not give the publisher's spelling. 6:1, 6:10
  and 6:12 have `partial` records with 0 unmatched Greek words (only English
  counts differ), so they rightly have no reading note.

## Answers to the author's doubts

- 6:1 ὡς … βροντῆς joined: agree (see above). ὡς `s` would leave a real
  comparison word unlinked when its meaning is in "thunderous".
- 6:2 ἵνα = "to": agree (see above).
- 6:10 Ἕως = "until", πότε = "How long": **kept** as split. Registered
  Matthew 17:17, Mark 9:19, Luke 9:41 and John 10:24 join ἕως πότε = "How
  long", but there English has only "How long". Here BSB has "How long …
  until", and each piece has its own Greek word. "until" is the literal
  ἕως, and "How long (until)" asks the "when?" of πότε. The split is not
  wrong, so I left the publisher row.
- 6:4 "permission" `t` and 6:12 "goat" `t`: agree. Both are English
  additions under the supplied-noun rule. This matches the Revelation
  convention for δώσω + infinitive ("the right" `t`). τρίχινος means only
  "made of hair".
- 6:8 αὐτῷ inside "Its rider’s": agree (see above).
- 6:13 βάλλει = "dropping from": **kept**. BSB turns "a fig tree casts its
  figs" into "figs dropping from a tree", and "from" belongs to that recast
  of βάλλει. συκῆ is nominative and has no case that could carry "from".
  `t` would also be defensible, but the publisher row is not wrong.

## Other checks

- 6:11: πληρωθῶσιν = "the full number of" is kept. BSB turns the verb ("be
  made complete") into this noun phrase, and no other Greek word owns "the …
  of". "of" is correctly off αὐτῶν (= "their#0"). ὡς = "just as" with καί
  (28) `s` follows the registered majority (Acts 10:47, Hebrews 3:2, 2 Peter
  2:1). αὐτοῖς = "of them" with ἑκάστῳ = "each" is kept.
- 6:10: ὁ = "O" before Δεσπότης is kept; registered Hebrews 1:8 does the
  same. οὐ and ἐκ are `s` because BSB recasts the negative question and makes
  those who dwell the object of "judge". This is not a split pair, since
  there is no "not" or "from" in the English.
- I found nothing in the Revelation conventions that I think is wrong for
  this chapter.

## Still uncertain

- 6:11: the other defensible choice keeps οἱ μέλλοντες ἀποκτέννεσθαι joined
  = "were killed" (like registered 1 Peter 5:1 μελλούσης ἀποκαλύπτεσθαι = "to
  be revealed") and makes "been killed" `t` with "had". I chose the split
  because it keeps the understood verb linked without showing "about to"
  under a past killing.
- 6:10: joining Ἕως πότε = "How long + until" would match the four Gospel
  rows. I kept the split, since it is not wrong and both choices are honest.
