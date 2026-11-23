# BSB Acts 7: author review (Claude)

Verses reviewed: 59 (7:1-54 and 7:56-60). 7:55 is a KEEP block (reviewed by
Codex) and was copied unchanged. Final check: `fromtext` →
`{"versesOk": 60, "problems": 0}`.

203 of the 897 publisher `g` rows changed, in 57 verses (in 7:3 and 7:56
only TODO tokens were settled). About 30 of them only gained unlinked
Greek tokens, with the English unchanged. About 40 more are two-row
lone-article fixes: the article keeps "the" and the preposition moves to the
noun. The rest were corrected, split or moved.

Parallels followed: Matthew 1:2 (ἐγέννησεν = "became/was the father of",
articles before the names `s`), Matthew 22:32 / Mark 12:26 (Ἐγώ = "I",
"am" `t`, comma καί `s`), Matthew 5:34-35 (footstool: the possessive stays on
μου, ποδῶν `s`), Matthew 26:64 / Mark 14:62 / Luke 22:69 for 7:56, Luke
23:46 for 7:59-60 (φωνῇ = "in a + voice", μεγάλῃ = "loud"; εἰπών = "when he
had said"), Luke 1:29 (ἡ δέ = "Mary") for 7:2, Acts 1:16 (Ἄνδρες ἀδελφοί =
"Brothers").

## Publisher rows corrected

English words with no Greek counterpart that had been folded into a Greek
word (now `t`):

- Supplied names: "Stephen" (7:1 εἶπεν), "Abraham" (7:4 ἐξελθών, 7:8
  ἐγέννησεν), "God" (7:4 μετῴκισεν, 7:5 ἐπηγγείλατο, 7:8 ἔδωκεν), "Moses"
  (7:24 ἠμύνατο), "the members of the Sanhedrin" (7:54 διεπρίοντο).
- Supplied objects: "him" (7:6 ἐλάλησεν, 7:9 ἀπέδοντο, 7:39 ἀπώσαντο,
  7:58 twice), "me" (7:2 ἀκούσατε), "it" (7:31 ἰδών, 7:45 received, 7:53
  ἐφυλάξατε), "to him" (7:31 ἐγένετο), "from them" (7:42 ἔστρεψεν), "them"
  (7:19 ποιεῖν).
- Supplied copulas and frames: "am" (7:32 Ἐγώ), "is" (7:35 on τοῦτον;
  7:49 twice, one had been on ποδῶν), "will … be" (7:49), "it was" (7:47 on
  δέ), "It remained" (7:45 on ἕως), "with them" (7:44, on the article τοῖς).
- Other additions: "still" (7:2), "yet" (7:5), "as a slave" (7:9), "Their
  bones" (7:16, had been on καί), "he paid" (7:16), "two" (7:26), "their"
  (7:35 "their ruler"), "But" (7:39, had been on ἡμῶν), "As for" (7:40, had
  been on γάρ), "And" (7:38, 7:52), "where" (7:15, had been on καί).
- "and" joining a participle to the main verb: 7:4, 7:19, 7:27, 7:32,
  7:36, 7:58.

Words on the wrong Greek word:

- When/As/After/Because moved to the participle or genitive absolute: 7:9
  "Because" (from Καί to ζηλώσαντες), 7:12 "When" (from δέ), 7:21 "When"
  (from δέ), 7:30 "After" (from Καί), 7:31 "When" (from δέ to ἰδών) and "As"
  (from αὐτοῦ to προσερχομένου), 7:59 "While" (from καί to ἐπικαλούμενον).
- Lone articles carrying a preposition, noun or pronoun: 7:2 τῷ "to"; 7:8
  τῇ "on the", τούς "of the"; 7:13 τοῖς "to"; 7:30 τοῦ "near"; 7:34 τοῦ
  "of"; 7:35 ὁ "whom"; 7:41 τῷ "to the", τῶν "of"; 7:42 τῇ "of the", τοῦ
  "of", τῶν "of the"; 7:44 τοῦ "of the", ὁ "God" (now ὁ λαλῶν = God); 7:46
  τῷ "for the"; 7:52 τῶν "of the", τοῦ "of the"; 7:60 τά "on his".
- Indeclinable names: "of"/"to" moved onto the article: 7:9 and 7:18 τὸν
  Ἰωσήφ, 7:13 τῷ Φαραώ, 7:17 τῷ Ἀβραάμ, 7:40 τῷ Ἀαρών, 7:43 τοῦ Μολόχ.
- Possessives and genitives: 7:20 "his" moved from τῷ (house) to τοῦ
  (father); 7:32 "of" moved from σου to πατέρων; 7:33 "your" moved from τό
  to σου; 7:49 "My" now on μου.
- Pronouns and auxiliaries: 7:4 "are now" (now "now" + "are living"); 7:10
  "who" (from καί to κατέστησεν); 7:24 "him" (from ἐκδίκησιν to τῷ
  καταπονουμένῳ); 7:25 "was using him" / "to deliver them" split, with διά,
  αὐτοῦ, δίδωσιν, αὐτοῖς placed; 7:26 "two Israelites who" (αὐτοῖς =
  Israelites, who → μαχομένοις) and "and he tried to reconcile them" (split
  into καί, the verb, αὐτούς); 7:27 "Moses" moved to αὐτόν; 7:40 "led us"
  split; 7:43 "you" moved to ὑμᾶς; 7:45 "who" (from ἥν to διαδεξάμενοι; ἥν
  = it); 7:52 "did" (from ὑμῶν to ἐδίωξαν), "even" (from the verb to καί).
- Words understood again, linked to their stated word: 7:6 "that" (second,
  from καί to ὅτι), 7:8 the repeated "became the father of" and "of#3"
  (from Ἰσαάκ and τούς to ἐγέννησεν), 7:38 "with#1" (from ὅς to μετά), 7:51
  "did" (from πατέρες to ἀντιπίπτετε).
- 7:23 "was" had been on χρόνος and "old" on ἐπληροῦτο: now ἐπληροῦτο …
  χρόνος = "was … old", τεσσερακονταέτης = "forty years".
- 7:30 "a" moved to the noun: πυρός = "burning", βάτου = "of a + bush".
- 7:51 "with" (from καί to καρδίαις, "with … hearts") and "just" (from καί
  to ὡς).
- 7:57 and 7:60 "in a loud voice": φωνῇ = "in a + voice", μεγάλῃ = "loud".
- 7:34 "back" moved from εἰς to the verb ("send … back", as Acts 1:11
  "come back").

Negatives split off verbs: 7:11 (not / could + find), 7:32 (not / did +
dare), 7:40 (not / we do + know), 7:48 (not / does + dwell), 7:50 (not /
Has + made), 7:53 (not / have + kept), 7:52 (οὐκ = fail / did + to
persecute), 7:5 (not / even though + did + have). Joined where English has
no negative word: 7:19 μὴ ζωογονεῖσθαι = "they would die", 7:39 οὐκ
ἠθέλησαν = "refused".

## Readings

- Spelling only, linked: 7:43 Ῥομφά = Rephan, "Same name, spelled
  differently in BSB's Greek text" (probably Ῥαιφάν).
- Same meaning, linked with a note: 7:13 ἐγνωρίσθη = "revealed his
  identity" (probably ἀνεγνωρίσθη); 7:22 "in" goes with the dative σοφίᾳ
  (probably ἐν before πάσῃ).
- Extra word in BSB's Greek, English word `t`: 7:19 "our" (probably ἡμῶν
  after πατέρας), 7:25 "his" (probably αὐτοῦ after ἀδελφούς), 7:43 "your"
  (probably ὑμῶν after θεοῦ).
- Different meaning, `s` + `t`: 7:38 "to us" for ὑμῖν (probably ἡμῖν);
  7:46 "God" for οἴκῳ (probably θεῷ). In 7:46 "for" is also `t`, since it
  marks the dative of BSB's different noun.
- Not claimed (BSB has no word for them): the extra word in 7:3 (probably
  ἐκ before τῆς συγγενείας), 7:10 (probably ἐφ’ before ὅλον) and the second
  extra word in 7:13 (probably τοῦ before Ἰωσήφ).

## Notable decisions

- 7:2 ὁ δέ ἔφη: the article used as a pronoun = "Stephen" (Luke 1:29).
- 7:8 ἐγέννησεν owns "became the father of" three times, including the
  bare "of" in "and Jacob of the twelve patriarchs".
- 7:24 τῷ καταπονουμένῳ ("for the one being oppressed") = "him + who was
  oppressing him", one group, so the verb "oppress" is not left as `t`.
- 7:34 ἰδὼν εἶδον joined = "I have indeed seen" (Hebrew-style emphasis).
- 7:38 He was: οὗτος = He, ὁ γενόμενος = was, ἐστιν `s`; ὅς = he, "And" `t`.
- 7:44 ὁ λαλῶν = "God"; ποιῆσαι αὐτήν recast as "It was constructed".
- Idioms joined: 7:14 ἀποστείλας … μετεκαλέσατο = "sent for", ἐν ψυχαῖς =
  "in all", ἑβδομήκοντα πέντε = "seventy-five"; 7:23 ἀνέβη ἐπὶ τὴν καρδίαν
  αὐτοῦ = "he decided"; 7:26 συνήλλασσεν … εἰς εἰρήνην = "tried to
  reconcile", ἵνα τί = "Why"; 7:35 σὺν χειρί = "through"; 7:45 ἀπὸ
  προσώπου = "before", τῶν πατέρων ἡμῶν = "them"; 7:54 διεπρίοντο ταῖς
  καρδίαις αὐτῶν = "were enraged".
- s + t splits where the English word means something else: 7:15 καί /
  "where", 7:40 γάρ / "As for", 7:51 καί (BSB "with"), 7:10 καί (BSB "who").
- Articles used as possessives kept (majority convention): 7:13 τῷ =
  their, 7:14 τήν = his, 7:17 ὁ = our and τῆς = His, 7:20 τοῦ = his, 7:27
  τόν = his, 7:54 τούς = their, 7:60 τά = his.

## Doubts for the peer

- 7:59: "While" is on the participle ἐπικαλούμενον, whose time relation BSB
  moves to the other clause (as in Acts 1:9-10). Στέφανον = "him + Stephen"
  (object of the stoning, then the subject of appealed). Alternatives:
  "While" `t`, or Στέφανον = "Stephen" with "him" `t`.
- 7:18 ἄχρι οὗ ("until") = "Then" kept from the publisher; BSB starts a
  new sentence. Alternative: `s` + `t`.
- 7:37 "the same" kept on the lone article ὁ (not a copula, preposition or
  noun). Alternative: ὁ = "the", "same" `t`.
- 7:9 "him" and 7:45 "it#0" are `t`: the Greek states the object once, for
  the other verb. Linking both English pronouns to τὸν Ἰωσήφ / ἥν is
  possible.
- 7:17: τῆς = "His", ἧς ὡμολόγησεν `s`, "for … to fulfill" `t`.
- 7:29 καί = "and" although BSB moves it ("lived as a foreigner and had two
  sons"); ἐν = "to" after fled.
- 7:43 καί = "Therefore" and 7:52 καί = "even" kept. 7:53 "you who" on
  οἵτινες and "by" on εἰς kept from the publisher.
- 7:44 "with them" `t`; ἦν = "had" with the dative of possession.

## KEEP block 7:55 (not changed)

The Codex row links "Stephen + full" to ὑπάρχων πλήρης. Its own note says
the name is supplied from context. Under the convention used here (supplied
names `t`, as 7:24 "Moses" and Acts 1:7 "Jesus"), "Stephen" would be `t`,
with ὑπάρχων πλήρης = "full". 7:55 also joins τοῦ Θεοῦ = "of God", while
7:56 keeps τοῦ `s`. Both are acceptable.
