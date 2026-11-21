# SYNO-W split-pair corrections (Claude, author)

Method: every one of the 175 verses in the SYNO-W fix pack (109 chapter files) was read against the Nestle 1904 Greek and the Russian text as given; each Greek `s` token was checked for a Russian `t` word that renders it, and every other link in the verse was read for meaning.
A split pair became one `g` link (with a short note where the sense shifts) unless the Russian follows a word N1904 lacks (TR or another reading), in which case `s`/`t` stayed with corrected reasons; a zero copula whose person survives only in a Russian pronoun (мы, он, ты) was linked to that pronoun; source misprints were linked to the Greek word the intended Russian word renders.
Every touched chapter was rebuilt with the pack's verse blocks and compiled with the real `fromtext` compiler (`chapters failing: 0`); nothing was registered.

## Counts

| Measure | Result |
|---|---|
| Verses checked | 175 |
| Verses changed | 140 |
| Links added (new `g` lines linking a previously unlinked Greek token) | 189 (197 Greek tokens newly linked; 196 `t` lines removed) |
| Other fixes | 12: 1 over-claim (Acts 23:15); `h` heads in 2 verses (Eph 5:5; Acts 26:18, both groups); a `t` word folded into the link it belongs to in 5 verses (2 Cor 12:6 and 12:21 чтобы with μή; Luke 12:6 ли with οὐχί; Luke 3:11 у#1 with ἔχων; Matt 26:42 да with γενηθήτω); 4 reasons rewritten to name the TR word the Russian follows (Acts 13:46 но = ἐπειδὴ δέ; Acts 24:23 А = τε; Rev 2:9 и#0 = καί; Heb 9:9 которое = καθ’ ὅν) |
| Candidates left as legitimate | 35 verses unchanged: 28 genuine TR/textual differences (1 John 5:9, 5:18; Acts 6:3, 13:18, 22:16, 27:14; Jas 2:20, 3:8, 4:14; John 1:42; Luke 3:26, 3:31, 3:32, 20:3, 20:42; Matt 3:10; Phlm 1:6, 1:20; Rev 17:16; Rom 2:17, 3:7, 4:15, 8:2, 10:1, 10:17, 12:20, 13:11, 14:15) and 7 where the Russian word does not render the Greek one (Acts 13:42, 24:25, 25:24; Jas 5:4; John 17:2; Matt 28:5, 28:11). Inside changed verses, supplied copulas, correlatives (то, тот), case prepositions and TR words were also left as `s`/`t`. |

Source-text note: six links attach a Greek word to a misprinted Russian word in `scripts/bible-sources/russyn_vpl.txt` (2 Cor 11:20 ко for кто; Heb 2:5 говорил for говорим; Heb 3:17 согревших for согрешивших; Heb 5:9 виновников for виновником; Mark 7:36 и for им; Mark 16:5 а for на). If the source is corrected, only the Russian word changes; the Greek link stays.

## Changed verses

Format: Book c:v — before → after — why.

- 1 Cor 12:5 — s καί(4) + t а → g 4 = а — additive καί rendered contrastively by а.
- 1 Cor 12:14 — s καὶ γάρ(0 1) + t же → g 1 = же, s 0 — γάρ rendered by же (the s reason already said so); ascensive καί stays s.
- 1 Cor 14:29 — s δέ(1) + t И; s καί(6) + t а → g 1 = И; g 6 = а — two connective split pairs.
- 1 Cor 15:12 — s ἐν(10) + t из#1 → g 10 = из#1 — audit finding (partitive "among").
- 1 Cor 15:19 — s ἐν(5) + t на → g 5 = на — ἐν Χριστῷ ἠλπικότες = надеемся на Христа.
- 1 Cor 15:21 — s ἐπειδή(0) + t как → g 0 = как — the clause connective, rendered comparatively; так stays t as the correlative.
- 1 Cor 15:35 — s δέ(8) + t И → g 8 = И — transitional δέ rendered и.
- 1 Cor 15:41 — s γάρ(12) + t и → g 12 = и — the only connective of the clause; logic shift noted.
- 1 Cor 7:15 — s ἐν(16) + t к; s Θεός(22) + t Господь → g 16 = к; g 22 = Господь — ἐν εἰρήνῃ = к миру; both Greek texts have Θεός, so the subject is linked with a note (no textual variant).
- 1 Cor 8:5 — s ὥσπερ(12) + t так#1 как → g 12 = так#1 как — the clause connective, rendered causally.
- 1 Cor 8:11 — s ἐν(4) + t от → g 4 = от — instrumental ἐν "by your knowledge" = от знания (TR ἐπί); γάρ/И left as a TR difference (TR καί).
- 1 John 2:3 — s ἐν(1) + t из; s ἐάν(7) + t что#1 → g 1 = из; g 7 = что#1 — "by this ... if we keep" = "из того, что соблюдаем".
- 1 John 3:19 — s ἐν(0) + t по; s ἐσμέν(7) + t мы → g 0 = по; g 7 = мы — "by this" = "по чему"; zero copula leaves only мы to carry ἐσμέν.
- 1 John 3:24 — s καί(13) + t А; s ἐκ(21) + t по → g 13 = А; g 21 = по — connective and preposition rendered with shifts.
- 1 Pet 1:12 — s διηκόνουν(7) + t служило → g 7 = служило — main verb was unlinked; Russian changes its subject.
- 1 Pet 2:21 — s ἐπακολουθήσητε(14) + t шли по → g 14 = шли по — verb of the purpose clause; person change stays explained on t мы.
- 1 Pet 3:7 — s ὑμῶν(24) + t вам → g 24 = вам — "your prayers" rendered as the person hindered.
- 1 Thess 4:14 — s διά(14) + t в → g 14 = в — "through Jesus" rendered "in Jesus".
- 1 Tim 5:16 — s ἐπαρκείτω(5) + t должны, t довольствовать#0; s βαρείσθω(9) + t обременять → g 5 = должны + довольствовать#0; g 9 = обременять — both imperatives were unlinked though rendered.
- 2 Cor 11:10 — s φραγήσεται(10) + t отнимется; s εἰς(11) + t у → g 10 = отнимется; g 11 = у — main verb and its preposition; same sense, TR σφραγίσεται noted.
- 2 Cor 11:20 — s τις(16) + t ко → g 16 = ко — "ко" is a source misprint for кто, the same indefinite subject as the four preceding clauses.
- 2 Cor 11:21 — s ἐν(13) + t по → g 13 = по — ἐν ἀφροσύνῃ = по неразумию.
- 2 Cor 11:23 — s ἐν(16) + t при → g 16 = при — ἐν θανάτοις = при смерти.
- 2 Cor 12:6 — s γάρ(1) + t Впрочем; s εἰς(14) + t о; s με(20) + t во мне; g 12 = не#1 + t чтобы → g 1 = Впрочем; g 14 = о; g 20 = во мне#1; g 12 = чтобы + не#1 — three split pairs; μή "lest" = чтобы … не.
- 2 Cor 12:13 — s ὑπέρ(5) + t перед → g 5 = перед — comparative ὑπέρ.
- 2 Cor 12:21 — s πρός(9) + t у; s ἐπί(19) + t в; s τῶν(14) + t которые; g 0 = не#0 + t чтобы#0 → g 9 = у; g 19 = в; g 14 = которые; g 0 = чтобы#0 + не#0 — prepositions, the participle article, and μή "lest".
- 2 Cor 6:9 — s καί(2 6 11) + t но#0/#1/#2; s ὡς(4) + t почитают; s θανατούμενοι(13) + t умираем → g 2/6/11 = но#0/#1/#2; g 4 = почитают; g 13 = умираем — five split pairs in one verse.
- 2 Cor 6:10 — s καί(13) + t но#1 → g 13 = но#1 — as in 6:9.
- 2 Cor 7:4 — s παρρησία(2) + t надеюсь; s πρός(3) + t на → g 2 = надеюсь; g 3 = на — the noun "confidence" was unlinked though rendered by the verb.
- 2 Cor 8:10 — s ἐν(2) + t на → g 2 = на — ἐν τούτῳ = на это.
- 2 Thess 2:4 — s ὅτι ἔστιν(20 21) + t за → g 20 21 = за — "that he is (God)" = за Бога.
- 2 Tim 2:9 — s ἐν(0) + t за → g 0 = за — ἐν ᾧ = за которое.
- Acts 13:1 — s οὖσαν(6) + t тамошней → g 6 = тамошней — "the existing church" = "the local church".
- Acts 13:38 — s διά(7) + t ради → g 7 = ради — the preposition of διὰ τούτου.
- Acts 13:46 — s τε(1) + t Тогда; s κρίνετε(23) + t делаете → g 1 = Тогда; g 23 = делаете; t но reason now names TR ἐπειδὴ δέ — main verb was unlinked.
- Acts 15:5 — s δέ(1) + t Тогда → g 1 = Тогда — the s reason said δέ is "implicit in Тогда".
- Acts 19:11 — s οὐ τὰς τυχούσας(2 4) + t немало → g 2 4 = немало — litotes rendered as quantity, no textual variant.
- Acts 24:14 — s οὕτως(11) + t действительно → g 11 = действительно — the only candidate; s 24 kept with its own reason.
- Acts 24:23 — s τε(6) + t но → g 6 = но; t А reason now names TR τε — connective split pair.
- Acts 4:33 — s καί(0) + t же → g 0 = же — connective split pair.
- Acts 7:34 — s καὶ νῦν(19 20) + t итак → g 19 20 = итак — same as καὶ νῦν → Итак in Acts 22:16.
- Acts 7:40 — s αὐτῷ(23) + t с → g 23 = с — the resumptive dative is rendered by "с Моисеем".
- Col 3:15 — s εὐχάριστοι(18) + t дружелюбны → g 18 = дружелюбны — the predicate adjective, rendered in its classical sense "agreeable"; Χριστοῦ/Божий left as TR Θεοῦ.
- Gal 2:8 — s εἰς(11) + t у#1 → g 11 = у#1 — εἰς τὰ ἔθνη = у язычников.
- Gal 3:15 — s ἤ(10) + t и → g 10 = и — "or" under negation = "и не" (same as audit 2 Cor 9:7).
- Gal 4:11 — s εἰς(6) + t у → g 6 = у — εἰς ὑμᾶς = у вас.
- Gal 5:10 — s εἰς(2) + t о → g 2 = о — πέποιθα εἰς ὑμᾶς = уверен о вас.
- Gal 5:21 — s φθόνοι(0) + t ненависть → g 0 = ненависть — the list head; убийства stays t as TR φόνοι.
- Heb 10:38 — s καί(7) + t а; s ἐν(15) + t к → g 7 = а; g 15 = к — two split pairs.
- Heb 2:5 — s λαλοῦμεν(10) + t говорил → g 10 = говорил — the verb of the clause; the source prints говорил where Synodal usually has говорим.
- Heb 3:17 — s ἁμαρτήσασιν(7) + t согревших → g 7 = согревших — source misprint of согрешивших "those who sinned".
- Heb 4:3 — s γάρ(1) + t А; s καθώς(7) + t так как; s ἀπό(24) + t в#3 → g 1 = А; g 7 = так как; g 24 = в#3 — three split pairs.
- Heb 4:11 — s ἐν(9) + t по → g 9 = по — ἐν τῷ αὐτῷ ὑποδείγματι = по тому же примеру.
- Heb 5:9 — s αἴτιος(7) + t виновников → g 7 = виновников — the predicate noun; the source prints виновников for виновником.
- Heb 5:13 — s ἐστίν(10) + t он → g 10 = он — zero copula, its subject pronoun.
- Heb 6:9 — s Πεπείσμεθα(0) + t мы, t надеемся; s ἐχόμενα(8) + t держитесь → g 0 = мы надеемся; g 8 = держитесь — the main verb and the participle were unlinked though rendered.
- Heb 6:10 — s ἧς(12) + t который → g 12 = который — both Greek texts have ἧς; Russian only changes its antecedent (труд = TR κόπου).
- Heb 7:11 — s ἦν(8), γάρ(11), ἐπί(12), νενομοθέτηται(14), καί(25) + t достигалось, и, с, сопряжен закон, а → five g links — the parenthesis and condition were left almost entirely unlinked.
- Heb 7:14 — s εἰς(9) + t о; s φυλήν(11) + t колена → g 9 = о; g 11 = колена — "tribe" moved forward to "из колена Иудина".
- Heb 7:18 — s μὲν γάρ(1 2) + t же → g 1 2 = же — connective split pair.
- Heb 8:10 — s καί(33) + t а → g 33 = а — connective split pair.
- Heb 9:9 — s κατά(7) + t в#0 которое; s κατά(16) + t в#1 → g 7 = в#0; g 16 = в#1; которое stays t (TR καθ’ ὅν) — both κατά were rendered by в.
- Jas 2:14 — s μή(14) + t ли; s ἡ(16) + t эта → g 14 = ли; g 16 = эта — question particle and anaphoric article.
- Jas 4:11 — s καταλαλεῖ νόμου κρίνει νόμον(12 13 15 16) + four t; s εἶ(22) + t ты#1 → g 12/13/15/16 = злословит#1/закон#0/судит#1/закон#1; g 22 = ты#1 — Synodal reverses the roles but renders every word.
- John 1:24 — s καί(0) + t А → g 0 = А — connective split pair.
- John 12:40 — s αὐτῶν(1 6) + t свои, свое; s καί(20) + t чтобы → g 1 = свои; g 6 = свое; g 20 = чтобы — possessors rendered reflexively after Russian names "народ сей"; the last connective rendered as purpose.
- John 14:22 — s γέγονεν(9) + t это → g 9 = это — "what has happened that" = "что это, что".
- John 14:29 — s νῦν(1) + t вот → g 1 = вот — "and now" = "и вот".
- Luke 12:6 — s ἐνώπιον(13) + t у; g 0 = Не + t ли → g 13 = у; g 0 = Не + ли — preposition split pair; ли completes οὐχί as in Heb 3:17.
- Luke 12:19 — s ἔχεις(6) + t у тебя → g 6 = у тебя — the verb "you have" was unlinked.
- Luke 13:14 — s οὖν(24) + t и → g 24 = и — connective split pair.
- Luke 14:3 — s καὶ ἀποκριθείς(0 1) + t По сему случаю → g 1 = По сему случаю; s 0 — "answering" (to the situation) rendered "on this occasion"; ἢ οὔ/ли left as a TR difference (TR εἰ).
- Luke 14:21 — s εἰς(19) + t по → g 19 = по — "into the streets" = "по улицам".
- Luke 14:23 — s εἰς(8) + t по → g 8 = по — same as 14:21.
- Luke 14:31 — s συμβαλεῖν(6) + t против; s ἐστιν(15) + t он → g 6 = против; g 15 = он — "to engage (a king)" = "против (царя)"; zero copula.
- Luke 14:32 — s πρός(11) + t о → g 11 = о — τὰ πρὸς εἰρήνην = о мире.
- Luke 15:10 — s ἐνώπιον(5) + t у → g 5 = у — "before the angels" = "у Ангелов".
- Luke 15:12 — s δέ(16) + t И → g 16 = И — same connective function; TR καί noted (rule 9).
- Luke 16:8 — s εἰς(23) + t в → g 23 = в — "εἰς τὴν γενεάν" = "в своем роде".
- Luke 16:15 — s ἐν(20) + t у; s τό(19) + t что → g 20 = у; g 19 = что — preposition and substantivizing article.
- Luke 16:18 — s ἀπό(13) + t с#1 → g 13 = с#1 — "divorced from a husband" = "разведенной с мужем".
- Luke 16:26 — s ἐν(1) + t сверх → g 1 = сверх — ἐν πᾶσι τούτοις "besides all this"; TR ἐπί noted.
- Luke 17:2 — s περίκειται(5) + t повесили; s περί(6) + t на → g 5 = повесили; g 6 = на — verb and preposition of the millstone clause.
- Luke 17:37 — s καὶ ἀποκριθέντες(0 1) + t На это → g 1 = На это; s 0 — "answering" = "на это", as ἀποκριθείς → "в ответ" in Luke 20:3.
- Luke 18:5 — s γε(1) + t но; s παρέχειν κόπον(3 5) + t не#0 дает, покоя; s εἰς τέλος(13 14) + t больше → g 1 = но; g 3 5 = не#0 дает + покоя; g 13 14 = больше — idiom "cause trouble" = "не давать покоя".
- Luke 18:34 — s ἀπό(11) + t для → g 11 = для — "hidden from them" = "для них сокровенны".
- Luke 20:14 — s ἵνα(15) + t и → g 15 = и — purpose rendered by coordination.
- Luke 20:24 — s ἔχει(4) + t на нем → g 4 = на нем — "whose image does it have" = "чье на нем изображение".
- Luke 20:39 — s ἀποκριθέντες(0) + t На это → g 0 = На это; s 1 — as Luke 17:37.
- Luke 21:25 — s ἐν(15) + t и#2 → g 15 = и#2 — "in perplexity" rendered "и недоумение".
- Luke 22:9 — s θέλεις(5) + t велишь → g 5 = велишь — the main verb was unlinked.
- Luke 22:21 — s πλήν(0) + t И → g 0 = И — the only connective, no textual variant.
- Luke 24:12 — s πρὸς αὑτόν(16 17) + t сам в себе → g 16 17 = сам в себе — Synodal construes it with θαυμάζων, a standard reading of the Greek.
- Luke 3:1 — s καί(29) + t а → g 29 = а — connective before the last ruler.
- Luke 3:11 — s ἔχων(5) + t у#0; g 14 = есть + t у#1 → g 5 = у#0; g 14 = у#1 + есть — the possessive "у кого" renders "the one having".
- Luke 3:14 — s καί(8) + t а → g 8 = а — "we too" = "а нам".
- Luke 4:40 — s δέ(15) + t и → g 15 = и — connective split pair.
- Luke 4:41 — s ὅτι(22) + t что#0 → g 22 = что#0 — Synodal reads the same ὅτι as "that" instead of "because".
- Luke 7:1 — s εἰς(6) + t к; s ἀκοάς(8) + t слушавшему → g 6 = к; g 8 = слушавшему — "into the hearing of the people" = "к слушавшему народу".
- Luke 8:23 — s κατέβη(5) + t поднялся; s εἰς(8) + t На → g 5 = поднялся; g 8 = На — audit finding applied.
- Luke 8:28 — s καί(13) + t до → g 13 = до — idiom τί ἐμοὶ καὶ σοί = "что Тебе до меня".
- Mark 1:24 — s καί(3) + t до → g 3 = до — idiom τί ἡμῖν καὶ σοί = "что Тебе до нас".
- Mark 1:43 — s ἐμβριμησάμενος(1) + t посмотрев, строго → g 1 = посмотрев + строго — the participle was unlinked though rendered (as a stern look).
- Mark 10:11 — s ἐπί αὐτήν(13 14) + t от нее → g 13 = от; g 14 = нее — "against her" = "от нее"; the pronoun at least is beyond doubt.
- Mark 14:28 — s εἰς(7) + t в → g 7 = в — "into Galilee" = "в Галилее".
- Mark 16:4 — s γάρ(8) + t а → g 8 = а — connective split pair.
- Mark 16:5 — s ἐν(8) + t а → g 8 = а — the source prints "а правой стороне" for "на правой стороне".
- Mark 2:19 — s μή(5) + t ли; s νυμφίον(23) + t жених#1 → g 5 = ли; g 23 = жених#1 — question particle; the noun was unlinked only because its case changed.
- Mark 7:36 — s αὐτοῖς(2) + t и → g 2 = и — the source prints "повелел и" for "повелел им".
- Matt 10:14 — s καί(0) + t А; s ἄν(2) + t если → g 0 = А; g 2 = если — the s reason already said ἄν is expressed by если.
- Matt 14:23 — s δέ(12) + t и → g 12 = и — connective split pair.
- Matt 26:42 — s ἐάν(13) + t чтобы, g 14 = не#1; g 17 = будет + t да → g 13 14 = чтобы + не#1; g 17 = да будет — ἐὰν μή as one unit; да belongs to the imperative.
- Matt 28:14 — s ἐπί(4) + t до → g 4 = до — "heard before the governor" = "дойдет до правителя".
- Matt 4:4 — s διά(17) + t из → g 17 = из — "through the mouth" = "из уст".
- Matt 4:6 — s εἶ(5) + t Ты; g 25 = не + s ποτέ(26) + t да → g 5 = Ты; g 25 26 = да не — zero copula; μή ποτε "lest" as one unit.
- Matt 5:31 — s ἄν(3) + t если → g 3 = если — the s reason already named если.
- Matt 7:3 — s δέ(1) + t И → g 1 = И — connective split pair.
- Matt 7:26 — s καί(0) + t А → g 0 = А — connective split pair.
- Matt 8:9 — s καί(11) + t но → g 11 = но — the only connective between the clauses, moved before the participle.
- Matt 8:29 — s καί(6) + t до → g 6 = до — idiom, as in Mark 1:24.
- Phil 1:22 — s καί(10) + t то → g 10 = то — apodotic καί "then".
- Rev 19:8 — s γάρ(9) + t же → g 9 = же — connective split pair.
- Rev 2:9 — s σου(1) + t твои дела; s εἶ(9) + t ты → g 1 = твои; g 9 = ты; t дела; t и#0 reason now names TR καί — σου is in both texts; only its head noun (TR τὰ ἔργα) differs.
- Rev 4:8 — s αὐτῶν(7) + t из; s καί(22) + t ни#0, ни#1; s ὁ(33) + t Который → g 7 = из; g 22 = ни#0 + ни#1; g 33 = Который — three split pairs.
- Rom 13:9 — s εἴ τις(11 12) + t все → g 11 12 = все; s 14 kept — "if any other commandment" = "все другие".
- Rom 5:7 — s γάρ(7) + t разве → g 7 = разве — the connective of the second clause, logic shift noted.
- Rom 6:5 — s ἀλλά(9) + t то → g 9 = то — apodotic ἀλλά "then surely".
- Rom 6:17 — s παρεδόθητε(15) + t предали себя → g 15 = предали себя — the verb of the relative clause, voice changed.
- Rom 8:24 — s βλεπομένη(6) + t когда видит → g 6 = когда видит — the participle, voice changed.
- Rom 9:11 — s μένῃ(16) + t происходило → g 16 = происходило — the verb of the purpose clause.
- Titus 1:12 — s προφήτης(6) + t стихотворец → g 6 = стихотворец — the noun was unlinked only because of the sense shift.
- 1 Cor 9:25 — s ἵνα(9) + t для → g 9 = для — audit finding applied.
- Acts 23:15 — g 2 = вы#0 + вы#1, g 15 = хотите; s τά(18) + t дело → g 2 = вы#0; g 15 = вы#1 + хотите; g 18 = дело — audit finding (over-claim) applied; plus audit minor item 12 (substantivizing τά = дело).
- Eph 5:5 — h 14 = никакой, h 14 = не → h 5 = никакой; h 14 = не — audit finding applied.
- Matt 13:22 — s ἐστιν(7) + t означает → g 7 = означает — audit finding applied.
- Luke 10:1 — s ἤμελλεν(22) + t хотел → g 22 = хотел — audit finding applied.
- Acts 20:18 — s ἀφ’(12) + t в#0 → g 12 = в#0 — audit finding applied.
- Luke 1:11 — s δέ(1) + t тогда → g 1 = тогда — audit finding applied.
- 2 Cor 9:7 — s καθώς(1), ἐκ(6), ἐξ(9), ἤ(8) + t по, с#0, с#1, и → g 1 = по; g 6 = с#0; g 9 = с#1; g 8 = и — audit finding applied.
- Acts 26:18 — h 4 = чтобы + h 4 = обратились; h 18 = получили + h 18 = и#1 → h 3 = чтобы, h 4 = обратились; h 17 = и#1, h 18 = получили — audit finding applied; the same double-h fault in the second group fixed too.

## The 11 audit findings (audit-2026-11-20.md)

1. 1 Cor 9:25 (cat. 3, ἵνα / для) — applied as suggested: `g 9 = для`, `t для` dropped.
2. 1 Cor 15:12 (cat. 3, ἐν / из#1) — applied as suggested: `g 10 = из#1`.
3. 2 Cor 9:7 (cat. 3, three pairs) — applied as suggested: `g 1 = по`, `g 6 = с#0`, `g 9 = с#1`, `g 8 = и`; four `t` lines dropped.
4. Acts 20:18 (cat. 3, ἀφ’ / в#0) — applied as suggested: `g 12 = в#0`.
5. Acts 23:15 (cat. 2, over-claim) — applied as suggested: `g 2 = вы#0`, `g 15 = вы#1 + хотите`. Also linked the substantivizing τά (18) to дело (audit minor item 12).
6. Acts 26:18 (cat. 1, `h`) — applied as suggested: `h 3 = чтобы`, `h 4 = обратились`. The second group had the same fault (both heads on 18), now `h 17 = и#1`, `h 18 = получили`. Audit minor item 14 (unlinking и#1 from τοῦ) was not applied: the second τοῦ marks the second purpose clause, which Russian marks with и, and unlinking would create a new split pair.
7. Eph 5:5 (cat. 1, `h`) — applied as suggested: `h 5 = никакой`, `h 14 = не`.
8. Luke 1:11 (cat. 3, δέ / тогда) — applied as suggested: `g 1 = тогда`.
9. Luke 8:23 (cat. 3, κατέβη / поднялся, εἰς / На) — applied as suggested: `g 5 = поднялся`, `g 8 = На`.
10. Luke 10:1 (cat. 3, ἤμελλεν / хотел) — applied as suggested: `g 22 = хотел`.
11. Matt 13:22 (cat. 3, ἐστιν / означает) — applied as suggested: `g 7 = означает`.
