# BSB Acts 8: author review (Claude)

Verses reviewed: all 39 drafted verses (8:1-36, 8:38-40). No KEEP blocks in
this chapter. 8:37 is in neither N1904 nor BSB's main text, so it has no
block and none was added. Final check: `fromtext` →
`{"versesOk": 39, "problems": 0}`.

106 of the 548 publisher `g` rows changed, in 34 verses (8:8, 8:9, 8:12,
8:28 and 8:33 only had TODO tokens settled). About 20 of them only gained unlinked Greek
tokens or were merged into one group, with the English unchanged:
article + participle (8:4 Οἱ διασπαρέντες, 8:7 τῶν ἐχόντων, 8:10 ἡ
καλουμένη, 8:26 τὴν καταβαίνουσαν, 8:32 τοῦ κείροντος = the shearer),
articular infinitives (8:11 διὰ τό = because, 8:40 τοῦ ἐλθεῖν = came),
and fixed units (8:2 ἐποίησαν κοπετόν = mourned; 8:19 ᾧ ἐάν = everyone on
whom; 8:22 εἰ ἄρα = Perhaps; 8:23 εἰς χολήν = poisoned; 8:24/8:34
ἀποκριθεὶς … εἶπεν = answered/said; 8:26 κατὰ μεσημβρίαν = south; 8:27 ὃς
ἦν ἐπί = in charge of; 8:31 ἂν δυναίμην = can I, ἐὰν μή = unless; 8:34
Δέομαί σου = Tell me; 8:39 οὐκ … οὐκέτι = no more). The rest were
corrected, split or moved.

## Publisher rows corrected

English words with no Greek counterpart that had been folded into a Greek
word (now `t`):

- Supplied names and subjects: 8:16 "the Holy Spirit" (was on ἦν), 8:17
  "Peter and John" (was on ἐπετίθεσαν), 8:32 "The eunuch" (was on
  ἀνεγίνωσκεν), 8:38 the second "Philip" (was on ἐβάπτισεν).
- Supplied objects: 8:3 "them" (put them in prison; the Greek states men
  and women once), 8:10 "words" (heeded his words), 8:40 "that region".
- "and" joining a participle to the main verb: 8:3 (dragged off … and
  put), 8:5 (went down and proclaimed), 8:10 (heeded … and said), 8:30
  (ran up and heard), 8:31 (to come up and sit). 8:10 the first "and"
  (BSB joins the relative clause ᾧ προσεῖχον to 8:9) was on πάντες.
- Supplied copulas and frames: 8:32 "is" (is silent; ἄφωνος only), 8:36
  "here is" (Ἰδοὺ ὕδωρ), 8:23 "that" (I see that; the Greek has the
  participle ὄντα), 8:13 "the" (by the great signs).
- 8:39 "but" was on γάρ ("for"), which does not mean but: γάρ `s`, "but"
  `t`.

Words on the wrong Greek word:

- Lone articles carrying a preposition: 8:1 τῇ "to" (now to + death), 8:11
  ταῖς "with his" (ταῖς = his, μαγίαις = with + sorcery), 8:16 τοῦ "of the",
  8:18 τῶν "of the", 8:22 ἡ "for the" and τῆς "of", 8:25 τοῦ and τῶν "of
  the", 8:32 τῆς "of", 8:34 ὁ "is the" (is now with λέγει: is + talking).
  Each preposition now sits on its noun.
- Prepositions on the wrong word: 8:25 "in" (in many → in + villages), 8:29
  "to" on τούτῳ (now on ἅρματι), 8:39 "on" on αὐτοῦ (now on + way), 8:40
  "in" on πάσας (now in + towns).
- When moved from δέ to the participle: 8:14 (When + heard), 8:18 (When +
  saw); 8:25 "after" moved from οὖν to the article + participle.
- Explicit pronouns and particles split out of verb groups: 8:6 αὐτούς =
  they (was inside "they saw"); 8:19 κἀμοί = me + as well (me was on Δότε);
  8:35 αὐτῷ = him (was inside "told him the good news"); 8:15 οἵτινες =
  they (was TODO; προσηύξαντο = prayed); 8:31 ὁ = he (was on εἶπεν).
- Modifiers on the wrong word: 8:2 "deeply" now on μέγαν; 8:13 "closely"
  moved from Φιλίππῳ to the periphrastic ἦν προσκαρτερῶν; 8:20 "May" moved
  from σου to the optative εἴη (εἴη εἰς ἀπώλειαν = May … perish); 8:27 "the"
  moved from πάσης to τῆς; 8:39 "away" moved from Φίλιππον to ἥρπασεν; 8:1
  "a" moved from μέγας to the noun (a + persecution).
- 8:6 "to" before message now on the dative τοῖς λεγομένοις; ὑπὸ … Φιλίππου
  = Philip's. The second "to" (to the signs) is `t`: the signs are the
  object of βλέπειν.
- 8:11 τό had "for a" (it belongs to διὰ τό = because); "for a" now on
  χρόνῳ.
- 8:16 periphrastics: ἦν … ἐπιπεπτωκός = had + fallen, βεβαπτισμένοι
  ὑπῆρχον = they had + been baptized, μόνον = simply (was TODO, "simply"
  had been on ὑπῆρχον).
- 8:21 τῷ … τούτῳ ("this") together = our (τούτῳ was TODO).
- Negative split off the verb: 8:32 οὐκ = not, ἀνοίγει = He did + open.

## Readings

Spelling only, linked with "Same name/word, spelled differently in BSB's
Greek text": 8:1, 8:5, 8:9, 8:14 Samaria; 8:14 John; 8:25 Samaritan;
8:40 Caesarea; 8:11 sorcery (μαγίαις). 8:32 the shearer is linked with
"same verb, in another form in BSB's Greek text" (probably the aorist
κείραντος for N1904's κείροντος).

- 8:28 "and" linked to δέ with "BSB's Greek differs slightly here, with the
  same sense" (BSB's Greek probably has τε).
- 8:33 the first "His" (In His humiliation) is `t` with a reading reason:
  one extra publisher word, probably αὐτοῦ after ταπεινώσει.
- 8:6 is flagged as differing with 0/0 unmatched words, so no reading is
  claimed.

## Notable decisions

- Words understood again, linked to the stated word: 8:3 house + house
  (οἴκους), 8:10 power + Power (δύναμις, repeated in the title the Great
  Power), 8:30 Philip + Philip (ὁ Φίλιππος is the subject of both ἤκουσεν
  and εἶπεν), 8:29 chariot + it (τῷ ἅρματι is the object of κολλήθητι;
  BSB attaches the chariot to Go over and repeats it as it). 8:38 the
  second Philip is `t`: Φίλιππος there is in apposition to the subject of
  κατέβησαν, not the subject of ἐβάπτισεν.
- Article as pronoun or possessive: 8:31 ὁ = he; 8:11 ταῖς = his, 8:17 τάς
  = their, 8:19 τάς = my. Pronouns rendered by a name or noun: 8:1 αὐτοῦ =
  Stephen's, 8:30 αὐτοῦ = the man, 8:33 αὐτοῦ = He.
- 8:25 Οἱ … διαμαρτυράμενοι is one group, "after Peter and John had
  testified" (the article is the subject, rendered by the names, as ὁ =
  Stephen in 7:2); λαλήσαντες = spoken; οὖν = And; μέν `s`.
- 8:27 ἰδού = "he met" (as Luke 7:12 "He saw"); ἀνήρ `s`; αὐτῆς ("her")
  `s` because BSB names Candace once, after treasury.
- 8:26 αὕτη ἐστίν `s`; ἔρημος = desert (BSB applies it to the road).
- 8:32-33 (Isaiah 53:7-8) linked word by word: Ὡς = like, ἀμνός = a lamb,
  τοῦ κείροντος = the shearer, αὐτόν `s`, supplied "is" `t`; 8:33 κρίσις =
  of justice, ἤρθη = was deprived, αὐτοῦ = He (BSB makes the person the
  subject).
- 8:36: the καί before φησιν is linked to the one English "and", which BSB
  moved to "and came" (shifted, not a split pair). In 8:30 the καί before
  εἶπεν is `s` and the "and" `t`, because that "and" joins the participle
  προσδραμών to heard (participle convention).
- 8:35 the publisher's καί = and was kept (shifted from the two participles
  to began … and told). ἀνοίξας τὸ στόμα αὐτοῦ `s` (idiom left out).
- 8:34 the second and third περί `s` (BSB has one "about").

## Doubts for the peer

- 8:1 ἦν = "was there" kept (publisher row). ἦν συνευδοκῶν is periphrastic
  ("was approving"); BSB reads ἦν as "was present". Alternative: "there" `t`.
- 8:36 "is there to prevent" kept on κωλύει as a paraphrase of one verb,
  while "here is" (Look, here is water) was made `t` as a supplied
  presentational copula. If the peer reads "is there" as a supplied
  copula too, make it `t`.
- 8:36 καί = and (shifted, see above); the stricter option is καί `s` and
  "and" `t`.
- 8:3 τε `s` and "and" (dragged off and put) `t` by the participle
  convention, though τε is also a connective "and".
- 8:27 ἀναστάς = "he started out" and ἐπορεύθη = "on his way" kept
  (publisher rows); one could read "started out" as ἀναστὰς ἐπορεύθη
  together and "on his way" as `t`.
- 8:10 "all the people" kept on substantival πάντες.
