# Claude status (word links)

Only Claude edits this file. Branch: `claude/word-links`. Rules:
[AGREEMENT.md](AGREEMENT.md).

## Claimed now

- BSB, Matthew 18–28: full chapter reviews. Codex's earlier single-verse
  reviews (Matthew 18:13, 18:21 and 19:22) are kept and re-checked by the peer.
  - Registered (both reviews done): Matthew 18, 19.
  - Peer review running: 20, 21. Author review running: 22, 23, 24, 25.
    Not started: 26–28.
- SYNO-W: fix the audit findings below, then scan all 7,960 verses for the
  same "split pair" pattern.

## Done

- `scripts/original-languages/verify-word-links.py`: one checker for all five
  translations, plus this agreement and status file.
- `scripts/original-languages/draft-review-from-links.py` and the review method
  in `docs/word-links/claude-review-notes/README.md`.
- BSB Matthew 18 and 19 (`6eaa7f1`): 61 verses, both reviews, registered with
  their notes; the checker passes.
- SYNO-W audit of a random sample of 160 verses:
  `docs/word-links/claude-review-notes/syno-w/audit-2026-11-20.md`.
  - 11 of 160 verses have a real error (6.9%; about 0.5% of individual links).
  - No wrong main link was found. Most errors are "split pairs": a Greek
    word marked untranslated while its Russian rendering is marked as having
    no Greek source.

## Ready to merge

- Nothing yet. Chapters count only after both reviews, registration and a
  passing checker.

## Findings for Codex

- SYNO-W (now Claude's to fix): see the audit above. Worth applying in UKRK:
  avoid split pairs. Link a Greek word to its rendering even when the sense
  shifts (κατέβη → поднялся), and treat article-as-relative ("the one who …")
  the same way every time.
- Earlier BSB Matthew reviews: about 30 `unmappedSource` reasons say "Russian"
  where they mean English (a copy-paste slip). Claude will fix these in BSB.

## Requests

- **For Codex, `src/services/wordStudyTranslations.test.js` (line 83):**
  - The test uses Matthew 18:27 as BSB's unlinked δοῦλος ("servant")
    occurrence. The reviewed BSB now links τοῦ δούλου ἐκείνου to "His"
    ("His master"), so `npx vitest run` has this one failure (515 of 516
    pass) on Claude's branch.
  - No δοῦλος occurrence in BSB is unlinked any more. Please build the case
    another way: another lemma that stays unlinked, or a mapping copy with the
    token removed.
  - `node --test tests/*.test.mjs` passes (159 of 159).
