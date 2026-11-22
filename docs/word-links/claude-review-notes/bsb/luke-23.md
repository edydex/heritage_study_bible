# BSB Luke 23: author review (Claude)

Verses reviewed: 55 (23:1-16, 23:18-56). No KEEP blocks; nothing was kept
from an earlier reviewer. 23:17 is absent from both texts (no N1904 Greek and
no BSB verse text in the draft), so it has no block and was skipped. 23:34a
("Father, forgive them …"), double-bracketed in N1904, is linked normally.
Final check: `fromtext` → `{"versesOk": 55, "problems": 0}`.

Of the 686 publisher `g` rows, 541 are unchanged. 14 keep their English but
gained Greek tokens from the TODO list (rule-3 units and periphrastics, e.g.
23:8 ἦν … θέλων = He had wanted, τὸ ἀκούειν = he had heard; 23:12 ἐν ἔχθρᾳ =
enemies; 23:19 ἦν … βληθεὶς ἐν τῇ φυλακῇ = had been imprisoned; 23:29 ἐν αἷς
= when; 23:33 τὸν καλούμενον = called; 23:53 οὐκ … οὐδείς = no one; 23:55 ἦσαν
συνεληλυθυῖαι = had come with). The English of 131 rows in 47 verses changed:
most were over-claims or wrong anchors listed below; the rest took a word
freed by a neighbouring fix.

Parallels followed: Mark 15 and Matthew 27 (23:3 = Mark 15:2 ὁ = Jesus,
ἀποκριθεὶς … ἔφη = replied, αὐτῷ `s`; 23:22 = Mark 15:14 / Matthew 27:23
"What evil has … done"; 23:26 = Mark 15:21 τινα `s`, "on his way in";
23:33 "His right/left" `t` as Matthew 27:38; 23:34b = Matthew 27:35
"divided up … by casting lots"; 23:35 = Mark 15:31 "He saved others";
23:46 "in a + voice" / "loud" as Mark 15:34 and Matthew 27:50; 23:47 When +
saw as Mark 15:39; 23:52 identical to Matthew 27:58, τῷ Πειλάτῳ = to Pilate,
τοῦ `s`).

## Publisher rows corrected

"When"/"As" on the wrong word (now on the participle or relative clause; the
connective is `s` or keeps And):

- 23:6 δέ "When" → ἀκούσας = When + heard; `t this`.
- 23:8 δέ "When" → ἰδών = When + saw.
- 23:25 δέ "As" → ὃν ᾐτοῦντο = As they had requested (the relative clause BSB
  moved to the front).
- 23:46 δέ "And when" → And; εἰπών = when + He had said.
- 23:47 δέ "When" → ἰδών = When + saw.
- 23:48 καί "And when" → And; θεωρήσαντες = when + saw.

English-only words that a Greek word had claimed (now `t`):

- Names: Jesus (23:7 ἐστίν, 23:43 εἶπεν), Herod (23:9 ἐπηρώτα), the soldiers
  (23:26 ἀπήγαγον), people (23:29 ἐροῦσιν), men (23:31 ποιοῦσιν).
- Objects: Him (23:11 περιβαλών "Dressing Him", 23:14 ἀνακρίνας, 23:35
  ἐξεμυκτήριζον).
- Copulas and supplied verbs: are (23:29 "Blessed are"), is (23:31 twice,
  23:38 "THIS IS"), has (23:15 "Neither has Herod"), are punished (23:41,
  verbless clause; the publisher had it on μέν), He was (23:51), and has come
  (23:5, had been folded into ἕως), posted (23:38).
- Other: there (23:10 "stood there"), home (23:48 "returned home"), who were
  (23:32), His right / His left (23:33, as Matthew 27:38).
- "and" joining a participle to the main verb: 23:1 (rose and led), 23:14
  (and said, and found), 23:16, 23:26 (and put), 23:28 (and said), 23:36
  (and came up), 23:55 (and they saw).

Objects and pronouns on the wrong word:

- 23:7 ἀνέπεμψεν "he sent Him" → he sent; αὐτόν (TODO) = Him. "who himself"
  → ὄντα = who + was, αὐτόν = himself, καί `s`.
- 23:11 ἐμπαίξας "mocked Him" → mocked; αὐτόν (TODO) = Him; ἀνέπεμψεν "they
  sent Him back" → they sent + back, the second αὐτόν (TODO) = Him.
- 23:15 ἀνέπεμψεν "he sent Him back" → he sent + back; αὐτόν = Him.
- 23:16 / 23:22 / 23:21: the one αὐτόν serves both verbs (Him + Him); "I will"
  now sits on ἀπολύσω (23:16 παιδεύσας = punish); 23:21 Σταύρου no longer
  carries Him.
- 23:22 οὗτος "has this man" → this man; ἐποίησεν = has + done.
- 23:39 σύ "Are You" → You; εἶ (TODO) = Are. 23:40 σύ "Do you" → you;
  φοβῇ = Do + fear.
- 23:53 καθελών "he took it down" → he took + down; αὐτό = it + it (one
  object for both verbs).

Negatives split off verbs: 23:9 οὐδέν (TODO) = no, ἀπεκρίνατο = gave +
answer; 23:28 μή "do not" → not, κλαίετε = do + weep; 23:34 οὐ (TODO) = not,
οἴδασιν = they do + know; 23:51 οὐκ (TODO) = not, ἦν συνκατατεθειμένος = had
+ consented; 23:53 οὐκ … οὐδείς = no one, οὔπω = yet, ἦν … κείμενος = had +
been laid.

Prepositions and the possessive on lone articles: 23:3 and 23:37 τῶν "of the"
→ the; Ἰουδαίων = of + Jews (likewise 23:38 ΤΩΝ / ΙΟΥΔΑΙΩΝ, 23:45 τοῦ ναοῦ =
the + of temple); 23:30 τοῖς "to the" (twice) → the, the dative noun = to +
mountains / to + hills; 23:39 τῶν "of the" → τῶν κρεμασθέντων = the + who hung
there, κακούργων = of + criminals; 23:56 τό "on the" → the, σάββατον = on +
Sabbath; 23:25 τῷ "over to" → `s`, "over" to παρέδωκεν, "to" to θελήματι;
23:51 τῇ "to" → `s`, βουλῇ = to + decision.

Other wrong anchors or over-claims:

- 23:1 αὐτόν "Jesus away" → Jesus; "away" to ἤγαγον.
- 23:2 φόρους "payment of taxes" → of taxes; διδόναι (TODO) = payment.
- 23:5 ἐπίσχυον "they kept insisting" → kept insisting; οἱ = they (ὁ δέ
  convention; same in 23:21, 23:23). ἕως "and has come all the way" → all the
  way.
- 23:8 ἦν "he was" (it belongs to the periphrastic "had wanted") → ἐχάρη = he
  was + pleased.
- 23:14 λαόν "people to rebellion" → people; ἀποστρέφοντα = one who was
  inciting + to rebellion. "in your presence" → ἐνώπιον = in + presence,
  ὑμῶν (TODO) = your.
- 23:18 ἀνέκραγον "they all cried out" → they + cried out; πανπληθεί (TODO) =
  all + in unison.
- 23:22 αἴτιον "offense worthy" → offense; θανάτου = worthy of death.
- 23:23 φωναῖς "with loud voices" → with + voices; μεγάλαις (TODO) = loud
  (as Mark 15:34).
- 23:26 αὐτῷ "on him" → him; ἐπέθηκαν = put + on.
- 23:30 λέγειν "they will say" → ἄρξονται λέγειν = they will say.
- 23:31 τῷ "it is" (a lone article with a copula) → ἐν τῷ ξηρῷ: τῷ ξηρῷ = it
  + dry; ὑγρῷ "is green" → green.
- 23:32 Ἤγοντο "were also led away" → were + led away; καί (TODO) = also.
- 23:44 ἦν "It was now" → It was; ἤδη (TODO) = now.
- 23:46 φωνῇ "in a loud voice" → in a + voice; μεγάλῃ = loud; φωνήσας …
  εἶπεν = called out.
- 23:51 ἀπό "He was from" → from; πόλεως "the Judean town" → the + town;
  τῶν Ἰουδαίων (TODO) = Judean.

Readings (only where EVIDENCE shows the publisher's Greek differs):

- Πειλᾶτος (23:1, 3, 4, 6, 11, 12, 13, 20, 24, 52): "Same name, spelled
  differently in BSB's Greek text", as in Luke 3:1 and 13:1.
- 23:11 `t even`: BSB follows a reading with an extra word (probably καί
  before ὁ Ἡρῴδης, which NA28 prints in brackets).
- 23:18 πανπληθεί and 23:30 Πέσατε: same word, spelled differently
  (probably παμπληθεί and Πέσετε).
- 23:31 "the tree": linked to ξύλῳ with a same-sense note; the extra
  publisher word is probably the article before ὑγρῷ.
- 23:39 `t he said`: BSB follows a reading with an extra word (probably
  λέγων after αὐτόν).
- 23:48 συνπαραγενόμενοι: same word, spelled differently (probably
  συμπαραγενόμενοι).
- 23:28 and 23:50 also show one extra publisher word (probably ὁ before
  Ἰησοῦς; καί after ὑπάρχων), with no effect on the English, so nothing is
  claimed there.

## Notable decisions

- 23:12: ἐν (time phrase), μετ’ ἀλλήλων, γάρ, πρὸς αὑτούς are `s`; τε `s`
  (only the καί of τε … καί is rendered).
- 23:14: ἰδού = here and ἐν τῷ ἀνθρώπῳ τούτῳ = Him (found Him not guilty);
  οὐθὲν … αἴτιον = not … guilty.
- 23:19: ὅστις = Barabbas; the one διά = for + for.
- 23:33/23:41/23:56: μέν `s` (23:56 pairs with the δέ of 24:1).
- 23:40: ἀποκριθεὶς … ἔφη = saying; ἐπιτιμῶν = rebuked.
- 23:49: ἀπὸ μακρόθεν split as in Matthew 27:55 / Mark 15:40 (ἀπό = at, with a
  note; μακρόθεν = a distance); γυναῖκες = women, αἱ συνακολουθοῦσαι = the +
  who had followed (rule 3).
- 23:50: ἰδού + ὑπάρχων = there was; the first ἀνήρ `s`.

## Doubts for the peer

- "of the" on τῶν: Mark 15:2/15:26 and Matthew 27:11/27:37 keep τῶν = of the
  (OF THE). Here I followed the brief's lone-article rule and earlier Luke
  reviews (τῶν = the, Ἰουδαίων = of + Jews), so the parallels now differ.
- 23:31: τῷ ξηρῷ = it + dry and `t is` twice; the alternative is τῷ `s` and
  `t it is`.
- 23:38: "was posted" split into ἦν = was and `t posted`; one could keep
  "was posted" as BSB's rendering of ἦν … ἐπ’ αὐτῷ.
- 23:5: καί (13) `s` with `t and has come`. The Greek καί joins the two
  participles, the English "and" two finite verbs, so I did not treat them as
  a split pair.
- 23:50: ἰδού and ὑπάρχων share "there was"; the publisher had it on ἰδού
  alone with ὑπάρχων unresolved.
