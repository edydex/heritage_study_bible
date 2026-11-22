# BSB Luke 20: author review (Claude)

Verses reviewed: all 47 (20:1-47). No verse was kept from an earlier review
(the draft had no KEEP blocks). Final check: `fromtext` →
`{"versesOk": 47, "problems": 0}`; a `totext` roundtrip of the result is
identical to the edited text.

140 of the 578 publisher `g` rows changed. 17 of them only gained unlinked
Greek tokens or were joined into one unit, with the English unchanged (εἶπαν
λέγοντες = they said 20:2, ὁ δούς = gave 20:2, Διὰ τί = Why 20:5, προσέθετο
πέμψαι = he sent 20:11-12, κεφαλὴν γωνίας = the cornerstone 20:17, ὁ πεσών =
who falls 20:18, ἐπιβαλεῖν ἐπ’ αὐτὸν τὰς χεῖρας = to arrest 20:19, πρὸς αὐτούς
= them 20:25, οὐκ ἴσχυσαν = were unable 20:26, ἵνα λάβῃ = is to marry and ὁ
ἀδελφὸς αὐτοῦ = the man 20:28, ἔσχον … γυναῖκα = were married 20:33,
ἀποκριθέντες … εἶπαν = answered 20:39, ἕως ἄν = until 20:43, τῶν θελόντων =
They like 20:46, τῶν χηρῶν = widows 20:47). The other 123 rows were corrected,
split or moved. The parallels Mark 11:27-12:40 and Matthew 21:23-22:46 were
followed wherever the Greek is the same.

## Publisher rows corrected

Names and words supplied by English that had been folded into a Greek word (now `t`):

- "Jesus" on a verb: 20:3 εἶπεν, 20:19 εἶπεν ("Jesus had spoken"), 20:23 κατανοήσας, 20:41 Εἶπεν, 20:45 εἶπεν. 20:1 "as Jesus" on αὐτοῦ → Jesus (the pronoun), "as" to the genitive absolute.
- Objects and subjects: 20:1 ἐπέστησαν "came up to Him" → came up, `t to Him`. 20:14 "they discussed it" → `t it`. 20:16 ἀκούσαντες "when the people heard this" → when + heard, `t the people`, `t this`. 20:20 παρατηρήσαντες "they watched Him closely" → watched + closely, `t Him#0`. 20:7 πόθεν "where it was from" → where + from, `t it was`.
- "that" before an infinitive clause (`t`, as earlier Luke chapters): 20:6 "convinced that", 20:7 "answered that", 20:41 "can it be said that". 20:28 ἐάν "that if" → if, `t that` (no ὅτι here, unlike Mark 12:19).
- 20:17 τοῦτο "the meaning of" → τοῦτο = that; τὸ γεγραμμένον = which is written; `t the meaning of`. 20:37 Βάτου "burning bush" → bush, `t burning` (as Mark 12:26). 20:29 "first one" → first, `t one`.

Supplied "and"/"but" after a participle (now `t`): 20:5 said, 20:10 beat, 20:12 wounded, 20:14 said, 20:15 threw, 20:17 looked, 20:20 watched, 20:23 saw through, 20:28 leaves, 20:29 married ("but died").

Pronoun objects folded into verbs (one Greek object, repeated in English):

- 20:10 αὐτόν (TODO) = the servant + him; δείραντες "beat the servant" → beat; ἐξαπέστειλαν "and sent him away" → sent + away.
- 20:11 κἀκεῖνον (TODO) = him#0 + him#1 + him#2; "they beat him", "treated him shamefully", "sending him away" lose "him"; οἱ = they.
- 20:12 τοῦτον = him#0 + him#1; ἐξέβαλον "and threw him out" → threw + out; οἱ = they.
- 20:15 αὐτόν = him#0 + him#1; ἀπέκτειναν "and killed him" → killed.
- 20:9 ἐξέδετο / αὐτόν "rented" / "it out" → rented + out / it (as Mark 12:1).

Negatives and auxiliaries split:

- 20:5 "did you not believe" → οὐκ (TODO) = not; did you + believe. 20:7 "they did not know" → μή = not; they did + know. 20:40 "they did not dare" → they did + dare; οὐκέτι (TODO) + οὐδέν = not + any further.
- 20:21 οὐ "You show no partiality" → no; λαμβάνεις πρόσωπον = You show + partiality.
- 20:8 ἐγώ "will I", λέγω "tell" → I; will + tell (as Mark 11:33). 20:3 Ἐρωτήσω "I will also ask" → will + ask; κἀγώ (TODO) = I + also (as Matthew 21:24).
- 20:15 ὁ "will the" → the; ποιήσει = will + do. 20:16 δώσει → will#1 give. 20:33 γίνεται "will she be" → will + be; ἡ γυνή (TODO) = she. 20:35 οὔτε "will neither" → neither; γαμοῦσιν = will + marry.

"When" on the wrong word:

- 20:14: δέ "But when" → But; ἰδόντες = when + saw (as Matthew 21:38).
- 20:19: the opening Καί "When" → `s`; γάρ (TODO) = When: BSB moves "for they knew" first as "When … realized".

Case words and prepositions on articles (moved to the noun, as most reviewed Luke chapters):

- "of the" on τοῦ/τῶν → the; "of" to the noun: 20:10 (twice), 20:13, 20:15, 20:20, 20:27, 20:36, 20:39. 20:34 τούτου "of this" → this; αἰῶνος = of + age.
- 20:20 τῇ "to the" → the; ἀρχῇ = to + rule. 20:43 τῶν "for" → `s`; ποδῶν = for + feet. 20:45 τοῖς "to" → `s`; μαθηταῖς = to + disciples. 20:42 μου "to my" → my; Κυρίῳ = to + Lord (as Mark 12:36). 20:28 τῷ "for" → τῷ ἀδελφῷ αὐτοῦ = for him (as Mark 12:19). 20:47 τάς "of their" → their; κατεσθίουσιν = defraud + of (as Mark 12:40).
- 20:19 τόν "of the" → the; ἐφοβήθησαν = they were afraid of.

Other words on the wrong Greek word:

- 20:35: ἐκείνου had "in#0" and αἰῶνος "age to come" → αἰῶνος = age; ἐκείνου = to come; τυχεῖν = to share in + in#1 (understood again); τῆς "in the" → the. οἱ καταξιωθέντες joined.
- 20:18: ὅν "he on whom" → ὃν … ἄν = whom; αὐτόν (TODO) = he (passive), as Matthew 21:44.
- 20:20: αὐτοῦ "in His", λόγου "words", "to catch Him" → catch; αὐτοῦ = Him + His; λόγου = in + words; ὥστε … "hand Him over" → hand + over, αὐτόν (TODO) = Him. 20:26 the same: "to trap Him in" → to trap; αὐτοῦ = Him + His; ῥήματος = in + words.
- 20:10: ἀπό "his share", τοῦ "of the" → ἀπό = share of; αὐτῷ (TODO) = his (the recipient); τοῦ = the.
- 20:19: αὐτῇ "that very" → very; τῇ (TODO) = that.
- 20:25: "what is" → τά = what, `t is` (as Mark 12:17); ὁ (TODO) = Jesus.
- 20:27: "who" / "say there is no" → οἱ ἀντιλέγοντες = who say; μή (TODO) = no; εἶναι = there is (as Mark 12:18).
- 20:28: τήν "his brother’s" / γυναῖκα "widow" → joined = his brother’s widow (as Mark 12:19).
- 20:31, 20:33: οἱ "all" + ἑπτά "seven" → joined = all seven (as Mark 12:23).
- 20:47: μακρά "make lengthy prayers" → lengthy; προσεύχονται (TODO) = make + prayers (as Mark 12:40).
- 20:9: ἄνθρωπος "man" → A man (English "A" goes with the noun).
- 20:16: "May such a thing never happen" → Μή = never; γένοιτο = May such a thing + happen.
- 20:24: εἶπαν "they answered" → answered; οἱ = they. 20:5 "They deliberated" → οἱ = They; deliberated (ὁ δέ / οἱ δέ as in Matthew and Mark). 20:17 and 20:25 ὁ δέ = Jesus.

## Readings

- EVIDENCE shows publisher Greek different from N1904 only in 20:4, 20:6, 20:9, 20:16 and 20:45.
- 20:4, 20:6: one word unmatched each way, almost certainly the name John (probably Ἰωάννου / Ἰωάννην with double nu). Linked with "Same name, spelled differently in BSB's Greek text."
- 20:9: one extra publisher word, probably τις after ἄνθρωπος ("a certain man"). No reading is claimed: BSB's "A" goes with the noun anyway.
- 20:45: one extra publisher word, probably αὐτοῦ after τοῖς μαθηταῖς. "His" is `t` with the reading reason; τοῖς is `s`.
- 20:16: no word unmatched either way (probably order or spelling only); no reading claimed.

## Notable decisions

- 20:1: ἐν μιᾷ τῶν ἡμερῶν = One day and Καὶ ἐγένετο `s`, as Luke 5:17 and 8:22.
- 20:2: τίς ἐστιν ὁ δούς: ὁ δούς = gave, ἐστιν `s`.
- 20:9: πρός before τὸν λαόν is `s` (the people is the indirect object of tell); "the people" stays on τὸν λαόν.
- 20:14: ἵνα = and (publisher row kept, with a note).
- 20:17: ὁ δέ = Jesus; the quotation follows Mark 12:10 (ὅν, οὗτος, εἰς `s`).
- 20:24: ἔχει = "are on it" kept, with a note.
- 20:25: Τοίνυν = So (publisher row kept); δέ `s`.
- 20:28: καὶ οὗτος ἄτεκνος ᾖ: ἄτεκνος = no children, οὗτος and ᾖ `s`; καί = but.
- 20:36-37: anarthrous Θεόν keeps "the God" (publisher); ὡς = For and ἐπί = "in the passage about" kept with notes.
- 20:40: γάρ = And kept.

## Doubts for the peer

- 20:20, 20:26: αὐτοῦ = Him + His (BDAG reads a genitive of person and of thing with ἐπιλαμβάνομαι). The alternative is αὐτοῦ = His only with `t Him`.
- 20:19: γάρ = When, opening Καί `s`. The publisher had Καί = When. Also τῇ = that and αὐτῇ = very are split; "that very" on αὐτῇ with τῇ `s` is the alternative.
- 20:45: "His" as a reading (`t`) rather than τοῖς used as a possessive; this rests only on the EVIDENCE count.
- 20:6, 20:7, 20:41: "that" before infinitive clauses moved to `t`; the publisher had it on the main verb.
- 20:35: ἐκείνου = "to come" (that age = the age to come); τυχεῖν = "to share in" + "in#1".
- 20:40: οὐκέτι and οὐδέν joined as not + any further; οὐδέν `s` is the alternative.
- 20:33: ἡ γυνή = she, with γίνεται = will + be. The publisher had "will she be" on the verb.
