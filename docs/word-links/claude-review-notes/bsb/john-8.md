# BSB John 8: author review (Claude)

Verses reviewed: 58 (8:1-40, 8:42-59). Kept unchanged: 8:41 (reviewed
earlier by Codex, marked KEEP; checked byte-equal to the committed reviewed
verse). Final check: `fromtext` → `{"versesOk": 59, "problems": 0}`.

Of the 845 publisher `g` rows in the 58 verses, 698 are unchanged. 23 more
only gained unlinked Greek tokens, with the English unchanged (for example
ἀπεκρίθη … καὶ εἶπεν = replied 8:14; ἀπεκρίθησαν καὶ εἶπαν = they replied /
answered 8:39, 8:48; ἐὰν μή = unless 8:24; ἂν ᾔδειτε = you would know 8:19;
οὐ δύνασθε = cannot 8:21, 8:22; διὰ τί = Why/why 8:43, 8:46). The other 124
rows, in 47 verses, were corrected, split, joined or moved.

No Synoptic parallel. 8:1-11 (the adulterous woman) is in both N1904 as
displayed and BSB, so it is linked normally. ἐγώ εἰμι in 8:24, 8:28 and 8:58
is linked ἐγώ = I and εἰμι = am with no interpretive note; the supplied "He"
of "I am He" (8:24, 8:28) is `t` with the Mark 13:6 / Luke 21:8 reason
("English supplies a predicate; ἐγώ εἰμι ("I am") has none.").

## Publisher rows corrected

Negatives and auxiliaries split off verbs (οὐ/μή → not/never; the verb keeps
do/did/has/will):

- 8:10 οὐδείς "Has no one" → no one, κατέκρινεν = Has + condemned. 8:11 ἐγώ "do I" → I, κατακρίνω = do + condemn.
- 8:12 οὐ μή = never, περιπατήσῃ = will + walk; the same in 8:51 (θεωρήσῃ = he will + see) and 8:52 (γεύσηται = will + taste), where οὐ μή … εἰς τὸν αἰῶνα is one group = never (Mark 3:29 precedent).
- 8:14, 8:19, 8:45, 8:47, 8:49, 8:50, 8:55 (×2): "do/did not" rows split into not + do/did + verb; 8:46 ὑμεῖς "do you" → you, πιστεύετε = do + believe. 8:19 Οὔτε … οὔτε = not … or.
- 8:20 οὔπω "had not yet" → not yet, ἐληλύθει = had + come. 8:27 ἔγνωσαν "They did not understand" → not + They did + understand. 8:29 ἀφῆκέν "He has not left" → not + He has + left. 8:42 ἐλήλυθα "I have not come" → οὐδέ = not + I have + come. 8:43 γινώσκετε "do you not understand" → not + do you + understand.
- 8:15 οὐ … οὐδένα joined = no one (double negative). 8:33 δεδουλεύκαμεν "We have never been slaves" → We have + been slaves; οὐδενὶ … πώποτε = never + to anyone.

Articles carrying words they do not mean:

- 8:6 τῷ "with" → His (article as possessive), δακτύλῳ = with + finger. 8:7 τόν "be the" → `s`; λίθον = a stone; "be" `t`; Ὁ "Let him who is" → Ὁ ἀναμάρτητος = him who is without sin; "Let" moved to βαλέτω (Let + to cast).
- 8:12 τοῦ "of the" → the, κόσμου = of + world. 8:34 τῆς "to" → `s`, ἁμαρτίας = to sin. 8:17 τῷ "own" → `s`, ὑμετέρῳ = your own. 8:50 τήν "own" → `s`, "own" `t`. 8:25 Τήν "from the" → Τὴν ἀρχήν = from the beginning. 8:27 τόν "about the" → the; "about" to ἔλεγεν (as John 3:11). 8:43 τήν "what" → `s`; λαλιάν = what + am saying, ἐμήν = I. 8:29 τά "what" → τὰ ἀρεστά = what pleases. 8:35 ὁ "but a" → `s`; "but" `t`.
- 8:39 Ἀβραάμ "of Abraham" (×2) → τοῦ = of, Ἀβραάμ = Abraham (indeclinable name: case word on the article).

Article + participle (or substantival adjective) units joined (rule 3): 8:12 ὁ ἀκολουθῶν, 8:18 ὁ μαρτυρῶν, 8:26 ὁ πέμψας, 8:29 ὁ πέμψας, 8:34 ὁ ποιῶν τὴν ἁμαρτίαν = who sins, 8:47 ὁ ὢν ἐκ = Whoever belongs to, 8:50 ὁ ζητῶν, 8:54 ὁ δοξάζων; also 8:5 τὰς τοιαύτας, 8:23 τῶν κάτω / τῶν ἄνω.

Supplied English words folded into Greek words (now `t`):

- "and" that only joins a participle clause to the main verb: 8:4 (στήσαντες of 8:3), 8:6, 8:7, 8:8, 8:10; λέγων "and said" 8:12 → said + `t and`.
- 8:6 ἔχωσι: "a basis" `t`. 8:9 ἀκούσαντες "When they heard this" → οἱ = they, ἀκούσαντες = When + heard, `t this`. 8:18 μαρτυρεῖ "also testifies" → testifies, `t also`. 8:43 ὅτι "It is because" → because, `t It is`. 8:48 Οὐ "Are we not" → not; ἡμεῖς = we; `t Are`. 8:50 ζητῶν "seeks it" → `t it`; κρίνων "He is the Judge" → Judge, `t He is the`. 8:52 λέγεις "say that" → say, `t that` (direct quotation in Greek). 8:56 εἶδεν "He saw it" → `t it`. 8:11 Οὐδέ "Then neither" → neither, `t Then`.
- 8:16 καί "am with" → with; `t am` (ἀλλ’ ἐγὼ καὶ ὁ πέμψας με has no verb).

Other corrections:

- 8:14 πόθεν "where" + ἦλθον/ἔρχομαι "I came from" (×2) → πόθεν = where + from (as John 3:8).
- 8:26 καί "and much" → and; πολλά = much + much (object of both infinitives). κἀγώ "and" → and + I (its ἐγώ is the subject of tell); λαλῶ = tell.
- 8:28 ὅτι = that + that (BSB repeats it for the καί clause); καί "and that" → and. καθώς "exactly" + ταῦτα "what" → καθὼς … ταῦτα = exactly what.
- 8:30 αὐτοῦ "As Jesus" → Jesus; λαλοῦντος = As + spoke (When/As belongs to the genitive absolute).
- 8:32 ἐλευθερώσει "will set you free" and 8:36 ἐλευθερώσῃ "sets you free" → ὑμᾶς = you split off.
- 8:33 σύ "can You" → You; λέγεις = can + say.
- 8:38 ἅ "of what" → what; λαλῶ = I speak of (as John 3:11).
- 8:44 τῶν "his" + ἰδίων "native language" → ἐκ τῶν ἰδίων = his native language (ἴδιος is the "own" word); τοῦ πατρὸς ὑμῶν = his; ἐκ … ἐστέ = belong to (as John 3:31); λαλῇ τὸ ψεῦδος = he lies.
- 8:47 ἐκ "belong", Θεοῦ "to God", ἐστέ "you do" → ἐκ … ἐστέ = you do + belong to, Θεοῦ = God; διὰ τοῦτο … ὅτι = The reason + is that.
- 8:52 καί "and so did" → and; ἀπέθανεν = died + so did. 8:53 καί "as did" → as; ἀπέθανον = did.
- 8:2 παρεγένετο "He went back" → He went; πάλιν = back. 8:3 στήσαντες "They made her stand" → They made + stand, αὐτήν = her; ἐν μέσῳ = before them.
- 8:35: the publisher rows belong to an older BSB wording (record: 14 publisher English words, 8 of the 17 displayed words matched), so the verse was linked from scratch: οὐ = not, μένει = is + a + member, ἐν … οἰκίᾳ = of + family, εἰς τὸν αἰῶνα = permanent; μένει = belongs to, εἰς τὸν αἰῶνα = forever; `t but`, `t it`.

## Readings

EVIDENCE lines show publisher Greek different from N1904 only in 8:3-11, 8:12,
8:16, 8:25, 8:28, 8:35 (English only), 8:39, 8:48, 8:52, 8:57.

- Same word or same meaning, linked with a note: 8:3 ἄγουσι (probably ἄγουσιν), ἐν (probably ἐπί); 8:4 κατελήφθη (probably perfect κατείληπται), ἐπαυτοφώρῳ (probably ἐπ’ αὐτοφώρῳ); 8:5 Μωσῆς (probably Μωϋσῆς), λιθοβολεῖσθαι (probably λιθάζειν); 8:6 ἔχωσι (probably ἔχωσιν), ἔγραφεν (probably κατέγραφεν); 8:7 ἀνάκυψας, εἶπε, πρὸς αὐτούς (probably ἀνέκυψεν καὶ εἶπεν αὐτοῖς); 8:8 κάτω κύψας (probably κατακύψας); 8:9 εἷς καθεῖς (probably εἷς καθ’ εἷς), ἑστῶσα = standing (probably οὖσα); 8:10 Ἡ γυνή = Woman (probably Γύναι); 8:11 εἶπε; 8:12 μοι (probably ἐμοί); 8:25 ὅ τι (probably written as one word); 8:48 Σαμαρείτης; 8:52 and 8:57 εἶπαν (probably εἶπον).
- Words BSB's Greek lacks, `s` with the reading reason: 8:9 καὶ ὑπὸ τῆς συνειδήσεως ἐλεγχόμενοι; 8:10 καὶ μηδένα θεασάμενος πλὴν τῆς γυναικός.
- Extra publisher words rendered in English, `t` with the reading reason: 8:11 "Now" (probably ἀπὸ τοῦ νῦν); 8:16 "Father" (probably πατήρ).
- 8:39 ποιεῖτε = you would do, linked with a note that BSB's Greek has another form of the verb (probably imperfect ἐποιεῖτε); the N1904 present can be "you do" or "do".
- No claim: 8:28 (one extra publisher word, probably αὐτοῖς, no English counterpart) and 8:52 (second extra word, probably οὖν, no English counterpart).

## Notable decisions

- 8:9: ἕως = until kept; τῶν ἐσχάτων ("the last ones") `s` because BSB folds it into "until … only Jesus was left"; the καί before κατελείφθη `s`. καί = with ("with the woman"), ἐν μέσῳ = there.
- 8:7: Ὁ ἀναμάρτητος = him who is without sin; πρῶτος = the first; βαλέτω = Let + to cast.
- 8:12: αὐτοῖς = to the people (publisher row, noted).
- 8:20: ἐν = near (publisher row, noted).
- 8:21: καί = but (publisher row, noted). 8:23, 8:32: καί = Then kept.
- 8:25: τὴν ἀρχήν = from the beginning, noted only as an adverbial accusative; καί = Just (intensive καί).
- 8:31: Ἰησοῦς = He (publisher row, noted). 8:30: αὐτοῦ = Jesus.
- 8:33: γενήσεσθε ("you will become") = we will be set, noted as reported speech; ὅτι `s`.
- 8:37: οὐ = no, χωρεῖ = has + place.
- 8:40: λελάληκα ("I have told") = has told after "a man who".
- 8:42: ἐξῆλθον = have come, ἥκω = here (publisher split kept), καί `s`; second γάρ `s` (new sentence).
- 8:43: ἀκούειν = to accept (noted).
- 8:44: οὐκ = refusing, ἔστηκεν = to uphold, ἐν `s`; αὐτοῦ = of lies, noted as "of it" or "of him" without choosing.
- 8:53: ὅστις = He (new sentence); σεαυτὸν ποιεῖς = do You claim to be.
- 8:54: ἐστιν = means (noted); ὅν = of whom kept.
- 8:57: ἔχεις = You are (… years old), noted.
- 8:58: ἐγώ = I, εἰμί = am, no note.

## Doubts for the peer

- 8:7: "and" is `t` (participle join), with the reason noting that N1904 has no καί. BSB's Greek probably has a finite verb plus καί here, so the "and" may be the publisher's extra word; I did not claim it.
- 8:10: the counts (23 N1904 / 16 matched / 17 publisher words) leave one word I cannot place. The six-word clause is certainly absent from BSB's English; ἐκεῖνοι `s` only says the English has no counterpart, without a reading claim.
- 8:39: linking ποιεῖτε to "you would do" under rule 9 treats the form difference as same meaning. If the peer judges the mood difference (present "you do/do!" vs. unreal "you would do") a different meaning, it should become `s` + `t`.
- 8:9: ἑστῶσα = standing with a note. BSB's Greek probably has "being" there and BSB's "standing" may render that; it still renders N1904's word exactly.
- 8:11: "Then" `t`. It could be read as the narrative δέ moved into the quotation, but the English "Then" here means "in that case".
- 8:35: the from-scratch links (μένει = is + a + member; εἰς τὸν αἰῶνα = permanent) are a recast; an alternative is μένει … εἰς τὸν αἰῶνα together = "is … a permanent member".
- 8:50: κρίνων = Judge with `t He is the`. The alternative is the publisher row "He is the Judge" on κρίνων.
- 8:43: ἐμήν = I (possessive turned subject). The alternative is joining τὴν λαλιὰν τὴν ἐμήν = what I am saying.
- 8:26: κἀγώ = and + I (I of "I tell"). The publisher gave κἀγώ only "and" and put "I" on λαλῶ.
- 8:16: καί = with and `t am`. The alternative is εἰμί understood again (I am + am).
- 8:6 and 8:59: ἵνα = "in order" (8:6, "to have" on the verb) but ἵνα = "to" (8:59); both are publisher rows and kept.
