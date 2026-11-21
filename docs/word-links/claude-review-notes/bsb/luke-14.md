# BSB Luke 14: author review (Claude)

Verses reviewed: 33 (14:1-17, 14:19-30, 14:32-35). Kept unchanged from the
earlier Codex review: 14:18 and 14:31 (KEEP blocks; identical to the base
JSON in the output). Final check: `fromtext` →
`{"versesOk": 35, "problems": 0}`.

The 33 reviewed verses had 460 publisher `g` rows. 333 are unchanged. 25 only
gained unlinked Greek tokens, with the English unchanged (for example φαγεῖν
ἄρτον = to eat 14:1, καὶ ἰδού = Right there 14:2, ἀποκριθεὶς … εἶπεν = asked
14:3, πρὸς αὐτούς = them 14:5 and 14:7, μή ποτε = in case 14:8 and Otherwise
14:12, σὲ καὶ αὐτόν = both of you 14:9, διὰ τοῦτο = so 14:20, ἔρχεται ὀπίσω =
follow 14:27, ἵνα μή ποτε = Otherwise 14:29, οὐ δύναμαι/δύναται = cannot 14:20, 14:26,
14:27, 14:33). The other 102 rows, in 29 verses, were corrected, split, joined
or moved.

Parallels checked: Matthew 22:1-14 (wedding banquet: τοὺς κεκλημένους, ὁ δέ,
the servants' errands), Matthew 12:11 (animal in a pit) for 14:5, Matthew 23:12
for 14:11, Matthew 10:37-38 for 14:26-27, Mark 9:50 for 14:34, Matthew 13:9 for
14:35, and the kept 14:18 for 14:19.

## Publisher rows corrected

English-only words that had been folded into a Greek word (now `t`):

- "Jesus": 14:4 ἐπιλαβόμενος ("Jesus took hold of the man"), 14:7 ἐπέχων
  ("When Jesus noticed"), 14:12 Ἔλεγεν ("Jesus said") → `t Jesus`. 14:16
  εἶπεν "Jesus replied" → replied; ὁ (with δέ) = Jesus.
- Objects: 14:4 "the man" and "him#1" (ἀπέλυσεν = sent + on his way); 14:5
  "pull him out" → will + pull + out, αὐτόν = him; 14:19 "them out" → them, with
  "out" on δοκιμάσαι; 14:23 "compel them"; 14:28 "the resources" (ἔχει) and
  "complete it"; 14:29 "to finish the work" and "sees it".
- 14:1: αὐτοί "those in attendance" → those; `t in attendance`. 14:9: τόπον
  "your seat" → seat; `t your`. 14:17: ἐστιν "everything is" → is;
  `t everything`. 14:21: ταῦτα "all this" → this; `t all`. 14:28: εἰ "to see
  if" → if; `t to see`. 14:30: ἤρξατο "what he started" → he started;
  `t what`. 14:13 "and the blind", 14:35 "and it", 14:27 "And whoever" → the
  blind, it, whoever; `t and`/`t And`.
- Copulas: 14:15 "Blessed is everyone" → Blessed; ὅστις = everyone who;
  `t is`. 14:34 "is good" → good; `t is` (as Mark 9:50).

Supplied "and" after a participle (now `t`): 14:9 ἐλθών, 14:10 πορευθείς,
14:21 παραγενόμενος and ὀργισθείς, 14:25 στραφείς, 14:28 καθίσας. In 14:9 and
14:10 "will" moved from the coming verb to ἐρεῖ (will + tell).

Negatives and auxiliaries (split): 14:5 οὐκ = not; 14:8 μή = not, κατακλιθῇς
= do + sit; 14:12 μή = not, φώνει = do + invite; 14:26 μισεῖ = does + hate;
14:27 βαστάζει = does + carry; 14:28 ψηφίζει = does + count; 14:33
ἀποτάσσεται = does + give up. Fused English negatives stay joined: οὐκ
ἔχουσιν = they cannot (14:14), οὐκ ἴσχυσαν = they were unable (14:6), μὴ
ἰσχύοντος = is unable (14:29), οὐ δύναμαι/δύναται = cannot.

"When", "while" and "if" on the wrong word:

- 14:7 ἐπέχων = When + noticed. 14:15: δέ "When" → `s`; Ἀκούσας = When +
  heard.
- 14:17: τῇ "When it was" → τῇ ὥρᾳ = When it was time.
- 14:29: θέντος "if he lays" and αὐτοῦ "the" → θέντος = if + lays (genitive
  absolute); αὐτοῦ = he; θεμέλιον = the foundation.
- 14:32: αὐτοῦ "while the other king" → the other king; ὄντος = while + is.

Prepositions on a lone article, and "a" with its noun: 14:3 τῷ "on the" → the,
σαββάτῳ = on + Sabbath; 14:14 τῶν "of the" → the, δικαίων = of + righteous;
14:17 τοῦ "for the" → the, δείπνου = for + banquet; 14:21 τῷ "to" (twice) →
`s`, κυρίῳ = to + master, δούλῳ = to + servant, τῆς "of the" → the, πόλεως =
of + city; 14:16 μέγα "a great" → great, δεῖπνον = a + banquet.

One article, English "the" repeated: 14:3 τούς = the#0 + the#2 (experts …
and the Pharisees; the publisher had the#2 on Φαρισαίους); 14:21 τούς = the ×4
(poor, crippled, blind, lame).

Article + participle joined (rule 3): 14:9 ὁ … καλέσας = the host who invited;
14:10 ὁ κεκληκώς = host (σε = your), τῶν συνανακειμένων = at the table; 14:11
ὁ ὑψῶν = who exalts, ὁ ταπεινῶν = the one who humbles; 14:12 τῷ κεκληκότι =
to the man who had invited; 14:15 τῶν συνανακειμένων = of those reclining with
(`t Him`); 14:17 τοῖς κεκλημένοις = those who had been invited; 14:24 τῶν
κεκλημένων = who were invited; 14:33 τοῖς … ὑπάρχουσιν = has (ἑαυτοῦ = he);
14:35 ὁ ἔχων = He who has.

Other words on the wrong Greek word:

- 14:4: οἱ = they (article as pronoun, as Matthew 22:5); ἡσύχασαν = remained
  silent.
- 14:5: Τίνος "Which" and υἱός "whose son" → Τίνος = Which + whose; υἱός =
  son.
- 14:12: σε "you in return" → ἀντικαλέσωσιν = may invite + in return; σε = you.
- 14:15: φάγεται "will eat at the feast" → will eat; ἄρτον = at the feast
  (the "eat bread" idiom).
- 14:26: τήν "own" and ἑαυτοῦ "his" → τήν `s`; ἑαυτοῦ = his own.
- 14:32: πρός "for" → τὰ πρὸς εἰρήνην = terms of peace; ἐρωτᾷ = to ask + for.
- 14:19: ἐρωτῶ σε = Please and ἔχε … παρῃτημένον = excuse, as in the kept
  14:18.

## Readings

- Only the EVIDENCE lines of 14:13, 14:21, 14:25 and 14:26 show publisher
  Greek different from N1904.
- 14:13 and 14:21: ἀναπήρους = crippled, linked with "Same word, spelled
  differently in BSB's Greek text" (probably ἀναπείρους).
- 14:26: αὐτοῦ = his#0, linked with a same-meaning note (probably the
  reflexive ἑαυτοῦ after πατέρα).
- 14:25: EVIDENCE says "differs" but counts 0 unmatched words either way
  (probably order or accent only); no reading is claimed.

## Notable decisions

- Opening καί that only links to the previous verse is `s` (14:17, 14:19,
  14:21, 14:22). 14:20 καί = Still is the publisher row, kept.
- 14:1: Καὶ ἐγένετο `s`; ἐν τῷ `s` because BSB turns ἐν τῷ ἐλθεῖν into the
  main verb "went".
- Pronouns rendered by nouns, linked with a note: αὐτόν = Jesus (14:1), αὐτῷ =
  Jesus (14:15, 14:25), ὁ = Jesus (14:16), αὐτοῦ = the other king (14:32).
- Unrendered words `s`: ὑπό τινος and ὑπ’ αὐτοῦ (14:8), τότε after καί
  (14:9), adverbial καί (14:12 twice, 14:34), γάρ (14:14, 14:28), οὖν (14:33,
  14:34), ὧδε and two list καί (14:21), τε (14:26), αὐτῷ (14:16).
- 14:12: the repeated σου after brothers and relatives is `s`; "your" sits on
  the first σου.
- Kept joined as publisher rows: "someone more distinguished" (14:8), "many
  guests" (14:16, as "many things" elsewhere), "owner of the house" (14:21),
  ἄρξῃ = "you will have" (14:9), μήγε = "he is unable" (14:32).

## Doubts for the peer

- 14:10: ὅταν = and#1 ("will come and tell"), so that the Greek `s` and the
  English `t` are not split. The alternative is `s` for ὅταν and `t and#1`.
- 14:7: πρὸς τοὺς κεκλημένους = the guests, although BSB makes the guests the
  subject of "chose"; πρὸς αὐτούς = them. The alternative is τοὺς κεκλημένους
  = them and πρὸς αὐτούς `s`.
- 14:29: ἄρξωνται … ἐμπαίζειν joined = will ridicule. The alternative is `s`
  for ἄρξωνται ("begin").
- 14:25: δέ = now ("were now traveling"). The alternative is `s` plus
  `t now`.
- 14:1: αὐτοί = those with `t in attendance`. The publisher had the whole
  phrase on αὐτοί.
- 14:28: three `t` (to see, the resources, it) where the publisher had them
  on εἰ, ἔχει and ἀπαρτισμόν.
- 14:24: ἐκείνων = "of those" kept (publisher row); moving "of" to ἀνδρῶν
  would match the case-word-on-the-noun habit.
