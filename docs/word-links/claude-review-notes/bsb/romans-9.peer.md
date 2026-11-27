# BSB Romans 9: independent peer review (Claude)

Checked: 33 of 33 verses (9:1-33; no KEEP blocks). Started from the
author's final file, rendered with `totext --all`, and checked every line
against the Greek, the BSB English, the brief rules and the publisher's
per-verse record in `public/data/original-languages/bsb-word-links/romans.json`.
Final check: `fromtext` → `{"versesOk": 33, "problems": 0}`.

Changes: 4 verses (3 link changes, 1 note rewrite). All other author
decisions are kept.

## Changes

- 9:3: ηὐχόμην "I could wish that" → "I could wish"; "that" `t` ("English
  introduces the infinitive clause with that"). The brief lists an added
  "that" as `t`, and Romans 1:12, 2:19 and 4:1 (and most of Acts) treat a
  "that" before an infinitive clause that way. Romans 3:9/3:28, the
  author's precedent, are the minority.
- 9:8: ταῦτα = "who#0" → ταῦτα `s` ("BSB's 'it is … who' wording has no
  separate word for ταῦτα ('these'), which resumes the subject"); "who#0"
  `t`. "Who" does not mean "these". It is part of the English cleft. The
  same cleft gives the second "who" with no Greek word at all, so both
  "who" words are `t`. This is not a split pair: no English word renders
  ταῦτα. It matches 9:6, where the resumptive οὗτοι is also `s`.
- 9:19: the link οὖν = "Then" is kept, but the note was rewritten. Before:
  "BSB follows a reading with an extra word here and places its one 'Then'
  inside the question." After: "Here οὖν ('then') belongs to 'you will say
  to me'; BSB, whose Greek text has an extra word in this verse, places its
  one 'Then' inside the question." The new note says why the link crosses
  the quotation mark and claims no more than the EVIDENCE shows (see
  below).
- 9:26: ἔσται "It will happen that" → "It will happen"; "that" `t` ("English
  introduces the following clause with that; the Greek continues without a
  conjunction"). This is the same added-"that" rule. The Greek is
  paratactic (καὶ ἔσται … κληθήσονται), with no ὅτι.

## Points checked and settled

- 9:8: decided as above: ταῦτα `s`, "who" `t`. τοῦτ' ἔστιν = "So" is
  kept, and "it is" stays `t` with the cleft.
- 9:19: the record has sourceWords 12, matchedSourceWords 12 and
  publisherGreekWords 13. Every N1904 word is matched, and the publisher
  has one word more. In the publisher rows the matched οὖν had no English,
  and "Then" was unowned, so BSB's "Then" probably renders the extra word
  inside the question. N1904's only οὖν has the same inferential sense
  ("then"), moved one clause. By the split-pair rule (same meaning, even
  shifted), the link stands. The reading note is warranted because EVIDENCE
  shows a difference in exactly this verse. The note does not name or
  spell the publisher's word.
- 9:26: "there" does not occur anywhere in the BSB verse. "Very" ("the very
  place") is an intensifier, not a rendering of the adverb ἐκεῖ. ἐκεῖ `s`
  and "very" `t` is correct and not a split pair.
- 9:5: kept word by word: ὁ ὤν "who is", ἐπὶ πάντων "over all", Θεός
  "God", εὐλογητός "worthy of praise" (gloss note only), εἰς τοὺς αἰῶνας
  "forever", ἀμήν "Amen". There is no note on the doxology's
  interpretation. "Are" and "proceeds" are `t`.
- Understood-again links confirmed (same role and meaning, no added
  tense):
  - 9:4: ὧν = "Theirs + theirs + theirs". The relative is the possessor of
    every item, and the repeats had wrongly sat on καί.
  - 9:18: ἐλεεῖ / σκληρύνει own the infinitives "to have mercy" / "to
    harden". These are the verb elided after θέλει, a change of mood only.
  - 9:25: Καλέσω owns both "I will call". Same future, same
    double-accusative role.
- 9:20: confirmed. ὦ = "O", ἄνθρωπε = "man", and "you" is on the explicit
  σύ (rule 4). This is not a vocative "You", which would go with the noun.
- Reading notes checked against the record. The publisher's Greek differs
  only in 9:1, 9:4, 9:13, 9:15 and 9:19, and in each verse the unmatched
  N1904 tokens are exactly the ones the notes cover:
  - 9:1: συνμαρτυρούσης, 1 unmatched / 1 extra.
  - 9:4: Ἰσραηλεῖται, 1/1.
  - 9:13: καθάπερ, 1/1.
  - 9:15: οἰκτειρήσω and οἰκτείρω, 2/2.
  - 9:19: 0/1, discussed above.

  None of the notes names or spells the publisher's Greek. No reading is
  claimed in any other verse.
- Old Testament quotations were checked word by word: 9:7 (Gen 21:12), 9:9
  (Gen 18:10), 9:12 (Gen 25:23), 9:13 (Mal 1:2-3), 9:15 (Exod 33:19), 9:17
  (Exod 9:16), 9:25-26 (Hos 2:23; 1:10), 9:27-28 (Isa 10:22-23), 9:29 (Isa
  1:9) and 9:33 (Isa 28:16; 8:14). No other problems.
- Brief rules swept across the chapter:
  - Copulas: every supplied copula is `t`, and none is linked to an εἰμί in
    another clause. "Are" on εἰσίν (9:7), "are" on εἶ (9:20) and "is" on ᾖ
    (9:27) are real verbs.
  - Supplied objects and demonstratives are `t`: 9:10 "that", 9:17
    "purpose", 9:20 "it", 9:23 "this".
  - Added adverbs are `t`: 9:26 "very", 9:27 "only", 9:32 "not".
  - Participles carry no person: 9:11 "the twins" `t`, 9:10 "children"
    `t`.
  - Modal and person words are on finite verbs: 9:11, 9:17, 9:19, 9:20,
    9:29.
  - μὴ γένοιτο = "Certainly not" (9:14).
  - No "of the" / "to the" / "in the" sits on a lone article. τῷ Φαραώ
    "to" is an indeclinable name. Μωϋσεῖ "to Moses" is inflected, so "to"
    is on the noun. Articles used as pronouns: 9:6 "who", 9:25
    "them … who" / "her … who", 9:30 "that".

## Answers to the author's doubts

- 9:8 ταῦτα: changed to `s`, with "who" `t` (above).
- 9:19 οὖν = "Then": kept, with a clearer note (above).
- 9:3 "and cut off": kept on ἀνάθεμα with ἀπό = "from". The pregnant ἀπό
  ("accursed [and separated] from") could carry "cut off". But ἀνάθεμα
  itself implies being devoted away, and the note shows the whole phrase.
  Neither placement is wrong, so I did not change it.
- 9:16 "it does … depend": kept. "Depend" is a supplied verb (`t`), and "on"
  renders the genitive in each article-participle group, the way "of"
  goes on a genitive noun.
- 9:32 "over": kept with the verb ("They stumbled over"). προσκόπτω takes a
  bare dative, so "over" is the English verb's own preposition (the
  Romans 4 convention).

## Still uncertain

- The convention for "that" before an infinitive is not uniform. Romans
  3:9/3:28 put it on the verb, and Romans 1:12, 2:19 and 4:1 make it `t`.
  9:3 now follows the brief and the majority. Romans 3 may be worth
  aligning later.
- 9:19: "probably renders the extra word" rests on the publisher rows
  leaving the matched οὖν without English. The publisher's Greek table is
  not in the repo, so this cannot be confirmed.
