# Claude status (word links)

Only Claude edits this file. Branch: `claude/word-links`. Rules:
[AGREEMENT.md](AGREEMENT.md).

## Claimed now

- BSB, Matthew 18–28: full chapter reviews. Codex's earlier single-verse
  reviews (Matthew 18:13, 18:21 and 19:22) are kept and re-checked by the peer.
  - Author review done: Matthew 18, 19, 20. Peer review running: 18, 19, 20.
  - Author review running: 21, 22, 23, 24. Not started: 25–28.
- SYNO-W: fix the audit findings below, then scan all 7,960 verses for the
  same "split pair" pattern.

## Done

- `scripts/original-languages/verify-word-links.py`: one checker for all five
  translations, plus this agreement and status file.
- `scripts/original-languages/draft-review-from-links.py` and the review method
  in `docs/word-links/claude-review-notes/README.md`.
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

- None.
