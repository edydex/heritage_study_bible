# BSB Acts 19: author review (Claude)

Verses reviewed: all 41 (19:1-41). No KEEP blocks in this chapter. Final
check: `fromtext` → `{"versesOk": 41, "problems": 0}`.

142 of the 599 publisher `g` rows changed, in 39 of the 40 verses that had
publisher rows (19:15 keeps every publisher row and only resolved TODO
tokens; 19:41 had none). 26 rows only gained a token, with the English
unchanged: 19:1 ἐν τῷ = While and τὰ ἀνωτερικὰ μέρη = interior; 19:2 πρὸς
αὐτούς = them; 19:7 οἱ πάντες = in all; 19:11 οὐ τὰς τυχούσας =
extraordinary; 19:12 ἀπ’ αὐτῶν = them and ἀπαλλάσσεσθαι … ἐκπορεύεσθαι =
left; 19:16 ἐν ᾧ ἦν = with; 19:19 μυριάδας πέντε = fifty thousand; 19:20
κατὰ κράτος = powerfully; 19:21 τὸ γενέσθαι = have been; 19:24 οὐκ ὀλίγην =
much; 19:26 οἱ διὰ χειρῶν γινόμενοι = man-made gods; 19:27 εἰς οὐθὲν
λογισθῆναι = will be discredited; 19:28 πλήρεις θυμοῦ = enraged; 19:30
εἰσελθεῖν εἰς = to go before; 19:31 δοῦναι ἑαυτόν = to venture; 19:32 οἱ
πλείους = most of them and τίνος ἕνεκα = why; 19:33 κατασείσας τὴν χεῖρα =
motioned for silence; 19:35 τίς ἐστιν ἀνθρώπων ὅς = everyone; 19:36 δέον
ἐστίν = ought; 19:38 σὺν αὐτῷ = his fellow; 19:40 καὶ γάρ = For, τῆς
σήμερον = today's events, ἀποδοῦναι λόγον = to account. The rest were
corrected, split or moved.

No parallel Gospel chapter. Conventions followed: Luke 9:28/Acts 14:1 for
Ἐγένετο δέ `s` (19:1); Luke 9:29 for ἐν τῷ + infinitive (19:1); Luke 24:33
for καί `s` + "There" `t` at a new sentence (19:1); Acts 5:9 for οἱ δέ /
πρὸς αὐτόν with a supplied "answered" (19:2); Acts 1:6 and 5:8 for a
question-marking εἰ `s` (19:2); Acts 14:3 for μὲν οὖν = So with μέν `s`
(19:32, 19:38); Acts 6:9 for "province(s) of" as `t` (19:10, 19:22, 19:26,
19:27); Acts 2:11, 5:14, 8:12 for τε linked when English renders "both"
(19:10 "alike"), and Acts 14:1, 9:29 for τε `s` otherwise (19:17); Acts
5:40 for a pronoun linked to the name BSB substitutes (19:31 αὐτῷ = Paul's);
Luke 9:37 for "by" with an active verb rendered passively (19:27); Luke
21:11 for one English verb shared by two Greek verbs (19:12 left); Acts
4:32, 10:28, 11:28 for a supplied "that" before an infinitive (19:27).

## Verse division 19:40/41

N1904 prints καὶ ταῦτα εἰπὼν ἀπέλυσεν τὴν ἐκκλησίαν at the end of 19:40;
BSB numbers it 19:41. In 19:40, ταῦτα εἰπὼν ἀπέλυσεν τὴν ἐκκλησίαν (tokens
22-26) are `m … > 19:41`, and the opening καί (token 21) is `s` (BSB's 19:41
has no "And"). In 19:41 every English word is linked with `g @19:40`, as in
the reviewed Acts 5:39-40: εἰπών = After he had said, ταῦτα = this,
ἀπέλυσεν = he dismissed, τήν = the, ἐκκλησίαν = assembly. 19:41 also
carries `x sourceAbsent`: the checker requires that flag for any verse
number N1904 lacks, and the compiler then accepts only foreign-reference
groups there (the same mechanics as the accepted LSV Acts 19:41). It records
only that no Greek verse 19:41 exists; no English word is left unlinked.
A simulation of the build's moved-word check confirms each moved 19:40 token
has its anchor in 19:41.

## Publisher rows corrected

English words with no Greek counterpart that had been folded into a Greek
word (now `t`):

- Supplied names/subjects: "Paul" (19:3 asked, 19:8 went, 19:9 took),
  "Demetrius" (19:25 assembled), "the men" (19:28 heard).
- Supplied objects: 19:5 and 19:28 "this" (hearing), 19:19 "them" (burned),
  19:31 "him" after begging (the publisher had πρός = "to him" and αὐτόν =
  this second "him"; now πρός = to, αὐτόν = him).
- Participle "and" with no καί: 19:1 "and came", 19:8 "and spoke", 19:9
  "and left", 19:16 "and overpowered", 19:19 "and burned", 19:35 "and
  declared"; 19:40 "and we have" (no καί; "and" joins the genitive
  absolute).
- Added place words: 19:1 "There" (was on καί; καί `s`), 19:8 "there"
  (spoke boldly there), 19:37 "here", 19:38 "there" (one another there).
- Other additions: 19:13 "there were" (was on τινες); 19:22 "while" (was
  on αὐτός); 19:28 and 19:34 the copula "is" (Great is); 19:32 "even" (did
  not even know); 19:37 "though they have" (was on οὔτε) and "our" before
  temple (was on ἱεροσύλους); 19:27 both "that"s (τοῦτο had "that", a
  demonstrative carrying a conjunction; καί had "also that"); 19:35 "that"
  (was on τίς); "province of" in 19:10, 19:22, 19:26, 19:27; 19:2
  "answered" (was on δέ with "they"; now οἱ = they, δέ and πρὸς αὐτόν `s`).

Lone articles carrying a preposition or another word:

- "of the" on τοῦ/τῆς: 19:5, 19:10, 19:13, 19:17, 19:20 (τοῦ Κυρίου =
  the + of Lord), 19:27 (τῆς = the, θεᾶς = of + goddess), 19:35 (τῆς = the,
  Ἀρτέμιδος = of + Artemis).
- 19:10 τήν had "in" (now on Ἀσίαν); 19:13 τόν had "by" (now by Jesus);
  19:24 τοῖς and 19:33 τῷ had "to the" (now on τεχνίταις/δήμῳ); 19:30 οἱ
  had "but the" (but → δέ); 19:25 ἡ had "source of" (now on ἐκ) and τά had
  "related" (τὰ τοιαῦτα = related trades); 19:29 τῆς had "whole" (now on
  ἐπλήσθη); 19:39 τῇ had "a" (now a + assembly on ἐκκλησίᾳ, τῇ `s`); 19:22
  τῶν had "of" (joined with its participle); 19:31 τῶν had "of" (now some
  of on τινές, τῶν `s`); 19:35 τοῦ had "of her image" (now joined with
  διοπετοῦς).
- "the" inside a noun's row while its article was TODO: 19:22 "the province
  of Asia", 19:26 "the whole", 19:27 "the province of Asia" and "the whole"
  (on ἡ; "whole world" now on οἰκουμένη).

Article + participle joined (rule 3): 19:4 τὸν ἐρχόμενον, 19:10 τοὺς
κατοικοῦντας, 19:12 τοὺς ἀσθενοῦντας, 19:13 τοὺς ἔχοντας, 19:17 τοῖς
κατοικοῦσιν (the … living), 19:18 τῶν πεπιστευκότων, 19:19 τῶν … πραξάντων,
19:22 τῶν διακονούντων.

When/Since on a connective: 19:6 "when" from καί to ἐπιθέντος (genitive
absolute); 19:28 "When" from δέ to ἀκούσαντες; 19:36 "Since" from οὖν to
ὄντων (genitive absolute; οὖν `s`); 19:19 "When" from the first καί (new
sentence, `s`) to the καί between the two clauses.

Negatives split off verbs: 19:2 οὐδ’ = not even, ἠκούσαμεν = we have +
heard; 19:30 οὐκ = not, εἴων = would + allow; 19:32 οὐκ = not, ᾔδεισαν =
did + know; 19:36 μηδέν = not + anything, πράσσειν = do; 19:26 "at all"
from θεοί to οὐκ (no + at all).

Other words on the wrong Greek word:

- 19:9 διαλεγόμενος had "daily" (now καθ’ ἡμέραν = daily); πλήθους had
  "and publicly" (ἐνώπιον τοῦ πλήθους = publicly; καί = and, see below).
- 19:12 χρωτός had "that had touched him" (ἀπὸ τοῦ χρωτός = that had
  touched; αὐτοῦ = him).
- 19:14 Ἰουδαίου had "a Jewish" ("a" now on τινος).
- 19:16 ἴσχυσεν had "The attack", ὥστε "was so violent", ἐκφυγεῖν "that
  they ran": now ἴσχυσεν κατ’ αὐτῶν = The attack was … violent, ὥστε = so …
  that, ἐκφυγεῖν = they ran.
- 19:23 "a great" → a + disturbance on τάραχος, οὐκ ὀλίγος = great.
- 19:25 συναθροίσας had "Demetrius assembled the craftsmen": οὕς = the
  craftsmen (the relative), συναθροίσας = assembled.
- 19:26 ἀλλά had "but in" ("in" now on Ἀσίας).
- 19:27 ὅλη had "by all" ("by" goes with the passive is worshiped).
- 19:32 the distributive: ἄλλοι had "and some another" and ἄλλο had "Some";
  now ἄλλοι = Some + some, ἄλλο τι = one thing + another, "and" `t`.
- 19:33 συνεβίβασαν had "forward to explain himself": forward belongs to
  προβαλόντων (pushed + forward).
- 19:34 φωνή had "they all shouted in unison": now φωνὴ … μία = in unison,
  ἐγένετο … κράζοντες = shouted, ἐκ πάντων = they all.
- 19:40 καί had "For" (now καὶ γάρ = For); δυνησόμεθα had "and we have"
  (see below).

## Readings

- 19:3 Ἰωάνου, 19:4 Ἰωάνης: same name, spelled differently in BSB's Greek
  (probably Ἰωάννου/Ἰωάννης); linked with a note.
- 19:6: one extra word in BSB's Greek, probably the article τάς with
  χεῖρας; "his" is `t` with the reading reason.
- 19:34 κράζοντες: a different form in BSB's Greek (probably the genitive
  κραζόντων); "shouted" linked with a note.
- 19:8 and 19:15: one extra word each with no English effect (probably τά
  before περί and μέν after Τόν); nothing claimed.
- 19:13, 19:21, 19:26: word order only; nothing claimed.
- 19:40: the six "unmatched" N1904 words are the clause BSB numbers 19:41.

## Notable decisions

- 19:9 καί (between ἐσκληρύνοντο and ἠπείθουν) = the "and" before
  maligned: BSB folds the first two verbs into "stubbornly refused to
  believe", so the καί joins the rest of the chain (note). 19:28 καί
  (between ἀκούσαντες and γενόμενοι) = the "and" before began shouting,
  which closes the participle chain.
- 19:6 τε kept = the first "and" (it joins the clause to the one before;
  the καί gets the second "and").
- Kept publisher connective renderings, with notes: 19:15 δέ = Eventually,
  19:18 τε = now, 19:24 γάρ = It began with, 19:29 καί = Soon, 19:35 δέ =
  Finally, 19:17 καί = So, 19:12 ἤ = and (in the list).
- 19:30 δέ = but (BSB places it between the genitive absolute and the main
  clause).
- 19:9 αὐτῶν = the synagogue and 19:19 αὐτῶν = of the books (pronouns BSB
  turns into nouns); 19:33 Ἀλέξανδρος = he.
- 19:15 πνεῦμα = one of + spirits; ἀποκριθὲν … εἶπεν = answered.
- 19:22 αὐτός = he; "while" `t`.
- 19:29 ἐπλήσθη ("was filled") = the whole … was; συγχύσεως = in disarray.
- 19:31 τινές = some of; Ἀσιαρχῶν = officials of the province of Asia (the
  one compound word, so "province of" stays in its row here).
- 19:35 "Men of Ephesus" has no "O/You" to claim; Ἄνδρες = Men, Ἐφέσιοι =
  of Ephesus.
- 19:40 μηδενὸς αἰτίου ὑπάρχοντος = no justification … we have; περὶ οὗ οὐ
  δυνησόμεθα `s` (folded into "we have no justification to account for");
  ἀποδοῦναι λόγον = to account.

## Doubts for the peer

- 19:40: the fold of περὶ οὗ οὐ δυνησόμεθα (`s` on content words). The
  alternative is δυνησόμεθα = we have (person matches) with ὑπάρχοντος `s`.
- 19:6 τε = and: the brief's τε … καί convention (and Acts 9:29) would make
  τε `s` and that "and" `t`.
- 19:9 and 19:28 shifted καί links; the alternative is καί `s` + "and" `t`.
- 19:24 γάρ = It began with, 19:15 δέ = Eventually and 19:18 τε = now:
  kept as BSB's opener for the connective; the alternative is `s` + `t`.
- 19:36 "Since" moved to the genitive absolute with οὖν `s`.
- 19:41 `x sourceAbsent`: required by the checker for a verse N1904 lacks;
  every word is linked to 19:40.
- 19:23 "a" put with the noun (brief convention), unlike Acts 14:28 "a long"
  on οὐκ ὀλίγον.
- 19:33 συνεβίβασαν = to explain himself (BSB's reading of "they
  prompted").
