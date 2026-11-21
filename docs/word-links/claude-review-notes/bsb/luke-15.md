# BSB Luke 15: author review (Claude)

Verses reviewed: 31 (15:1-11, 15:13-32). 15:12 was kept unchanged from the
earlier Codex review (KEEP block); the final file's 15:12 is byte-identical to
the base. Final check: `fromtext` → `{"versesOk": 32, "problems": 0}`.

82 of the 453 publisher `g` rows changed. 18 of them only gained unlinked
Greek tokens or were joined into one unit, with the English unchanged (for
example πρὸς αὐτούς = them 15:3, ἐνενήκοντα ἐννέα = ninety-nine 15:4 and 15:7,
τὸ ἀπολωλός = the one that is lost 15:4 and lost 15:6, εἰς τὸν οἶκον = home
15:6, χρείαν ἔχουσιν = do + need 15:7, ἣν ἀπώλεσα = lost 15:9, οὐ πολλάς = a
few and καὶ ἐκεῖ = where 15:13, τὸν σιτευτόν = fattened 15:23 and 15:27,
ἐρχόμενος ἤγγισεν = he approached 15:25, ἂν εἴη ταῦτα = was going on 15:26,
οὐκ ἤθελεν = refused 15:28, ὁ καταφαγών = squandering 15:30). The other 64
rows, in 25 verses, were corrected, split or moved. Matthew 18:12-14 was
followed for the lost sheep (15:4-7): the joined ninety-nine, the article +
participle "the one that is lost", οὕτως = "In the same way".

## Publisher rows corrected

Names and words supplied by English that had been folded into a Greek word (now `t`):

- "Jesus" sat on 15:3 εἶπεν ("Jesus told") and 15:11 Εἶπεν ("Jesus said"); now told / said with `t Jesus`.
- 15:11: τις "There was a" → a; `t There was` (presentational frame).
- 15:28: ὠργίσθη "The older son became angry" → became angry; `t The older son`.
- Objects: 15:5 εὑρών "when he finds it" and ἐπιτίθησιν "he joyfully puts it" → when he finds; he + puts; χαίρων = joyfully; `t it#0`, `t it#1`. 15:9 εὑροῦσα "when she finds it" → `t it`. 15:16 αὐτῷ "him a thing" → him; `t a thing`. 15:22 ἐνδύσατε "put it on" → put + on; `t it`. 15:23 θύσατε "and kill it" → kill; `t and#0`, `t it`.
- 15:14: πάντα "all he had" → all; `t he had`.
- 15:20: δραμών "He ran to his son" → He ran; `t to his son`. ἐπέπεσεν "embraced him" → ἐπέπεσεν ἐπὶ τὸν τράχηλον = embraced, αὐτοῦ = him (the four tokens had been TODO).
- 15:29: ἔριφον "even a young goat" → a young goat; `t even`.
- 15:31: ἐμά "is mine" → τὰ ἐμά = that + mine; `t is#0` (supplied copula; the lone article τά had "that").

Supplied "and" after a participle (now `t`): 15:13 journeyed, 15:15 hired himself out, 15:17 said, 15:18 go back, 15:20 went, 15:23 celebrate, 15:26 asked, 15:28 pleaded with.

Negatives and auxiliaries:

- 15:4: οὐ "does not" → not; καταλείπει = does + leave. 15:8: οὐχί "does not" → not; ἅπτει = does + light.
- 15:18: ἀναστάς "I will get up", πορεύσομαι "and go back" → ἀναστάς = get up; πορεύσομαι = I will + go back (the future belongs to the finite verb, as Matthew 13:28).
- 15:29: ἔδωκας "you never gave" → you + gave; οὐδέποτε (the second, TODO) = never#1.

"When", "After", "While" on the wrong word:

- 15:14: δέ "After" → `s`; δαπανήσαντος = After + had spent (genitive absolute).
- 15:20: δέ "But while", αὐτοῦ "he was", ἀπέχοντος "in the distance" → δέ = But; αὐτοῦ = he; ἀπέχοντος = while + was; μακράν (TODO) = in the distance.

Other words on the wrong Greek word:

- 15:7: ἔσται "there will be more", ἤ "than" → there will be; ἤ = more + than (ἤ after a positive gives the comparison "rather than").
- 15:8: ἕως "until", οὗ "it" → ἕως οὗ = until; `t it`.
- 15:10: ἐνώπιον "in the presence", Θεοῦ "of God’s" → in the presence of; God’s (as ἐνώπιον elsewhere in the reviewed Gospels).
- 15:15: ἐκείνης "of that" → that; χώρας = of + country. 15:19: τῶν "of" → `s`; μισθίων = of + hired servants. 15:26: τῶν "of the" → the; παίδων = of + servants.
- 15:17: ἐγώ "I am" and ἀπόλλυμαι "to death" → I; am + to death. τοῦ "of" → `s`; Πόσοι = How many of.
- 15:13: συναγαγών "got everything together" → got + together; πάντα = everything. μακράν "a distant" and χώραν "country" → distant; a + country. 15:14: ἰσχυρά "a severe" → severe; λιμός = a + famine.
- 15:6: συνκαλεῖ "and calls together" → calls together; the opening καί (TODO) = and#0.
- 15:27: εἶπεν "he said" → ὁ = he; εἶπεν = said. ἀπέλαβεν "he has him back" → he has + back; αὐτόν = him.
- 15:29: ἀποκριθείς "he answered" → ὁ = he; ἀποκριθεὶς εἶπεν = answered.
- 15:31: εἶπεν "the father said" → ὁ = the father (ὁ δέ, as elsewhere); εἶπεν = said.
- 15:32: ἀπολωλώς "he was lost" → lost; ἦν = was#1 + was#2 (understood again); `t he`.

## Readings

- Only 15:7 and 15:29 have EVIDENCE lines showing publisher Greek different from N1904.
- 15:29: one extra publisher word; "his" (father) is `t` with the reading reason (probably αὐτοῦ after τῷ πατρί). τῷ is `s`.
- 15:7: no word unmatched either way (probably word order only); no reading is claimed.

## Notable decisions

- 15:6: the opening καί, which joins ἐπιτίθησιν (15:5) to συνκαλεῖ, is linked to the "and" of BSB's list "puts …, comes home, and calls", instead of `s` plus `t and`.
- 15:8: ἐάν = "and" (publisher row kept, with a note): BSB recasts "if she loses" as "who has … and loses". δραχμήν = "of them" kept with a note.
- 15:9: τήν = my (article as possessive, publisher row kept); ἣν ἀπώλεσα joined = lost.
- 15:17: δέ = Finally and 15:25 δέ = Meanwhile kept as renderings of the connective (like "At this"). ἑαυτόν = his senses kept, with a note on the idiom.
- 15:15: the καί before ἔπεμψεν = who (publisher row kept, with a note).
- 15:25: ὁ before πρεσβύτερος keeps "the" (publisher); the first ὁ and αὐτοῦ are `s`.
- 15:30: ἦλθεν = "returns from" kept (publisher); only the article was added to καταφαγών.

## Doubts for the peer

- 15:23: the καί before φαγόντες is `s` (new sentence) and the "and" in "feast and celebrate" is `t` (participle joiner). Linking καί = and#1 is the alternative.
- 15:6: and#0 on the opening καί (see above); the alternative is `s` + `t and#0`.
- 15:17: λιμῷ = starving and ἀπόλλυμαι = am + to death are split; joining them as "am + starving to death" is the alternative. Πόσοι = "How many of" could leave "of" as `t`.
- 15:20: "he got up" stays on ἀναστάς (and 15:15 "he went" on πορευθείς), while in 15:18 "I will" moved to the future πορεύσομαι because "will" is the tense.
- 15:20: ἀπέχοντος = while + was and μακράν = in the distance; joining them is the alternative.
- 15:32: ἦν linked to both "was" (understood again); the alternative is `t he was`.
