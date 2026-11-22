# BSB Luke 22: author review (Claude)

Verses reviewed: 71 (22:1-71). No verse was kept from an earlier review (the
draft had no KEEP blocks). 22:43-44 are linked like any other verse. Final
check: `fromtext` → `{"versesOk": 71, "problems": 0}`.

Of the 893 publisher `g` rows, 698 are unchanged and 28 only gained unlinked
Greek tokens with the English unchanged (e.g. ἡ λεγομένη = called 22:1;
Εἰσῆλθεν … εἰς = entered 22:3; τὸ πῶς = how 22:4; τοῦ παραδοῦναι = to betray
22:6; εἰς ἣν εἰσπορεύεται = he enters 22:10; Ἐπιθυμίᾳ ἐπεθύμησα = I have
eagerly desired, πρὸ τοῦ = before 22:15; ἕως οὗ / ἕως ὅτου = until 22:16,
22:18; τὸ … διδόμενον = given 22:19; τὸ δειπνῆσαι = supper 22:20; τὸ
ὡρισμένον, δι’ οὗ 22:22; τὸ τίς, ὁ … μέλλων 22:23; τοῦ σινιάσαι 22:31; τὸ
γεγραμμένον = Scripture, καὶ γάρ = For 22:37; κατὰ τὸ ἔθος = as usual 22:39;
θεὶς τὰ γόνατα = knelt down 22:41; τὸ σόν = Yours 22:42; εἷς τις = one 22:50;
ἀποκριθεὶς … εἶπεν = answered 22:51; στρατηγοὺς τοῦ ἱεροῦ = temple officers
22:52; ἄλλος τις, Ἐπ’ ἀληθείας 22:59; ὁ παίσας = hit 22:64; ὡς ἐγένετο ἡμέρα
= At daybreak 22:66; ἔχομεν … χρείαν = do we need 22:71). The other 167 rows,
in 63 verses, were corrected, split, joined or moved.

Parallels followed: Mark 14:1-2, 10-16 and Matthew 26:14-19 for 22:1-13;
Mark 14:17-25 and Matthew 26:20-29 for 22:14-23; Mark 10:42-44 for 22:25-26;
Mark 14:29-31 for 22:33-34; Mark 14:32-38 and Matthew 26:36-41 for 22:39-46;
Mark 14:43-49 and Matthew 26:47-55 for 22:47-53; Mark 14:53-54, 66-72 and
Matthew 26:69-75 for 22:54-62; Matthew 26:67-68 for 22:63-64; Mark
14:62-64 and Matthew 26:64-65 for 22:69-71.

## Publisher rows corrected

Names and words supplied by English that had been folded into a Greek word (now `t`):

- "Jesus" on ἀπέστειλεν (22:8), εἰρήκει (22:13), ἀνέπεσεν (22:14), εἶπεν
  (22:35, 22:67), ἐξελθών (22:39), ἀναστάς (22:45); "Judas" on ἀπελθών (22:4)
  and ἐξωμολόγησεν (22:6). Where BSB names Jesus for an explicit αὐτόν (22:2,
  22:4, 22:6, 22:49, 22:54, 22:63, 22:66), the name is linked to the pronoun
  with a note (Mark 14:1, 14:10 pattern).
- ὁ δέ / οἱ δέ: "Jesus declared/replied" (22:25, 22:34), "said Peter" (22:33),
  "Peter denied it" (22:57), "they asked/said" (22:9, 22:38, 22:71), "He
  answered/replied" (22:10, 22:38, 22:70): the article now carries the
  pronoun or name, the verb keeps the verb.
- Supplied objects: "it" (22:9 prepare, 22:13 found, 22:17 divide, 22:19
  twice, 22:36 take, 22:57 denied, 22:71 heard), "Him" (22:54 twice, 22:63
  beat), "you" (22:68 ask). Supplied copulas: "is" (22:20 cup#1 is, 22:21
  is with, 22:27 is greater), "are" (22:38 here are), "Is it" (22:27).
- 22:20: τό "He took the" → the; `t He took` (the verb is carried over from
  v. 19).
- 22:26: οὐχ "shall not be" → not; `t shall`, `t be#0` (elliptical Greek).
- 22:32: σοῦ "you, Simon" → you; `t Simon`.
- 22:37: τό "what is written" → what; `t is written` (the Greek has only τὸ
  περὶ ἐμοῦ).
- 22:44: ἐν "in His" → γενόμενος ἐν = in; `t His#0`.
- 22:45: ἀπό "exhausted from" → from; `t exhausted`.
- 22:49: μαχαίρῃ "our swords" → swords; `t our`.
- 22:51: τοῦ "the man’s" → the; `t man’s`.
- 22:55: περιαψάντων "those present had kindled" → When + had kindled; `t
  those present`.
- 22:58: ἐξ "one of" → of; `t one` (Mark 14:69-70).
- 22:59: ἐστιν "he too is" → he + is; καί (TODO) = too.

Supplied "and" after a participle (now `t`): 22:8 Go and prepare, 22:13 went
and found, 22:17 gave thanks and said, 22:19 gave thanks and broke, 22:41
knelt down and prayed, 22:43 and strengthened, 22:45 rose … and returned,
22:46 Get up and pray, 22:49 saw … and said, 22:51 touched … and healed,
22:58 saw him and said, 22:61 turned and looked, 22:62 went outside and
wept, 22:63 mock Him and beat, 22:64 blindfolded Him and kept demanding,
22:66 led … and said.

"When/While/After" on the wrong word:

- 22:17: καί "After" → `s`; δεξάμενος = After taking.
- 22:40: δέ "When" → `s`; γενόμενος = When + He came.
- 22:45: καί "When" → `s`; ἀναστάς = When + rose.
- 22:47: Ἔτι "While" → still; λαλοῦντος = While + was + speaking (Mark
  14:43, Matthew 26:47). 22:60: same pattern (ἔτι = still).
- 22:55: δέ "When" → `s`; περιαψάντων = When + had kindled.

Negatives split off verbs: 22:16 (οὐκέτι οὐ μή = not + again; φάγω = I will +
eat; "again" removed from ἕως), 22:18 (οὐ μή = not; πίω = I will + drink),
22:32 (μή = not; ἐκλίπῃ = will + fail), 22:34 (οὐ = not; φωνήσει = will +
crow), 22:40 (μή = not), 22:46 (μή = not), 22:53 (οὐκ = not; ἐξετείνατε =
you did + lay), 22:57 and 22:60 (Οὐκ/οὐκ = not; οἶδα = I do + know), 22:67-68
(οὐ μή = not; you will + believe / answer).

Articles and case words (a lone article never carries a preposition or a
noun): "of"/"to" moved from the article to the noun in 22:1, 22:7, 22:11
(τῷ "to the" → the; οἰκοδεσπότῃ = to + owner; τῆς "of that" → that; οἰκίας =
of + house), 22:18, 22:22, 22:25, 22:50, 22:54, 22:55, 22:66, 22:69. Mark 14
and Matthew 26 still put "of the" on the article in the same phrases; the
indeclinable δώδεκα (22:47) and Ἰσραήλ (22:30) keep the case word on the
article. 22:3: τοῦ "the" → `s`; τῶν (TODO) = the (the Twelve).

Article + participle joined (rule 3): 22:26 the one who leads / the one who
serves; 22:27 the one who reclines at the table / the one who serves (twice);
22:28 the ones who have stood; 22:36 the one with / the one without (μή
included: ὁ μὴ ἔχων); 22:47 the man called; 22:49 what was about to happen;
22:52 the … who had come (τοὺς παραγενομένους; "the" was on ἀρχιερεῖς and
"who" on the article); 22:63 who were holding.

Other words on the wrong Greek word:

- 22:2: ἐζήτουν "were looking" + πῶς "for a way" → were looking for; τὸ πῶς
  = a way (Mark 14:1). ἀνέλωσιν "to put Jesus to death" → to put + to death.
- 22:12: μέγα "a large" → large; ἀνάγαιον = a + upper room (Mark 14:15).
- 22:14: ἀνέπεσεν "Jesus reclined at the table" → reclined at the table.
- 22:21: παραδιδόντος "of My betrayer" → τοῦ παραδιδόντος = of + betrayer;
  με (TODO) = My.
- 22:24: τό "as to" → τὸ τίς = as to which; δοκεῖ εἶναι (TODO) = would be
  considered.
- 22:29: διέθετό "has bestowed one" → has bestowed; `t one`.
- 22:35: ἀπέστειλα "I sent you out" → I sent + out; ὑμᾶς (TODO) = you.
- 22:36: ἀγορασάτω "buy one" → buy; μάχαιραν = a sword + one (BSB takes the
  sword with both "without" and "buy").
- 22:38: ὧδε "here are" → here; `t are`.
- 22:52: ἐπί "you would against" → against; `t you would` (Matthew 26:55).
- 22:53: "and you did not lay" on ἐξετείνατε → you did + lay, `t and#0`; τάς
  "a" → `s`, χεῖρας = a hand; ἡ "to the" → the, `t to#1`.
- 22:54: ἤγαγον "led Him away" → led + away; εἰσήγαγον "took Him" → took.
- 22:64: καί "They" → `s`; περικαλύψαντες = They blindfolded.
- 22:65: ἕτερα "things", πολλά "many other" → ἕτερα = other + things; πολλά =
  many.
- 22:71: αὐτοί "ourselves" + γάρ "for" → αὐτοί = for ourselves; γάρ `s` (the
  English "for" here means "personally", not "because").

## Readings

- 22:7: one extra publisher word. "on which" is linked to the dative ᾗ (a time
  expression with the same sense) with the note "BSB follows a reading with
  an extra word here" (probably ἐν ᾗ).
- 22:8: Ἰωάνην = John with the spelling note (probably Ἰωάννην).
- 22:18: one extra publisher word; "that" is `t` with the reading reason
  (probably ὅτι after ὑμῖν).
- 22:23: συνζητεῖν = to question with "Same word, spelled differently"
  (probably συζητεῖν).
- 22:66-67: a verse-division difference. BSB renders λέγοντες as "and said"
  at the end of v. 66; N1904 starts v. 67 with it. Linked cross-verse:
  22:66 `g @22:67 0 = said`, 22:67 `m 0 > 22:66`; "and#1" is `t`.
- 22:24, 22:31, 22:60: EVIDENCE says "differs" with no word unmatched either
  way (probably order); no reading is claimed.

## Notable decisions

- 22:3: ἀριθμοῦ = one with ἐκ = of (ἐκ τοῦ ἀριθμοῦ "of the number"); τὸν
  καλούμενον `s` (BSB has no "called").
- 22:14: αὐτῷ = His kept (publisher), with the recast "with His apostles"
  noted; the καί before οἱ ἀπόστολοι and the article are `s`.
- 22:22: μέν = Indeed kept (publisher); ὅτι `s` (Mark 14:21); δι’ οὗ = who,
  παραδίδοται = betrays Him kept for the active recast.
- 22:31: ὑμᾶς = each of you (plural "you all").
- 22:32: ποτε joined to the participle: ποτε ἐπιστρέψας = when + have turned
  back (the brief puts "when" on the participle; ποτε has no other English).
- 22:34: μή after ἀπαρνήσῃ is `s` (redundant negative after a verb of
  denying); εἰδέναι = that you know kept.
- 22:41: καί = where kept with a note (Mark 14:16 pattern); ἀπ’ = beyond kept
  with a note.
- 22:42: λέγων `s` (no "saying" in BSB; the prayer follows "prayed" in v. 41).
- 22:47: ἰδού = arrived kept (publisher) with the note "ἰδοὺ ὄχλος is rendered
  a crowd arrived": the clause has no other verb. καί before ὁ λεγόμενος and
  αὐτούς `s` (recast "led by").
- 22:51: Ἐᾶτε ἕως τούτου joined = No more of this (idiom).
- 22:53: ὄντος = was, μου = I kept; the genitive absolute is a main clause in
  BSB, so "and#0" is `t`.

## Doubts for the peer

- 22:7: "on which" on ᾗ with a reading note; the alternative is ᾗ = which and
  `t on` with the reading reason (the publisher left "on" for its extra word).
- 22:47: ἰδού = arrived; the alternative is ἰδού `s` and `t arrived` (Matthew
  26:47 has ἰδού `s`, but there ἦλθεν supplies "arrived").
- 22:36: μάχαιραν = a sword + one (one noun read with both clauses); the
  alternative is `t one`.
- 22:44: γενόμενος ἐν = in; the alternative is γενόμενος `s`.
- 22:29: "one" (has bestowed one) is `t`; Luke 18:33 linked a repeated object
  pronoun to the Greek object instead.
- 22:24: δοκεῖ εἶναι joined = would be considered; τὸ τίς = as to which.
- The "of/to" moves from article to noun follow the brief and recent Luke
  chapters; the Mark 14 / Matthew 26 parallels still have "of the" on the
  article in the same phrases (22:18, 22:22, 22:50, 22:54, 22:69).
