# BSB Matthew 23: author review (Claude)

Verses reviewed: 38 of 38 (23:1–13, 23:15–39; no verse was kept from an
earlier reviewer). 23:14 is absent from N1904 and empty in the BSB text used
here, so it has no block.

Check: `fromtext` → `{"versesOk": 38, "problems": 0}`.

38 publisher rows in 17 verses were changed because they were wrong or
over-claimed. Another 22 rows were merged into article + participle units
(English unchanged), and 14 rows only gained a TODO token (for example
ὃς + ἄν → If anyone).

## Publisher rows corrected

- 23:3: κατά = "what" and ἔργα = "do" → κατὰ τὰ ἔργα = what … do (κατά alone
  is not "what"). μή = "do not" → not; ποιεῖτε = do + do. καί = "what" was
  wrong → καί explained, `t what` (λέγουσιν becomes the clause "what they
  preach"). "they do not practice" → οὐ = not, ποιοῦσιν = they do + practice.
- 23:4: "lay them" → lay, `t them`. δακτύλῳ = "to lift a finger" → a finger,
  `t to lift` (the Greek is "with their finger"). "are not willing" → οὐ =
  not, θέλουσιν = are + willing.
- 23:7: καλεῖσθαι = "the title" and ἀνθρώπων = "which they are addressed"
  were wrong; ὑπό = "by" was a false match (BSB's "by which" is not the agent
  "by men"). Now καλεῖσθαι = they are addressed, Ῥαββεί = Rabbi,
  ὑπὸ τῶν ἀνθρώπων explained as unexpressed, `t the title of`, `t by which`.
- 23:8: "are not to be called" → μή = not, κληθῆτε = are + to be called.
- 23:9: "do not call anyone" → μή = not, καλέσητε = do + call, `t anyone`.
  ὁ = "who is" (a lone article carrying "is") → ὁ οὐράνιος = who is in heaven.
- 23:13: ἔμπροσθεν = "in men’s faces" → in + faces, ἀνθρώπων = men’s.
  "do not enter" → οὐκ = not, verb = do + enter.
- 23:15: "he becomes one" → he becomes, `t one`. "as you are" → as you,
  `t are`.
- 23:16, 23:18: ὀφείλει = "he is bound by his oath" → he is bound,
  `t by his oath` (no Greek word for oath).
- 23:17, 23:19: "that makes it sacred" on the participle → that makes +
  sacred; τὸν χρυσόν / τὸ δῶρον = it.
- 23:18: καί = "And you say" → And, `t you say` (the verb of saying is
  carried over from 23:16).
- 23:19: "is greater" → greater, `t is` (no verb in the Greek).
- 23:23: δέ = "without" was wrong → δέ explained; μή = without, ἀφεῖναι =
  neglecting.
- 23:27: νεκρῶν = "of dead men’s" → dead men’s; ὀστέων = of + bones (the
  "of" is the genitive after γέμουσιν, "full of").
- 23:30: ἡμῶν = "of our" → τῶν = of, ἡμῶν = our. "we would not have been"
  → οὐκ = not, ἂν ἤμεθα = we would + have been. "in shedding" → in,
  `t shedding`.
- 23:32: μέτρον = "measure of the sin" → measure, `t of the sin`.
- 23:37: "children together" → children; together goes with ἐπισυναγαγεῖν
  (to gather + together).
- 23:39: "you that" → you, `t that`. "you will not see" → οὐ μή = not,
  ἴδητε = you will + see. "Blessed is" → Blessed, `t is` (as in 21:9).

## Notable decisions

- Article + participle joined (rule 3): τοὺς εἰσερχομένους (23:13), οἱ
  λέγοντες = You say (23:16), ὁ ἁγιάσας / τὸ ἁγιάζον (23:17, 19), ὁ ὀμόσας =
  he who swears (23:20–22), τῷ κατοικοῦντι, τῷ καθημένῳ = the One who …
  (23:21–22), οἱ διϋλίζοντες = You strain out (23:24), τῶν φονευσάντων
  (23:31), ἡ ἀποκτείνουσα, τοὺς ἀπεσταλμένους (23:37), ὁ ἐρχόμενος (23:39).
- Other joint units: πάντα ὅσα ἐάν = everything (23:3); ὃς ἄν = If anyone
  (23:16, 18); πρὸς τὸ θεαθῆναι: τὸ θεαθῆναι = to see (23:5); πᾶσι τοῖς =
  everything (23:20); πρὸς ὑμᾶς = you (23:34); the second ἐξ αὐτῶν = others
  (23:34); ἀπό … εἰς = in … after (town after town, 23:34); ὃν τρόπον = as;
  οὐκ ἠθελήσατε = you were unwilling (23:37); ἀπ’ ἄρτι = again, ἕως ἄν =
  until, οὐ μή = not (23:39); ἂν ἤμεθα = we would + have been (23:30).
- Articles as possessives kept: their (23:5 τὰ κράσπεδα), her (23:37 τὰς
  πτέρυγας).
- Textual differences from N1904 (`t`):
  - 23:4 "burdensome": BSB follows φορτία βαρέα καὶ δυσβάστακτα.
  - 23:26 "and dish": BSB follows τοῦ ποτηρίου καὶ τῆς παροψίδος.
  - 23:38 "desolate": BSB follows the reading with ἔρημος.
  - 23:14 is a Textus Receptus verse absent from N1904 and from this BSB text.
- Left unexpressed (`s`): the causal ὅτι after each "Woe to you … hypocrites!"
  (BSB starts a new sentence), λέγων (23:2), ἰδού (23:34), ὑπὸ τῶν ἀνθρώπων
  (23:7), τοῖς ἀνθρώποις (23:28), the emphatic ὑμεῖς with Fill up (23:32),
  ἀπό with escape (23:33), αὐτοῦ in "the outside" (23:26), μέν (23:27, 28).
- Kept from the publisher on purpose: the vocative "you/You" in "you
  hypocrites", "You blind (men)", "You snakes", "You brood" stays with the
  noun; ἐστιν ὑμῶν = you have (23:8–9); ἐστιν = it means (23:16, 18); ἔδει =
  You should have (23:23); ταῦτα / κἀκεῖνα = the latter / the former (23:23);
  εἰσελθεῖν = in of "let in" (23:13); ποιοῦσιν = are done (active rendered
  passive, 23:5); αὐτόν = in it (23:21).

## Doubts for the peer

- 23:7: is it right that BSB's "by which they are addressed" does not render
  ὑπό, so that ὑπὸ τῶν ἀνθρώπων is `s` and "by which" is `t`?
- Vocative "You": earlier chapters (5, 15:7) made it `t`; here the publisher
  rows "you hypocrites", "You blind", "You snakes" were kept. Split them if
  the project wants one rule.
- 23:16, 23:18: "by his oath" as `t` rather than part of ὀφείλει's rendering.
- 23:4: τῷ and αὐτῶν are `s`, δακτύλῳ = a finger and "to lift" is `t`;
  alternatively τῷ δακτύλῳ αὐτῶν could carry "lift a finger" as an idiom.
- 23:34: ἀπό … εἰς = in + after, with each πόλις = town; the alternative is
  one group ἀπὸ πόλεως εἰς πόλιν = in town after town.
- 23:31 "the sons" and 23:35 "all the righteous blood": the English "the" has
  no Greek article but was left with the noun/adjective as the publisher had it.
