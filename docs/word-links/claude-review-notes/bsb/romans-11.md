# BSB Romans 11: author review (Claude)

Verses reviewed: all 36 (11:1-36). No KEEP blocks in this chapter. Final
check: `fromtext` → `{"versesOk": 36, "problems": 0}`.

131 of the 461 publisher `g` rows changed, in 34 of the 36 verses (this
count includes rows that only gained a joined TODO token). Every publisher
row was checked, including the two verses whose rows stay unchanged apart
from resolved TODOs (11:19, 11:34). No "of the"/"to the"/"in the"/"for"
sits on a lone article or a number. The only articles carrying a case word
are τῇ Βάαλ "to" (11:4) and τῷ Ἰσραήλ "to" (11:25), both before
indeclinable names. Articles used as possessives carry "their/His" (11:15,
11:22, 11:24, 11:29), and 11:18 τῶν carries the demonstrative "those".

No Gospel parallel. Precedent used: Romans 3 (μὴ γένοιτο joined as
"Certainly not"; μή question marker `s`; καθάπερ "as" with the
different-word note, 3:4); Romans 1 (εἴ πως joined, 1:10; εἰς τό +
infinitive joined as "to", 1:11; εἰς τοὺς αἰῶνας "forever", 1:25); Romans 4
(English verb keeps its own preposition; "there" `t`; relative frames `t`);
Luke 7:8 / Matthew 8:9 (καὶ ἐγώ "I myself"); John 12:40 (μή + verb joined
under one "cannot"); John 4:17 (καλῶς "correct", supplied frame `t`); 1 Peter
1:4 ("that is" `t`); Galatians 3:22 / Ephesians 1:10 (τὰ πάντα joined); the
Acts files for a pronoun rendered by the referent's name with a note; ἄχρι
οὗ, ἐφ’ ὅσον, διὰ παντός and εἰ μή joined as in the reviewed files.

## Publisher rows corrected

Lone articles carrying a preposition, verb or other word:

- 11:11 τῷ "because of" → `s`; παραπτώματι = "because of + trespass". τοῖς
  "to the" → "the"; ἔθνεσιν = "to + Gentiles".
- 11:14 τήν "own" → `s` (μου is explicit); "own" on the fronted μου ("my
  own").
- 11:15 ἡ "will their" → "their" (article as possessive); "will", "be" `t`.
- 11:17 τῆς "in the" → "the"; "in" with the sharing verb. τῆς "of the" →
  `s`; "of + root" on ῥίζης, "the" before "olive root" on ῥίζης's article.
- 11:20 τῇ "because of" → `s`; ἀπιστίᾳ = "because of unbelief".
- 11:25 τῶν "of the" → "the"; ἐθνῶν = "of + Gentiles". "to" moved from
  Ἰσραήλ to τῷ (indeclinable name); likewise 11:4 "to" from Βάαλ to τῇ.
- 11:31 τῷ "through the" → "the"; ἐλέει = "through + mercy".

Supplied words that had been folded into Greek words (now `t`):

- Copulas and verbs: 11:6 "it is" and "then it is"; 11:12 "means" (twice),
  "will … bring"; 11:15 "is", "will … be"; 11:16 "is" (three times) and
  "are"; 11:27 "is"; 11:28 "they are" (twice); 11:29 "are"; 11:33 "are";
  11:36 "are" and "be"; 11:11 "has come"; 11:4 "was" (λέγει "says" `s`,
  see below); 11:20 "That is".
- "there": 11:5 ("there is" on γέγονεν → "is").
- Added words: 11:3 "and" (asyndeton) and "as well"; 11:11 "beyond
  recovery"; 11:16 "of the dough"; 11:18 "remember this"; 11:24 "readily"
  and "that is"; 11:30 "who"; 11:31 "shown".
- Subjects with no Greek owner: 11:10 "they" (infinitive clause); 11:35
  "God" as agent of the passive ἀνταποδοθήσεται (αὐτῷ keeps "to God").

Modal, auxiliary and person words moved to the finite verb:

- 11:1 Θεός "did God" → "God", "did + reject"; 11:9 and 11:10 αὐτῶν "May
  their" → "their", "May" on Γενηθήτω / σκοτισθήτωσαν; 11:6 "would" from
  οὐκέτι to γίνεται; 11:24 οὗτοι "will these" → "these", "will" on
  ἐνκεντρισθήσονται; 11:31 "may" from νῦν to ἐλεηθῶσιν; 11:13 ἐγώ "as I" →
  "I" (ἐφ’ ὅσον joined as "Inasmuch as").

Negatives split from verbs: 11:2 (twice), 11:4, 11:8 (twice), 11:18 (twice),
11:20, 11:21, 11:23, 11:25 (twice). 11:21 οὐδέ = "not + either" (had "either" only).

Other corrections:

- 11:1 καὶ ἐγώ joined = "I + myself" (καί alone had "myself"); ἐκ = "from"
  (it governs both genitives), φυλῆς "from the tribe" → "the tribe".
- 11:3 ὑπελείφθην = "am + left"; μόνος "am the only one" → "the only one".
- 11:5 κατ’ ἐκλογήν joined = "chosen"; "by" moved to χάριτος ("by grace").
- 11:12 the understood third "riches" linked to the second πλοῦτος; μᾶλλον
  "greater riches" → "greater".
- 11:14 "to jealousy" moved from σάρκα to παραζηλώσω.
- 11:17 συνκοινωνὸς … ἐγένου joined = "to share in" (ἐγένου was TODO).
- 11:18 ῥίζα "root supports" → "root"; "supports" linked to βαστάζεις as
  the verb understood again. κατακαυχᾶσαι keeps only "you do".
- 11:22 "of" moved from χρηστότητα (accusative) to ἴδε ("Take notice + of").
- 11:23 "in" moved from αὐτούς to ἐνκεντρίσαι ("to graft + in").
- 11:25 "of" moved from τοῦτο to ἀγνοεῖν ("to be ignorant of").
- 11:28 δι’ "on your account" → "on + account", ὑμᾶς = "your".
- 11:30 τούτων "through their" → "their"; "through" on ἀπειθείᾳ. νῦν (11:30,
  11:31 first) = "now", taken out of the verb rows.
- 11:31 ὑμετέρῳ "shown to you" → "to you".
- Joined units: 11:8 τοῦ + infinitive (twice) and τῆς σήμερον ἡμέρας "this
  very day"; 11:10 τοῦ μὴ βλέπειν "so + cannot see", διὰ παντός "forever";
  11:20 ὑψηλὰ φρόνει "Do + be arrogant"; 11:21 and 11:24 κατὰ φύσιν; 11:22
  τοὺς πεσόντας; 11:25 ἐν ἑαυτοῖς φρόνιμοι "conceited", ἄχρι οὗ; 11:26 ὁ
  Ῥυόμενος; 11:27 παρ’ ἐμοῦ "My"; 11:32 τοὺς πάντας (twice); 11:36 τὰ
  πάντα, εἰς τοὺς αἰῶνας.

## Readings

EVIDENCE shows a different publisher word only in 11:1, 11:2, 11:5, 11:8 and
11:21:

- 11:1 Ἰσραηλείτης and Βενιαμείν, 11:2 Ἡλείᾳ, 11:5 λίμμα: linked with the
  "spelled differently" note (probably Ἰσραηλίτης, Βενιαμίν, Ἠλίᾳ, λεῖμμα).
- 11:8 καθάπερ = "as" with the Romans 3:4 note (probably καθώς).
- 11:21: two extra publisher words and no unmatched N1904 word (probably μή
  πως). "certainly" has no N1904 counterpart, so it is `t` with a reading
  reason. "He will" stays on φείσεται and "not … either" on οὐδέ.

No cross-verse links.

## Notable decisions

- Theological terms linked word by word, no interpretive notes: λεῖμμα
  "a remnant" (11:5), ἐκλογή "chosen" (11:5), "the elect" (11:7),
  "election" (11:28); χάρις "grace" (11:5, 11:6 three times); παράπτωμα
  "trespass" (11:11, 11:12); ἥττημα "failure"; ἀπιστία "unbelief" (11:20,
  11:23); ἀπείθεια "disobedience" and ἀπειθέω "disobeyed"; ἔλεος / ἐλεέω
  "mercy" (11:30-32); μυστήριον "mystery" (11:25); πλήρωμα "fullness"
  (11:12) and "full number" (11:25, gloss note only); πώρωσις "A
  hardening"; καταλλαγή "reconciliation"; κλῆσις "call"; χάρισμα "gifts".
- Old Testament quotations (11:3-4, 11:8-10, 11:26-27, 11:34-35) are linked
  word by word: jussive "May" on the imperative, the four εἰς of 11:9 `s`
  (they mark what the table becomes), ἀλλά = "And" (11:4) and καί = "that"
  (11:35) linked as connectives BSB renders differently, ἤ (11:35) `s`.
- μὴ γένοιτο = "Certainly not" as one unit (11:1, 11:11); Ὦ = "O" (11:33);
  καί (11:33 first) `s` because BSB makes wisdom depend on riches ("of the
  wisdom").
- 11:4 λέγει `s` and "was" `t`: "was" does not mean "says".
- 11:7 οὐκ ἐπέτυχεν joined = "it failed to obtain" ("failed" holds the
  negative); τοῦτο `s` (BSB's fronted clause is the object).
- 11:11 αὐτούς = "Israel" and 11:35 αὐτῷ = "to God", each with the
  pronoun-rendered-by-name note.
- 11:16 καί = "so" (twice) with a gloss; φύραμα keeps "whole batch".
- 11:24 τῆς κατὰ φύσιν (first clause) `s`: BSB does not render "by nature"
  with the wild olive tree. In the second clause κατὰ φύσιν = "natural
  branches" (οἱ = "the"), a substantive kept with its head noun (Luke 6:45
  convention).

## Doubts for the peer

- 11:5 "there" `t` with γέγονεν = "is" (Romans 4 and the brief), although
  Romans 3 and 5:13 kept "there is" on an existential verb.
- 11:1 ἐκ = "from" (it governs φυλῆς too) with σπέρματος = "a descendant";
  the alternative is ἐκ σπέρματος joined as "a descendant" and "from" on
  φυλῆς as the publisher had it.
- 11:14 "own" on μου ("my own", fronted for emphasis); σάρκα = "own people"
  is the alternative.
- 11:16 "of the dough" `t`: ἀπαρχή alone does not mean "dough", though the
  image is the first portion of dough (Numbers 15:20).
- 11:24 "natural branches" on κατὰ φύσιν: "branches" `t` is the stricter
  option.
- 11:17 the three τῆς: "the" before "nourishment" on τῆς πιότητος, "the"
  before "olive root" on τῆς ῥίζης, τῆς ἐλαίας `s`; giving "the olive root"
  to τῆς ἐλαίας is also defensible.
- 11:12 the third "riches" linked to the second πλοῦτος rather than the
  first.
- 11:10 "they" `t` in "so they cannot see" (infinitive clause); 11:8 "could"
  kept on the articular infinitive.
