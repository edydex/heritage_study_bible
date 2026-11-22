# BSB Luke 19: author review (Claude)

Verses reviewed: 47 (19:1-16, 19:18-48). 19:17 was kept unchanged from the
earlier Codex review (KEEP block); the final file's 19:17 is identical to the
base. Final check: `fromtext` → `{"versesOk": 48, "problems": 0}`.

157 of the 600 publisher `g` rows changed. 14 of them only gained unlinked
Greek tokens or were joined into one unit, with the English unchanged
(ὀνόματι καλούμενος = named 19:2, διὰ τό = because 19:11, ἐν ᾧ = until 19:13,
εἶπεν φωνηθῆναι = he summoned 19:15, διὰ τί = Why 19:23 and 19:31, ἤγγισεν εἰς
= He approached 19:29, χρείαν ἔχει = needs 19:31 and 19:34, ὁ ἐρχόμενος = who
comes 19:38, ἀποκριθεὶς εἶπεν = He answered 19:40, παρεμβαλοῦσιν … χάρακα =
will barricade 19:43, ἀνθ’ ὧν = because 19:44, τὸ τί = a way 19:48). 4 kept
their English but moved to the Greek word that carries it (see "When" and
"the" below). The other 139 rows were corrected, split or moved. Parallels
followed: Mark 11:1-3 for the colt (19:29-31), Matthew 21:13 / Mark 11:17 for
the temple quotation (19:46), Matthew 25:26-29 for the minas (19:22-26).

## Publisher rows corrected

Names and subjects supplied by English (now `t`):

- "Jesus" sat on 19:1 εἰσελθών, 19:4 ἤμελλεν, 19:11 προσθείς, 19:28 εἰπών, 19:32 εἶπεν, 19:41 ἤγγισεν (also "Jerusalem", now `t`), 19:45 εἰσελθών and 19:47 ἦν.
- 19:5: ἦλθεν "Jesus came" → came; Ἰησοῦς "He" → Jesus; `t He` (BSB names Jesus in the When-clause and resumes with He).
- 19:6: σπεύσας "Zacchaeus hurried" → hurried; `t Zacchaeus`. 19:36: ὑπεστρώννυον "the people spread" → spread; `t the people`.
- 19:22: λέγει "His master replied" → replied; `t His master`, as in the KEEP verse 19:17.
- 19:26: λέγω "He replied, ‘I tell" → I tell; `t He replied` (no speech verb in the Greek).

Objects and other English-only words (now `t`):

- 19:7: ἰδόντες "saw this", πάντες "all who" → who saw; all; `t this`.
- 19:11: εἶπεν "to tell them" → to tell; `t them`.
- 19:13: δέ "Beforehand" → `s`; `t Beforehand`. Πραγματεύσασθε "Conduct business with this" → Conduct business; `t with this`.
- 19:24: δότε "give it" → give; `t it`. 19:27: ἀγάγετε "bring them" → bring; `t them#1`.
- 19:25: ἔχει "he already has" → he + has; `t already`; μνᾶς (TODO) `s`.
- 19:26: δοθήσεται "will be given more" → `t more`; ἀπό "from him" → from; `t him` (as Matthew 25:29).
- 19:30 (as Mark 11:2): κατέναντι "ahead of you" → ahead of, `t you#0` (Luke has no ὑμῶν); εἰσπορευόμενοι "and as you enter it" → as you enter, ἐν ᾗ (TODO) = it, `t and#0`; δεδεμένον "tied there" → tied, `t there`; ἀγάγετε "and bring it here" → bring, `t and#1`, `t it#2`, `t here`.
- 19:31: λύετε "are you untying it" → `t it#0`; ἐρεῖτε "tell him" → tell, `t him`.
- 19:32: εὗρον "and found it" → found; `t and`, `t it`.
- 19:35: ἐπεβίβασαν "and put Jesus on it" → put + on; καί (TODO) = and; Ἰησοῦν (TODO) = Jesus#1; `t it#1`.
- 19:44: ἐπισκοπῆς "visitation from God" → of + visitation; σου "of your" → your#1; `t from God`.
- 19:45: πωλοῦντας "were selling there" → τοὺς πωλοῦντας = those who were selling; `t there` (Luke's verse has no ἐν τῷ ἱερῷ).
- 19:2: πλούσιος "very wealthy" → wealthy; `t very`. 19:40: οἱ "the very" → the; `t very`.
- 19:16, 19:18, 19:20: "first servant", "second servant", "another servant" → `t servant` (the Greek has only "the first/second/other").
- 19:22: ᾔδεις "So you knew" → you knew; `t So`.
- 19:42: σύ "you" (in "bring you peace") → you#0, the subject; ἔγνως = had known; `t you#1`.

Supplied "and" after a participle rendered as a finite verb (now `t`): 19:1 was passing through, 19:4 climbed, 19:5 said, 19:8 said, 19:13 gave, 19:16, 19:18 and 19:20 said, 19:32 found, 19:41 saw, 19:42 said, 19:45 began.

Negatives and auxiliaries:

- 19:3: ἠδύνατο "could not see" → could; οὐκ (TODO) = not; ἰδεῖν = to see + see#1 (understood again).
- 19:14: θέλομεν "We do not want" → We do + want; Οὐ (TODO) = not.
- 19:21, 19:22: "you/I did not deposit", "you/I did not sow" → did + deposit / did + sow; each οὐκ (TODO) = not.
- 19:23: ἔδωκας "did you not deposit" → did you + deposit, οὐκ = not; κἀγώ "and" → and + I; ἔπραξα "I could have collected" → ἂν … ἔπραξα = could have collected.
- 19:26: τοῦ "the one who", μή "does not", ἔχοντος "have" → τοῦ … ἔχοντος = the one who does + have, μή = not; τῷ "who", ἔχοντι "has" → τῷ ἔχοντι = who has (Matthew 25:29).
- 19:27: τοὺς "who", θελήσαντας "were unwilling for", με "me" → τοὺς μὴ θελήσαντας = who were unwilling; με = for me.
- 19:44: "They will not leave", "you did not recognize" → They will + leave, you did + recognize; both οὐκ (TODO) = not. ἐδαφιοῦσιν "They will level you to the ground" → They will level + to the ground; σε = you#0 + you#1.
- 19:48: εὕρισκον "they could not find" → they could + find; οὐχ (TODO) = not.

"When", "While", "As", "After" on the wrong word:

- 19:11: δέ "While" → `s`; Ἀκουόντων = While + were listening to. 19:33: δέ "As" → `s`; λυόντων = As + were untying.
- 19:28: Καί "After" → `s`; εἰπών = After + had said.
- 19:36: αὐτοῦ "As He" → He; πορευομένου = As + rode along. 19:37: αὐτοῦ "as He" → He; ἐγγίζοντος … πρός = as + approached.
- Moved with the same English: 19:5 "When" from καί to ὡς; 19:15 "When" from καί to ἐν τῷ (καὶ ἐγένετο `s`).

Articles carrying other words, and "a" placement:

- 19:8: τῶν "of" → τῶν ὑπαρχόντων = of + possessions; τοῖς "to the" → the, πτωχοῖς = to + poor. 19:9: τούτῳ "to this" → this; οἴκῳ = to + house.
- 19:29: τῶν "of His" → His (article as possessive); μαθητῶν = of + disciples. 19:37: τοῦ "from the" → the, ὄρους = from + Mount; τῶν "of" → `s`, μαθητῶν = of disciples. 19:39: τῶν "of the" → the, Φαρισαίων = of + Pharisees. 19:47: τοῦ "of the" → the, λαοῦ = of + people.
- Article + participle joined: 19:10 τὸ ἀπολωλός = the lost; 19:24 τοῖς παρεστῶσιν = those standing by and τῷ … ἔχοντι = to the one who has (Matthew 25:28); 19:32 οἱ ἀπεσταλμένοι = those who were sent; 19:38 ὁ ἐρχόμενος = who comes.
- Moved with the same English: 19:15 "the" from τούτους to τούς (τούτους `s`); 19:44 "the" from σου to τά.
- 19:12: μακράν "a distant" → distant, χώραν = a + country. 19:21, 19:22: αὐστηρός "a harsh" → harsh, ἄνθρωπος = a + man.

Other words on the wrong Greek word:

- 19:2: αὐτός "who was" → καὶ αὐτός = who; ἦν = was#1 (see doubts); the first καὶ αὐτὸς ἦν `s`.
- 19:4: "on" and "ahead" → εἰς τὸ ἔμπροσθεν = on ahead; ἀνέβη ἐπί = climbed.
- 19:12: λαβεῖν "to lay claim", ἑαυτῷ "to his" → to lay claim to; his.
- 19:16: προσηργάσατο "has produced", μνᾶς "more minas" → has produced + more (the προσ- prefix); minas.
- 19:20: ἕτερος "another servant", εἶχον "I have laid away" → ὁ ἕτερος = another; εἶχον = I have; ἀποκειμένην (TODO) = laid away.
- 19:22: πονηρέ "You wicked" → wicked; δοῦλε = You + servant (vocative You with the vocative noun).
- 19:29: καλούμενον "of", Ἐλαιῶν "Olives" → Ἐλαιῶν = of Olives (as Mark 11:1); τὸ καλούμενον ("called") `s`.
- 19:34: εἶπαν "they answered" → οἱ = they (οἱ δέ); εἶπαν = answered.
- 19:37: φωνῇ "in a loud voice" → in a + voice; μεγάλῃ (TODO) = loud.
- 19:38: Εὐλογημένος "Blessed is" → Blessed; `t is` (as Mark 11:9).
- 19:43: συνέξουσιν "hem you in" → hem + in; σε (TODO) = you#3.
- 19:47: "every", "day" → τὸ καθ’ ἡμέραν = every day.
- 19:48: ἀκούων "on His words" → words; ἐξεκρέμετο (TODO) = hung on.

## Readings

EVIDENCE shows publisher Greek different from N1904 in 19:1, 19:8, 19:15, 19:40 and 19:48.

- 19:1 Ἱερειχώ = Jericho, 19:8 ἡμίσειά = half, 19:48 ἐξεκρέμετο = hung on: linked with "spelled differently in BSB's Greek text" (probably Ἰεριχώ, ἡμίσια, ἐξεκρέματο).
- 19:15 διεπραγματεύσατο = had earned: linked as a same-meaning form (probably the plural διεπραγματεύσαντο).
- 19:40: one extra publisher word with no English counterpart (probably ὅτι or αὐτοῖς); no reading is claimed.

## Notable decisions

- 19:3: ἀπό = over kept (publisher), with a note that the causal ἀπό ("because of") is rendered over.
- 19:8: τι (TODO) = the "it" of "I will repay it", the amount taken; τὰ (TODO) `s`.
- 19:13: δέ is `s` and "Beforehand" `t`; BSB's word states timing, not the connective.
- 19:19: γίνου = "shall have authority" kept (publisher), with a note: γίνου ἐπάνω "be over".
- 19:22: στόματος = own words kept, with a note.
- 19:27: πλήν = And kept (publisher), with a note.
- 19:35: the καί between the clauses = the "and" of BSB's series "led …, threw …, and put", not `s` + `t and`.
- 19:43: καί = when kept (publisher), with a note.

## Doubts for the peer

- 19:44: ἐν σοί = within your walls (σοί = your walls), and σου after τέκνα is `s`. The alternative is σου = your#0 and σοί = walls.
- 19:2: ἦν (in καὶ αὐτὸς ἦν ἀρχιτελώνης) is linked to the later "was" of "who was wealthy", where BSB renders it; the first καί and αὐτός are `s`. The alternative is `s` ἦν and `t was#1`.
- 19:42: σύ = you#0 (the subject of had known) and the "you" of "bring you peace" `t`. The publisher had σύ on that second "you".
- 19:22: the vocative "You" sits on δοῦλε, as the brief's rule asks; the reviewed Matthew 25:26 puts "You wicked" on πονηρέ.
- 19:26: "him" in "taken away from him" is `t`; linking ἀπό = from him is the alternative.
