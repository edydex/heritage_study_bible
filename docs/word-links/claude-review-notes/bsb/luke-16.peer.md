# BSB Luke 16: independent peer review (Claude)

Checked: 31 of 31 verses (16:1-31; no verse was kept from an earlier
review). I checked every `g`, `s` and `t` line against N1904, the displayed
BSB, the publisher record in
`public/data/original-languages/bsb-word-links/luke.json`, the publisher rows
in the draft, and the reviewed parallels Matthew 5:18, 5:32, 6:24, 11:12-13
and Mark 10:25. Final check: `fromtext` → `{"versesOk": 31, "problems": 0}`.

## Changes

None. I found no wrong anchor, no over-claim, no split pair, no wrong reading
claim and no misleading note. The final JSON has the same verse content as
the author's file. A round trip of the unchanged text reproduces the author's
verses exactly. A few choices could go either way (listed below), but they
are correct as they stand, so I did not change them for taste.

## Reading claims

The publisher record has a `partial` entry for 16:12, 16:16, 16:23 and 16:31
only. Each shows exactly one N1904 word unmatched and one publisher word
missing from N1904. In each verse the English word counts match in full.

- 16:12 (13 / 12 / 13 Greek words; 20 / 20 / 20 English). The publisher's
  "belongings#1" transferred onto τό, but "of your own" did not transfer.
  So "of your own" sat on the publisher's own word, the one not in N1904.
  That word is not ἡμέτερον: if ἡμέτερον had matched, its English would
  have transferred. Equal word counts with a single mismatch also rule out a
  different order of δώσει ὑμῖν. BSB's English "your own" shows a word
  meaning "yours", against N1904's ἡμέτερον ("ours"). The meaning differs,
  so `s` ἡμέτερον and `t belongings#1 of your own`, both with the reading
  reason, are right (rule 9, second bullet). τό stays `s`: a lone article
  may not carry the noun "belongings". Neither note states the publisher's
  spelling.
- 16:16 (Ἰωάνου = John) and 16:23 (Ἅιδῃ = Hades): the only unplaced English
  word is "John" or "Hades". The standard note "Same name, spelled
  differently in BSB's Greek text" is right. It matches Luke 10:15 (Ἅιδου)
  and the Ἰωάνου precedents.
- 16:31 (17 / 16 / 17; 27 / 27 / 27): no English word is unplaced. Every
  other Greek word received a transferred link, so the unmatched word must
  be one of the two TODO tokens, οὐκ or οὐδέ. The record does not show
  which one. The other publisher verses have the same row pattern (16:12 οὐκ
  is TODO although it certainly matched), so the TODO does not decide it.
  It is most likely οὐδέ in an elided spelling, since modern critical texts
  read οὐδ’ ἐάν, but that is inference. "not … even" renders either form,
  so no reading note is added. The Luke 9 peer review handled an unidentified
  same-meaning word the same way.
- No other verse claims a reading. 16:21 rightly claims none: the publisher's
  Greek equals N1904.

## Answers to the author's doubts

- 16:12: agree. The claim does not rest on the EVIDENCE line alone. The
  transferred "belongings#1" and the untransferred "of your own" pin the
  difference to ἡμέτερον's slot, and the English shows the meaning.
- 16:21 `t crumbs`: agree. The publisher's Greek equals N1904, and N1904 has
  no word for "crumbs". "crumbs" is a specific noun that BSB supplies for the
  substantival participle. Keeping it inside τῶν πιπτόντων would let a reader
  think πιπτόντων means "crumbs". The group τῶν πιπτόντων = "the + that fell"
  (article + participle, rule 3) is correct. Keeping "crumbs" in the group
  would also be defensible, like "true riches" in 16:11, but I see no reason
  to change it.
- 16:1 ὡς = of: agree. ὡς with the participle marks the charge, which is
  exactly what English "of" does after "accused". Putting "of" in διεβλήθη
  and leaving ὡς `s` would make a near split pair. ὃς εἶχεν = whose is a good
  join; it matches Luke 15:11 (εἶχεν = who had).
- 16:1 οὗτος, καί and αὐτῷ `s`: agree. "manager" already renders
  οἰκονόμον. Adding οὗτος would put two Greek words on one English word
  that renders only one of them.
- 16:10 and 16:15 article + adjective joins: agree. This is the established
  treatment: Luke 12:57 τὸ δίκαιον = what is right; Matthew 25:10 αἱ ἕτοιμοι
  = Those who were ready; 1 Thessalonians 5:15 and 5:21 τὸ ἀγαθόν/καλόν =
  what is good. Splitting the article off would leave "Whoever"/"what" on
  the article with a stray `t is`. Neither precedent does that.
- 16:28 ὅπως διαμαρτύρηται = Let him warn: agree. It matches Matthew 26:63,
  where ἵνα εἴπῃς = "Tell" is joined as a command. 16:27 instead leaves ἵνα
  `s` before πέμψῃς = send, which is also precedented (Matthew 16:20, Luke
  6:31). The two adjacent verses use different, equally valid treatments of
  the same construction. I did not harmonize them; see "Still uncertain".
- 16:31: see "Reading claims" above. A note is needed only if a later check
  of BSB's Greek shows the word is not a same-meaning spelling variant.

## Other checks worth recording

- ὁ δέ: 16:6 ὁ = the manager, and 16:6, 16:7 and 16:30 ὁ = he, with the
  verb separate. This matches the reviewed Luke, Mark and Matthew chapters
  (e.g. Luke 7:40 and 10:27 ὁ = he; Luke 9:59 and Mark 1:45 ὁ = the man).
- 16:6 καί = and: a correct link, not a participle-joining "and". The Greek
  καί joins Δέξαι and γράψον. BSB's "and" stands before "write", the same
  verb the καί introduces. 16:21 and 16:23 have no Greek καί at that point,
  so `t and` there is right.
- 16:13 and 16:17-18 follow Matthew 6:24, Mark 10:25 and Matthew 5:18 and
  5:32. 16:18 joins ὁ ἀπολύων (rule 3) where Matthew 5:32 kept them apart.
  Both are acceptable.
- 16:22 ἐγένετο δέ = One day follows Luke 1:8. 16:23 ἐπάρας τοὺς ὀφθαλμοὺς
  αὐτοῦ = he looked up follows Luke 6:20.
- 16:25: ἀπέλαβες = you received + received#1 (verb understood again), with
  ὁμοίως `s`. This correctly replaces the publisher's ὁμοίως = received.
- 16:19: εὐφραινόμενος = who lived + joyous and λαμπρῶς = in + splendor is
  an accurate split of "joyous splendor".

## Still uncertain

- 16:31: which word differs is not visible in the record (see above).
- 16:27 / 16:28: a later pass could harmonize the two adjacent purpose
  clauses. Either join ἵνα πέμψῃς = send (as Matthew 26:63) or make ὅπως
  `s`. Both current links are correct as they stand.
- 16:17: "for#0" is on οὐρανόν (subject of the first infinitive), while
  "than for" stays on ἤ instead of giving "for" to κεραίαν. This mirrors
  Mark 10:25 exactly, so I kept it for consistency with that parallel.
