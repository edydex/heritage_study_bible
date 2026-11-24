# BSB Acts 21: independent peer review (Claude)

Checked: 40 of 40 verses (21:1-40). I checked every `g`/`s`/`t` line against
N1904, BSB's English and the publisher record in
`public/data/original-languages/bsb-word-links/acts.json`. 21:8, 21:14,
21:16, 21:20, 21:27 and 21:28 have a `partial` record. The chapter has no
KEEP verses. Final check: `fromtext` → `{"versesOk": 40, "problems": 0}`.

## Changes (10 verses, 25 lines)

### "We" on the finite verb, not on the participle

The author note says that participles keep the "we" BSB gives them "as Acts
16:11". The reviewed Acts 16:11 rules the opposite way. The 16:11 peer moved
"We" off the participle Ἀναχθέντες onto the finite verb εὐθυδρομήσαμεν,
because "neither first person nor the imperative mood can come from a
participle". A third-person "he/they" on a participle remains the corpus
convention (21:11 he took, 21:30 They seized, 21:31 they were trying), and
none of those changed. The first-person rows now follow 16:11:

- 21:1: `g 4 = we#1` → `g 4 = we#0`; `g 5 = we#0 had torn ourselves away` →
  `g 5 = had torn ourselves away`; `s 9` (ἤλθομεν absorbed) → `g 9 = we#1`.
  ἡμᾶς is the subject of the Ὡς clause, and the participle ἀποσπασθέντας
  agrees with it, so the first "we" is ἡμᾶς. The second "we" is the subject
  of the main clause, and only the ending of ἤλθομεν supplies it. ἀναχθῆναι
  = sailed and εὐθυδρομήσαντες = directly stay as they are (the same split
  as 16:11). So ἤλθομεν keeps "we", and its "came … to" is carried by
  sailed … to.
- 21:2: `g 6 = we boarded`, `g 7 = set sail` → `g 6 = boarded`,
  `g 7 = we + set sail` (ἀνήχθημεν).
- 21:4: `g 0 = We sought out`, `g 4 = stayed` → `g 0 = sought out`,
  `g 4 = We + stayed` (ἐπεμείναμεν).
- 21:5: `g 7 = we set out`, `g 8 = on our journey` → `g 7 = set out`,
  `g 8 = we + on our journey` (ἐπορευόμεθα).
- 21:7: Ἡμεῖς `we#1` → `we#0`; διανύσαντες `When we had finished` →
  `When + had finished`; κατηντήσαμεν `landed` → `we#1 landed`;
  ἀσπασάμενοι `we#2 greeted` → `greeted`; ἐμείναμεν `stayed` →
  `we#2 + stayed`. The explicit pronoun takes the "we" of the participle
  clause, and each finite verb takes its own "we".
- 21:15: `g 5 = we packed up`, `g 6 = went on` → `g 5 = packed up`,
  `g 6 = we + went on` (ἀνεβαίνομεν).
- 21:10: `g 0 = After we had been` → `g 0 = After + had been`, and a new
  `t we = English supplies the subject; …`. The genitive absolute
  Ἐπιμενόντων has no ἡμῶν, and the verse has no first-person verb.

### Other changes

- 21:22: `g 2 = should we do` → `g 2 = should + do`, and a new `t we =
  English supplies a subject; ἐστιν is impersonal here.` The link itself is
  an honest recast, because BDAG gives τί οὖν ἐστιν as "what then is to be
  done?" (also 1 Cor 14:15, 26). Acts 10:17 likewise links τί ἂν εἴη to
  "the meaning". But a 3rd singular impersonal ἐστιν cannot supply "we". It
  is the same kind of supplied subject as "they" in 21:37, which the author
  already made `t`.
- 21:25: `g 9 = that they` → `g 9 = they`; `g 7 = our decision` →
  `g 7 = decision that`; `g 5 = we` → `g 5 = we + our`. "that" never
  rendered αὐτούς. It introduces the content of the decision, like
  "ordering that"/"ordered that" on ἐκέλευσεν in 21:33-34. "our" is first
  person, so it cannot come from the participle κρίναντες. ἡμεῖς is the
  subject that ἐπεστείλαμεν and κρίναντες share in one clause. That is the
  shared-argument case where the corpus links one word twice (Acts 9:25,
  16:3, 16:37).
- 21:27: `g 10 = province of Asia` → `g 10 = Asia`, and a new `t province of
  = BSB adds that Asia was a Roman province.` The author cited Acts 16:6,
  but the reviewed 16:6 (and 6:9) make "province of" `t`.

## Answers to the author's doubts

- 21:1 ἤλθομεν `s`: **disagree, changed** (see above). ἤλθομεν = we#1, and
  ἡμᾶς moves to we#0.
- 21:11 "him" in owner of + him: **agree, kept**. Τὸν ἄνδρα is fronted as
  the object of δήσουσιν. In the same clause, παραδώσουσιν takes it as its
  object too. That is one object shared by two verbs, which is the Acts 12:4
  pattern (ὅν = him + him). "him" has the same role (accusative object) and
  referent, so it links to that group.
- 21:22 ἐστιν = should we do: **partly changed**. The recast link stays,
  but "we" is now `t`.
- 21:27 οἱ `s` and "some" `t`: **agree**. "some" is indefinite and the
  article is definite, so "some" does not render οἱ. That is the brief's
  "means something else" case (like "and" for ὅταν).
- 21:34 δέ `s` and "and" `t`: **agree**. δέ links the verse to 21:33 and
  BSB leaves it out. The "and" only joins the two halves of the expanded
  ἄλλοι … ἄλλο τι idiom.
- 21:35 συνέβη = had to: **agree, kept, with doubt**. συνέβη is the
  governing verb of βαστάζεσθαι, and BSB's "had to" holds the same place
  ("it came about that he was carried" → "he had to be carried"). It is the
  only Greek word that "had to" could render. The note shows the shift.
- 21:32 οἱ = the people: **agree**. It is a pronoun-use article (οἱ δέ)
  that BSB names, as in Acts 3:5 ("the man") and 7:2 ("Stephen"). It is not
  a lone article that carries a noun.
- 21:26 ἕως οὗ `s` and "and" `t`: **agree**. "and" coordinates the
  offering with the completion date. ἕως οὗ means "until", so the
  conjunction's meaning changes, and `s` + `t` is right by the brief.
- 21:24: **confirmed**. ὅτι = that + that is right, because ἀλλὰ στοιχεῖς …
  is still inside the ὅτι clause (same role and meaning). οὐδέν = no truth
  to is right: "is nothing" is rendered idiomatically. ἐστιν = there is is
  right: the existential "there" belongs to rendering the εἰμί, as with
  εἰσίν = There are in 21:23. It is not an added locative "there".

## Readings checked against the record

- 21:8 and 21:16 (Caesarea), 21:20 (εἶπάν), 21:27 (ἐπέβαλαν) and 21:28
  (Ἰσραηλεῖται): each record shows 1 unmatched N1904 word and 1 publisher
  word not in N1904. In each verse the publisher left exactly that word and
  its English unlinked. The notes say only "spelled differently in BSB's
  Greek text" and name no publisher spelling. Kept.
- 21:14: 11 of 11 Greek words matched, so no reading. The 2 unmatched
  English words are only translation choices. No reading claim is made, and
  that is right.

## Still uncertain

- 21:35 συνέβη = had to (see above). Another reviewer could reasonably
  choose `s` + `t`.
- 21:31 "Roman regiment" stays on σπείρης. Like κολωνία in 16:12, a σπεῖρα
  in Acts is a Roman cohort (see the note in 10:1). A reviewer who reads
  "Roman" as added, like "province of", could make it `t`.
- 21:1 ἀναχθῆναι = sailed vs εὐθυδρομήσαντες = sailed directly: I kept the
  publisher's and 16:11's split and did not change it for taste.
- 21:10 "we" `t`: this applies the 16:11 rule to a genitive absolute that
  has no pronoun. A third-person "they" in the same position stays linked
  (21:31, Matthew 17:14).
