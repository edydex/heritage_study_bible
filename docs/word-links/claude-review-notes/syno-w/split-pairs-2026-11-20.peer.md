# SYNO-W split-pair corrections: independent peer review (Claude)

Scope: the author's edited fix pack for the 175 SYNO-W candidate verses (see
[split-pairs-2026-11-20.md](split-pairs-2026-11-20.md)), compared verse by
verse with the original pack. All 140 changed verses were read against the
Nestle 1904 Greek and the Russian text as displayed: every new `g` link, every
rewritten `s`/`t` reason and every `h` head. Ten of the 35 unchanged verses
were spot-checked. TR claims were checked from memory, since the repository
has no TR text to check them against.

After the peer edits, the pack was rebuilt and compiled with the real
`fromtext` compiler: `chapters failing: 0`. Nothing was registered.

## Counts

| Measure | Result |
|---|---|
| Changed verses checked | 140 |
| Unchanged verses spot-checked | 10 of 35 |
| Links reversed or moved | 0 |
| Lines changed by the peer | 9 lines in 9 verses (5 misprint notes, 3 TR reasons, 1 formatting fix) |
| Author's link count confirmed | 197 Greek tokens newly linked in 189 new `g` groups (recounted from the compiled output) |

## Changes made

Format: verse — before → after — why.

### Misprint notes (the links stay, because they must match the displayed text)

- 2 Cor 11:20 — `g 16 = ко // The source text prints ко for кто …` → `// The displayed ко is a misprint for кто "anyone", …` — the note now says plainly that it is a misprint.
- Heb 2:5 — `g 10 = говорил // The Russian text prints говорил; the usual Synodal reading is говорим "we speak".` → `// The displayed говорил is a misprint for говорим "we speak".` — same reason.
- Heb 5:9 — `g 7 = виновников // … the text prints виновников for the usual виновником.` → `// … the displayed виновников is a misprint for виновником.` — same reason.
- Mark 7:36 — `g 2 = и // The source text prints и for им "them", …` → `// The displayed и is a misprint for им "them", …` — same reason.
- Mark 16:5 — `g 8 = а // The source text prints а for на "on": …` → `// The displayed а is a misprint for на "on"; …` — same reason.
- Heb 3:17 — no change. The note (`The Russian text misprints согрешивших "those who sinned" as согревших.`) already says it is a misprint.

### TR reasons softened (the TR word is no longer quoted from memory)

- Acts 13:46 — `t но = Printed TR has δέ here (ἐπειδὴ δέ); N1904 has no connective.` → `t но = The Russian follows the Textus Receptus here; N1904 has no connective before ἐπειδή.` — very likely right (KJV "but seeing"), but not certain from memory.
- Acts 24:23 — `t А = Printed TR opens with τε (διαταξάμενός τε); N1904 has no connective here.` → `t А = The Russian follows the Textus Receptus here; N1904 has no connective at the start.` — same reason.
- Heb 9:9 — `t которое = Russian takes time as the antecedent, as TR καθ’ ὅν does; …` → `t которое = Russian takes время as the antecedent, following the Textus Receptus here; N1904 feminine ἥν refers to the parable.` — same reason. The original `s 8` reason already records that TR has a masculine relative, so no information is lost.
- Rev 2:9 — kept as written (`t дела = Printed TR has τὰ ἔργα …`, `t и#0 = Printed TR has καί after τὰ ἔργα …`). TR `Οἶδά σου τὰ ἔργα καὶ τὴν θλῖψιν` is certain, and the original `t твои дела` reason already made the same claim.

### Formatting

- 1 Cor 15:35 — `t в =Russian gives the body …` → `t в = Russian gives the body …` — a space was lost in the author's edit. The compiled reason was already correct, so this is cosmetic only.

## Verses accepted as fixed

All 140 changed verses are accepted. In the 9 verses above, only the note or
reason was changed; every link stands.

- Matt: 4:4, 4:6, 5:31, 7:3, 7:26, 8:9, 8:29, 10:14, 13:22, 14:23, 26:42, 28:14
- Mark: 1:24, 1:43, 2:19, 7:36, 10:11, 14:28, 16:4, 16:5
- Luke: 1:11, 3:1, 3:11, 3:14, 4:40, 4:41, 7:1, 8:23, 8:28, 10:1, 12:6, 12:19, 13:14, 14:3, 14:21, 14:23, 14:31, 14:32, 15:10, 15:12, 16:8, 16:15, 16:18, 16:26, 17:2, 17:37, 18:5, 18:34, 20:14, 20:24, 20:39, 21:25, 22:9, 22:21, 24:12
- John: 1:24, 12:40, 14:22, 14:29
- Acts: 4:33, 7:34, 7:40, 13:1, 13:38, 13:46, 15:5, 19:11, 20:18, 23:15, 24:14, 24:23, 26:18
- Rom: 5:7, 6:5, 6:17, 8:24, 9:11, 13:9
- 1 Cor: 7:15, 8:5, 8:11, 9:25, 12:5, 12:14, 14:29, 15:12, 15:19, 15:21, 15:35, 15:41
- 2 Cor: 6:9, 6:10, 7:4, 8:10, 9:7, 11:10, 11:20, 11:21, 11:23, 12:6, 12:13, 12:21
- Gal: 2:8, 3:15, 4:11, 5:10, 5:21
- Eph: 5:5; Phil: 1:22; Col: 3:15; 1 Thess: 4:14; 2 Thess: 2:4; 1 Tim: 5:16; 2 Tim: 2:9; Titus: 1:12
- Heb: 2:5, 3:17, 4:3, 4:11, 5:9, 5:13, 6:9, 6:10, 7:11, 7:14, 7:18, 8:10, 9:9, 10:38
- Jas: 2:14, 4:11
- 1 Pet: 1:12, 2:21, 3:7
- 1 John: 2:3, 3:19, 3:24
- Rev: 2:9, 4:8, 19:8

Points checked specifically:

- **Copula linked to a pronoun** (1 John 3:19 ἐσμέν → мы; Heb 5:13 ἐστίν → он; Jas 4:11 εἶ → ты#1; Luke 14:31 ἐστιν → он; Matt 4:6 εἶ → Ты; Rev 2:9 εἶ → ты): all six accepted. In each, the Russian copula is zero, Greek has no explicit subject pronoun, and the Russian pronoun is the subject of exactly the clause where the Greek copula stands. Where Greek does have an explicit pronoun, the copula correctly stays `s` (Acts 23:15 ἐσμεν, with ἡμεῖς owning мы). The same convention already exists in reviewed data (Mark 1:24 εἶ → Ты#1; 1 Cor 15:19 ἐσμέν → мы#0/мы#1).
- **TR claims in the new `g` notes**: 1 Cor 8:11 ἐπί, Luke 16:26 ἐπί, Gal 5:21 φόνοι, Heb 6:10 κόπου, Luke 15:12 καί and 1 Tim 5:16 (masculine-or-feminine "believer") are either certain or repeat a claim the original data-backed reasons already made. 2 Cor 11:10 σφραγίσεται repeats the original `s` reason and was not changed (see below).
- **Rule 9 linking across a TR difference**: δέ → И (Luke 15:12, TR καί), ἐν → от (1 Cor 8:11, TR ἐπί) and ἐν → сверх (Luke 16:26, TR ἐπί) are linked with a note, because the N1904 word has the same function. The author kept `s`/`t` where the TR word differs in meaning or form (1 Cor 8:11 γάρ/И, Heb 9:9 ἥν/которое, 1 John 5:18 αὐτόν/себя). That distinction is consistent.

## Unchanged verses spot-checked (10)

Acts 13:42, Acts 24:25, Acts 25:24, Jas 5:4, John 17:2, Matt 28:5, Matt 28:11,
1 John 5:18, Luke 20:3, Rom 3:7. I agree with leaving all ten as they are. In
the seven "not a rendering" verses, the Russian word renders a different Greek
word or relation: for example, Acts 13:42 их#1 is the object of asking, not the
hearers (αὐτοῖς); Jas 5:4 у marks the workers, while ἀπό goes with the agent
вами; Matt 28:5 вы is the subject of ищете, not the ὑμεῖς of the prohibition.
The three TR verses (1 John 5:18 ἑαυτόν, Luke 20:3 ἕνα λόγον, Rom 3:7 γάρ) are
genuine textual differences with a different meaning, so they rightly stay
unlinked.

## Uncertain (accepted, but a reasonable reviewer could choose `s`/`t`)

- Luke 21:25 — `g 15 = и#2`. Synodal turns ἐν ἀπορίᾳ "in perplexity" into "и недоумение". The coordinator takes over the preposition's job, but it is a structural rather than a lexical rendering.
- Acts 24:14 — `g 11 = действительно` for οὕτως "so". This is the only adverb in that slot, and the sense ("it is in that way / truly") is close, but the shift is noticeable.
- 1 Cor 7:15 — `g 22 = Господь` for Θεός, with no textual variant. It is the same referent and the subject of the verb, and the note states the difference. A reader may still be surprised by Θεός → "Lord".
- Acts 7:40 `g 23 = с` (resumptive αὐτῷ) and Rev 4:8 `g 7 = из` (partitive αὐτῶν): the pronoun's referent is rendered by the preceding noun, so only the case relation is linked to the preposition. This is consistent with each other and acceptable.
- John 14:22 — `g 9 = это`. The idiom τί γέγονεν ὅτι = "что это, что". A grouped `g 8 9 = что#0 это` would also be acceptable.
- 2 Cor 11:10 — the `g 10` note (and the original `s` reason) say that TR reads σφραγίσεται. This holds for the Stephanus edition; I cannot confirm it from memory for every printed TR. It was left as the original reviewers' claim.

## Follow-ups outside the pack (not edited)

The same split pairs remain in neighbouring verses that were not candidates.
They should get the same treatment for consistency:

- 2 Cor 6:8 — ὡς / `t нас почитают` and καί / `t но мы` (6:9 now links ὡς → почитают and καί → но).
- Luke 4:34 and Mark 5:7 — καί / `t до` in "что Тебе до …" (now linked in Mark 1:24, Luke 8:28 and Matt 8:29). Luke 4:34 also has εἶ / `t Ты`, as in Mark 1:24.
