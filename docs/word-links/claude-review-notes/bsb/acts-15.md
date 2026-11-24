# BSB Acts 15: author review (Claude)

Verses reviewed: all 40 drafted verses (15:1-33 and 15:35-41). 15:34 is in
neither N1904 nor BSB's main text, so it is not in the file. There were no
KEEP blocks. Final check: `fromtext` → `{"versesOk": 40, "problems": 0}`.

134 of the 563 publisher `g` rows changed, in 38 verses. 15:18 and 15:41
kept every publisher row, and 15:41 only resolved one TODO article. Some rows
only gained a token, with the English unchanged: 15:1 Ἐὰν μή = Unless, οὐ
δύνασθε = you cannot; 15:2 ἐξ αὐτῶν = believers; 15:6 ἰδεῖν περί = to look
into; 15:7 and 15:13 Ἄνδρες ἀδελφοί = Brothers; 15:11 καθ’ ὃν τρόπον = just
as; 15:13 Μετὰ τό = When; 15:17 ὅπως ἄν = so that, ἐφ’ οὕς = who; 15:20 τοῦ
ἀπέχεσθαι = to abstain from; 15:27 διὰ λόγου = in person; 15:36 ἐν αἷς =
where; 15:39 ἀπ’ ἀλλήλων = company. These article + participle units were
also joined (rule 3): 15:3 Οἱ … προπεμφθέντες, 15:19 τοῖς … ἐπιστρέφουσιν,
15:21 τοὺς κηρύσσοντας, 15:22 and 15:37 τὸν καλούμενον, 15:30 Οἱ …
ἀπολυθέντες, 15:33 τοὺς ἀποστείλαντας, 15:38 τὸν ἀποστάντα.

## Publisher rows corrected

Lone articles carrying a preposition or noun (all moved; the article keeps
"the" and the preposition goes on its noun):

- "of the": 15:3 τῶν ἐθνῶν, 15:5 τῶν Φαρισαίων, 15:7 τοῦ εὐαγγελίου, 15:10
  τῶν μαθητῶν, 15:15 τῶν προφητῶν, 15:35, 15:36 and 15:40 τοῦ Κυρίου. 15:11
  τοῦ had "of" (now τοῦ = the, Κυρίου = of + Lord).
- "to the": 15:23 τοῖς (now ἀδελφοῖς = To + brothers), 15:28 τῷ Πνεύματι,
  15:40 τῇ χάριτι. "according to the": 15:1 τῷ ἔθει (now ἔθει = according to
  + custom).
- Others: 15:9 τῇ had "by" (now πίστει = by faith); 15:14 τῷ had "to be"
  (now ὀνόματι = to be + own); 15:20 τῶν had "food" (now ἀλισγημάτων = food
  polluted) and τοῦ had "from" (now αἵματος = from blood).
- 15:30 Οἱ had the noun "men"; it is now joined with ἀπολυθέντες as "the men
  were sent off".

"When/On/As" on a connective: 15:4 "On" moved from δέ to παραγενόμενοι ("On
their arrival"); 15:31 "When" moved from δέ to ἀναγνόντες.

Participle "and" (now `t`): 15:1 were teaching, 15:5 declared, 15:7 said,
15:21 is read, 15:30 went down and delivered, 15:36 visit, 15:39 sailed,
15:40 left.

English-only words that had been folded into a Greek word (now `t`):

- Supplied objects, subjects and places: 15:14 "us" (has told), 15:27 "you"
  (to tell), 15:31 "the people" and "it", 15:33 "there", 15:23 "your"
  (brothers), 15:39 "Their", 15:22 "two" (leaders).
- Supplied frames: 15:11 "it is" (cleft), 15:19 "It is" (It is my
  judgment), 15:25 "So" (no connective in the Greek), 15:27 "we are writing"
  (τὰ αὐτά is only "the same things").
- Supplied verbs after πρός or πῶς: 15:2 "see", 15:33 "to return", 15:36 "to
  see".
- 15:22 "They" of "They chose" (chose now links to ἐκλεξαμένους as the verb
  understood again).

Words on the wrong Greek word:

- 15:2 δέ = And, γενομένης = after (the row had "And after" on the
  participle); οὐκ ὀλίγης = sharp, ζητήσεως = in + debate ("in sharp" had
  been on ὀλίγης); τῷ Παύλῳ καὶ τῷ Βαρνάβᾳ `s` (BSB names them once, as
  those appointed).
- 15:7 "that" moved from τά to ἀκοῦσαι (that … would hear).
- 15:8 ὁ had "who"; καρδιογνώστης is now "who knows the heart" and ὁ `s`.
  ἡμῖν had "He did to us": now to us, with "did" on δούς (the giving
  repeated) and "He" `t`. καί had "just": καθώς = just as, καί `s` (as the
  Acts 11 peer decided for ὥσπερ).
- 15:11 κἀκεῖνοι had "they are": "are" is the repeated σωθῆναι.
- 15:12 "they" moved from καί to ἤκουον.
- 15:14 ἐπεσκέψατο had "visited the Gentiles" and ἐθνῶν had "them": ἐθνῶν =
  the Gentiles (moved forward by BSB), "them" `t`.
- 15:17 μου had "by My": ὄνομα = by + name, μου = My.
- 15:20 ἐπιστεῖλαι = we should write and tell (αὐτοῖς had "and tell them");
  the καί words had "from" (now on each noun, as BSB's own 15:29 rows).
- 15:23 γράψαντες had "and sent them with" and χειρός "this letter":
  γράψαντες = this letter, διὰ χειρός = sent + with, αὐτῶν = them.
- 15:24 Ἐπειδή had "It has come to our attention": that is ἠκούσαμεν;
  Ἐπειδή is `s`. οὐ = without, διεστειλάμεθα = our authorization.
- 15:25 ἔδοξεν had "So we all agreed": ἡμῖν = we, ἔδοξεν … γενομένοις
  ὁμοθυμαδόν = all agreed.
- 15:26 ἡμῶν had "of our": Κυρίου = of + Lord.
- 15:28 βάρος had "to burden", πλέον "with anything beyond": ἐπιτίθεσθαι …
  βάρος = to burden + with, μηδέν = not + anything, πλέον … πλήν = beyond.
- 15:32 καί had "who": ὄντες = who + were, καί ("also") `s`; διὰ λόγου =
  said, πολλοῦ = much.
- 15:36 "Let us" moved from the participle Ἐπιστρέψαντες to ἐπισκεψώμεθα.
- 15:39 παροξυσμός had "Their disagreement was so sharp": ἐγένετο = was,
  παροξυσμός = disagreement + sharp, ὥστε = so + that.

Negatives split off verbs: 15:9 οὐθέν = no; 15:19 μή = not; 15:28 μηδέν =
not + anything; 15:38 μή = not (had#1 + accompanied).

## Readings

- 15:3 Σαμάριαν, 15:37 Ἰωάνην, 15:37 συνπαραλαβεῖν and 15:38
  συνπαραλαμβάνειν: spelled differently in BSB's Greek; linked with notes.
- 15:16 κατεστραμμένα: the publisher's Greek has a different word (probably
  κατεσκαμμένα); "ruins" renders either, so τὰ κατεστραμμένα = ruins with a
  note.
- 15:20 "the" (meat of strangled animals): the publisher's Greek has an extra
  word (probably τοῦ before πνικτοῦ); `t` with the reading reason.
- 15:24 "went out": the publisher's Greek has an extra word (probably
  ἐξελθόντες); `t` with the reading reason, and its "and" `t`.
- 15:25 ἐκλεξαμένους: a different form (probably dative ἐκλεξαμένοις);
  linked to "to choose" with a note.
- 15:41 has one extra publisher word (probably a second τήν) with no English
  counterpart, so nothing is claimed.

## Notable decisions

- Names: Συμεών = Simon (with a note), Ἰούδαν = Judas, Βαρσαββᾶν =
  Barsabbas, Σιλᾶν = Silas, Φοινίκην, Συρίαν, Κιλικίαν, Κύπρον, Μάρκον.
- Letter formulas as units: χαίρειν = Greetings, Ἔρρωσθε = Farewell.
- Amos 9 (15:16-18) linked word by word: τὴν = the, πεπτωκυῖαν = fallen
  (the second τήν `s`); the resumptive ἐπ’ αὐτούς `s`.
- Connectives rendered with another word stay linked: 15:4 τε = to whom
  (relative clause), 15:6 τε = So, 15:12 καί = as, 15:30 καί = where. τε in τε
  … καί is `s` (15:3, 15:9, 15:32); 15:39 τε is `s` (new sentence).
- Words understood again: 15:8 δούς = by giving + did, 15:11 σωθῆναι = are
  saved + are, 15:22 ἐκλεξαμένους = to select + chose.
- Scene openers: 15:1 Καί = Then, 15:22 Τότε = Then, 15:30 οὖν = So;
  15:3 μὲν οὖν `s` (no English opener).
- 15:2 πρός (24) = to; "see" `t`. 15:5 αὐτούς = The Gentiles (pronoun BSB
  names). 15:19 ἐγώ = my.
- Kept publisher rows: 15:7 ἀρχαίων = "the early", 15:29 πνικτῶν = "from the
  meat of strangled animals", 15:29 ἀπέχεσθαι = "You must abstain", 15:12
  ὅσα = the (the signs), 15:14 Συμεών = Simon.

## Doubts for the peer

- 15:2 στάσεως = engaging and ζητήσεως = in + debate: a paraphrase; the
  alternative is joining στάσεως καὶ ζητήσεως as "debate" with "engaging"
  `t`.
- 15:23 γράψαντες = this letter and διὰ χειρός = sent + with: the English
  restructures the whole clause.
- 15:8 "did" on δούς and 15:11 "are" on σωθῆναι as verbs understood again,
  rather than `t`.
- 15:24 Ἐπειδή `s` and 15:25 "So" `t`: BSB splits the "since … it seemed
  good" sentence at the verse line; no cross-verse link was made because the
  verse division itself is the same.
- 15:2, 15:33, 15:36 "see"/"to return"/"to see" `t` rather than left on πρός
  and πῶς.
- 15:8 ὁ `s` with "who" on καρδιογνώστης, against the publisher's ὁ = who.
