# BSB Acts 16: author review (Claude)

Verses reviewed: all 40 (16:1-40). No KEEP blocks in this chapter. Final
check: `fromtext` → `{"versesOk": 40, "problems": 0}`.

137 of the 591 publisher `g` rows changed, in 38 verses (16:2 and 16:36
kept every publisher row and only resolved TODO tokens). 15 rows only gained
a token, with the English unchanged: 16:1 ἰδοὺ … ἦν = he found; 16:3 σὺν …
ἐξελθεῖν = to accompany; 16:4 τὰ κεκριμένα = handed down; 16:5 καθ’ ἡμέραν =
daily; 16:7 εἰς … πορευθῆναι = to enter; 16:9 ἦν ἑστώς = standing; 16:10
ὡς … εὐθέως = As soon as; 16:11 Νέαν Πόλιν = Neapolis; 16:12 Ἦμεν …
διατρίβοντες = we stayed, ἐν ταύτῃ τῇ πόλει = there; 16:14 ὑπὸ Παύλου =
Paul's; 16:16 Ἐγένετο δέ = One day; 16:21 οὐκ ἔξεστιν = are unlawful (as
Matthew 12:2); 16:37 ἀνθρώπους Ῥωμαίους = Roman citizens, οὐ γάρ =
Absolutely not.

## Publisher rows corrected

English words with no Greek counterpart that had been folded into a Greek
word (now `t`):

- Participle "and" (18 rows): 16:3 and circumcised, 16:8 and went down,
  16:9 and help, 16:15 and stay, 16:18 and said, 16:19 and dragged, 16:20
  and said, and are throwing (Ἰουδαῖοι ὑπάρχοντες), 16:22 and beaten,
  16:23 and ordered, 16:25 and singing, 16:27 and was about, 16:30 and
  asked, 16:33 and washed, 16:34 and set, 16:37 and threw, and escort,
  16:40 and encourage.
- Supplied subjects: 16:1 and 16:10 "Paul", 16:29 and 16:33 "the jailer",
  16:32, 16:38 and 16:40 "Paul and Silas", 16:18 "the spirit" (verb ending
  only); 16:12 "we went" (no Greek verb; 16:11 continues).
- Supplied objects: 16:15 "us" (παρεκάλεσεν), 16:18 "her" (ἐξῆλθεν),
  16:19 "them" (dragged), 16:23 "them" (threw; αὐτοῖς is the dative of
  ἐπιθέντες), 16:34 "them" (set before), 16:40 "the city" (ἐξῆλθαν).
- BSB additions: 16:17 "the rest of" (Paul and us), 16:25 "other"
  (prisoners, as Acts 9:39 "other"), 16:40 "house" (Lydia's), 16:9 "of"
  (vision of a man; the Greek starts a new clause).

Lone articles carrying a preposition (the article keeps "the", the
preposition goes on the noun): 16:5 τῇ "in the", 16:13 τῇ "On the" and
ταῖς "to the", 16:14 τόν "of" and τοῖς "to", 16:15 τῷ "in the", 16:17 τοῦ
"of the", 16:18 τῷ "to the", 16:19 τῆς "of", 16:20 τοῖς "to the", 16:25
τόν "to", 16:26 τοῦ "of the", 16:32 τοῦ "of the", 16:33 τῆς "of the", 16:38
τοῖς "to the"; 16:12 τῆς "of that" (now τῆς = that, μερίδος = of +
district). Also 16:33 οἱ alone carried the noun "household": οἱ αὐτοῦ
("those of his") is now joined = his household.

Prepositions moved from an adjective to its noun: 16:1 "of" (πιστῆς →
γυναικός), 16:23 "with" (πολλάς → πληγάς), 16:28 "in" (μεγάλῃ → φωνῇ).

"When/As/After" moved to the participle or genitive absolute: 16:6 "After"
(from τοῦ to κωλυθέντες), 16:13 "After" (from καί to καθίσαντες), 16:16
"as" (from ἡμῶν to πορευομένων), 16:19, 16:27 and 16:35 "When" (from δέ to
Ἰδόντες, ἔξυπνος γενόμενος, Ἡμέρας γενομένης).

Other words on the wrong Greek word:

- 16:3 "him" twice: αὐτόν = him + him (the one object serves λαβών and
  περιέτεμεν, as Acts 9:25); likewise 16:37 ἡμᾶς = us + us, 16:39 αὐτούς =
  them + them, 16:40 ἀδελφούς = brothers + them.
- 16:3 ἅπαντες = all (had been folded into ᾔδεισαν "they all knew").
- 16:4 "from" moved from διεπορεύοντο to πόλεις (from town to town).
- 16:7 κατά = to + border, τήν = the, Μυσίαν = of Mysia; οὐκ = not with
  would + permit.
- 16:13 "it" moved from οὗ to ἐνομίζομεν (it was customary).
- 16:14 "was" moved from τις to ἤκουεν (Among those listening was).
- 16:15 "she" moved from καί to ἐβαπτίσθη; 16:34 "he" moved from πανοικεί
  to ἠγαλλιάσατο.
- 16:16 "for" moved from αὐτῆς to κυρίοις.
- 16:18 καί = so + that (BSB's result clause joins the two participles;
  "so" had been on διαπονηθείς); αὐτῇ τῇ ὥρᾳ = very / that / at + moment,
  as Luke 13:31, 20:19, 24:33 ("at that" had been on αὐτῇ, "very" on
  ὥρᾳ).
- 16:20 "them" moved from προσαγαγόντες to αὐτούς; "into turmoil" moved
  from πόλιν to ἐκταράσσουσιν.
- 16:22 περιρήξαντες … τὰ ἱμάτια = be stripped, αὐτῶν = they.
- 16:24 ὅς = he (8:27 precedent), ἔβαλεν = placed.
- 16:29 "before" moved from ἔντρομος to προσέπεσεν; ἔντρομος γενόμενος
  joined = trembling.
- 16:31 οἱ = They (article as pronoun), εἶπαν = replied.
- 16:34 παρέθηκεν = set + before, τράπεζαν = a meal.
- 16:37 ἡμᾶς (19, 26) linked to us; ἐκβάλλουσιν = do they want to send +
  away, ἐξαγαγέτωσαν = escort + out.

## Readings

- 16:32 τοῦ Θεοῦ: BSB's "of the Lord" follows a different reading (the
  EVIDENCE line shows one unmatched N1904 word and one extra publisher
  word; probably κυρίου). Both tokens `s` and "of the Lord" `t`, as John
  4:1.
- 16:33 ἅπαντες: the publisher's Greek has another form of this word
  (probably πάντες); "all" is linked with the same-meaning note.
- 16:9, 16:14, 16:28, 16:29 each show one extra publisher word (probably an
  article: τῆς before νυκτός, τοῦ before Παύλου, ὁ before Παῦλος, τῷ before
  Σιλᾷ). No reading is claimed; 16:9 "the night" is linked to νυκτός as in
  Acts 5:19.
- 16:23 shows one unmatched and one extra word, probably only an accent
  difference in πολλάς; "many" is linked with no note.

## Notable decisions

- "We" passages: "we/us" are linked to the verb endings and pronouns
  (16:10 ἐζητήσαμεν, ἡμᾶς; 16:12 Ἦμεν … διατρίβοντες; 16:13 ἐξήλθομεν,
  ἐλαλοῦμεν; 16:15 ἡμᾶς; 16:16 ἡμῶν, ἡμῖν; 16:17 ἡμῖν). 16:11 keeps the
  publisher's "We sailed" on the participle Ἀναχθέντες and "straight" on
  εὐθυδρομήσαμεν.
- Names and places linked despite spelling: Derbe, Lystra, Iconium,
  Timothy, Phrygia, Galatia (Γαλατικήν "Galatian"), Mysia, Bithynia,
  Troas, Samothrace, Neapolis (Νέαν Πόλιν joined), Philippi, Macedonia,
  Lydia, Thyatira. 16:6 Ἀσίᾳ = "province of Asia", τῇ = the.
- Scene openers: 16:16 Ἐγένετο δέ = One day (Luke 1:8, 16:22); 16:18 δέ =
  Eventually; δέ `s` where BSB opens with a time phrase (16:25, 16:35).
- 16:1 καὶ ἰδοὺ … ἦν: ἰδού and ἦν jointly = he found (8:27 ἰδού = he met);
  the καί before it `s` (BSB joins with where).
- 16:10 ὡς … εὐθέως jointly = As soon as.
- Pronouns BSB renames are linked: 16:3 τοῦτον = Timothy, 16:19 αὐτῆς =
  the girl's, 16:22 αὐτῶν = Paul and Silas, 16:37 αὐτούς = the officers,
  16:4 αὐτοῖς = for the people, 16:2 ὅς = him.
- 16:2 and 16:6 ὑπό `s`: BSB turns the passive into an active.
- 16:13 τε `s` (a sentence connective, not τε … καί); 16:34 τε = Then.
- 16:21 καί = by and 16:38 δέ = who kept (connectives BSB renders with
  another linking word; 9:27 καὶ ὅτι = who).
- 16:26 ἐγένετο and ὥστε `s`: "a great earthquake happened, so that the
  foundations were shaken" becomes "a strong earthquake shook the
  foundations".
- 16:36 ἐξελθόντες `s` (go on your way renders πορεύεσθε); τοὺς λόγους
  τούτους `s`; πρὸς τόν `s` (absorbed by informed).

## Doubts for the peer

- 16:11 "We sailed" on Ἀναχθέντες and 16:37 "Let them come" on ἐλθόντες
  (kept publisher rows): the person ending or the jussive belongs to the
  finite verb, but the participle takes on its role, as with "they seized"
  in 16:19.
- 16:39 αὐτούς = them + them and 16:40 ἀδελφούς = brothers + them: the
  understood object crosses a καί in 16:39; the alternative is `t` for the
  second pronoun.
- 16:38 δέ = who: "who" could instead go on ἐφοβήθησαν (the verb's
  subject), with δέ `s`.
- 16:17 "the rest of" and 16:40 "house" made `t`; 16:6 "province" and
  16:12 "Roman" kept inside the place-name rows.
- 16:1 ἰδού + ἦν joined for "he found"; the alternative is ἰδού alone
  (8:27) with ἦν `s`.
