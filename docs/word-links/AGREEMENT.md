# Word-link work agreement: Claude and Codex

Two coding agents share the Greek NT word-link content work. They don't talk
directly: the owner relays short messages, and each agent reads the other's
branch through git. Changes to this file need the owner's OK.

## Who edits what

Only the owner of a path edits it. The machine-readable copy of this table is
`OWNERS` in `scripts/original-languages/verify-word-links.py`; the longest
matching prefix wins.

| Area | Owner | Paths |
|---|---|---|
| BSB links | Claude | `scripts/original-languages/reviewed-bsb/`, `bsb-review-status.json`, `public/data/original-languages/bsb-word-links/`, `romans-bsb-links.json`, `docs/KJV-WORD-LINKS.md` |
| LSV links (finished; maintenance only) | Claude | `reviewed-lsv/`, `lsv-review-status.json`, `build-lsv-links.py`, `lsv-word-links/`. `build-lsv-links.py` also rewrites `bsb-word-links/`, so only the BSB owner runs it. |
| SYNO-W links (finished; audit and corrections) | Claude | `reviewed-syno-w/`, `syno-w-review-status.json`, `build-synodal-links.py`, `syno-w-word-links/`, `src/data/synodalTextAdditions.json`, `docs/SYNO-W-WORD-LINKS.md` |
| Checker and Claude's notes | Claude | `scripts/original-languages/verify-word-links.py`, `draft-review-from-links.py`, `docs/word-links/status-claude.md`, `docs/word-links/claude-review-notes/` |
| UKRK links | Codex | `reviewed-ukrk/`, `ukrk-review-status.json`, `build-ukrk-links.py`, `ukrk-word-links/`, `src/data/ukrkTextAdditions.json`, `public/data/verse-layout/UKRK.json` |
| App code, Word Study screen, deploys | Codex | `src/` (except `synodalTextAdditions.json`), `e2e/`, `tests/`, `android/`, `package*.json`, `docs/ORIGINAL-LANGUAGES.md`, `docs/word-links/status-codex.md`; heritage.faith deploys |
| Shared engine | Both, by request | `compile-reviewed-links.py`, `reviewed_link_resources.py`, `shared_phrase_links.py`, `audit-nt-word-links.py`, `greek-nt-n1904.json`, `greek-concordance.json`, `greek-nt-metadata-errata.json`. Changing these changes every translation's output: post a request in your status file and wait for the owner's OK. |
| KJV links | Parked | `reviewed-kjv/`, `kjv-review-status.json`, `build-kjv-links.py`, `kjv-word-links/`. Nobody edits until the owner assigns it. |
| Old Testament word links, grammar beyond Romans/Colossians | On hold | Waits for the owner's spot-check of the NT. |
| `community-server/` | Neither | Another session's area. |

To change something you don't own, write a request in your own status file.

## Branches and deploys

- Claude works on `claude/word-links`, Codex on `codex/lsv-nt-word-links-20261102`.
  Neither pushes to the other's branch. Each may merge the other's branch
  into its own.
- Until PR #59 merges, Codex's branch is the integration and deploy branch. When
  the owner relays "Claude's batch is ready at `<commit>`", Codex runs
  `git fetch origin && git merge <commit>`, runs the checks, then deploys.
- While #59 is open, nobody puts content on `main` directly. A push to `main`
  that touches reader files auto-deploys main's older reader over heritage.faith.

## Status files

Each agent writes only its own: `docs/word-links/status-claude.md` and
`docs/word-links/status-codex.md`. Sections:

- **Claimed now:** translation and chapters.
- **Done:** commit ids.
- **Ready to merge.**
- **Findings for the other agent.**
- **Requests:** changes needed to shared or other-owned files.

To read the other side:

```bash
git fetch origin
git show origin/<their-branch>:docs/word-links/status-<them>.md
```

## Checks before "ready to merge" and before any deploy

```bash
python3 scripts/original-languages/verify-word-links.py --owner <you> --since <last merged commit>
npm test
```

The checker runs the word-link unit tests and rebuilds all five translations
from their accepted reviews, byte-comparing them with the committed files. It
checks that registries, review files and published verses agree, flags changed
files the agent does not own, and prints the done/left table. Don't deploy if
it fails.

## Cross-review

- Nothing waits on the other agent. Each keeps its own author review and
  independent review per chapter.
- After each batch from the other agent, check a sample: at least 1 verse in
  10, plus every verse with moved or unexplained source words. Write findings
  in your own status file: file, verse, problem, suggested fix. The owner
  fixes them.
- Claude commits its review notes under `docs/word-links/claude-review-notes/`
  so they can be checked. Today's review receipts are hashes only.
