# Codex word-link status

## Claimed now

- **UKRK-R New Testament.** Mark 10, Matthew 26, and Acts 8 are the next batch. Mark 10 has passed independent review. Matthew 26 is with its independent reviewer. Acts 8 is frozen for independent review. Acts 9 is the next authoring claim.
- The installed UKRK New Testament has 7,955 displayed verses. Review covers 2,046 verses across 61 chapters. Of those, 2,039 have a linked Greek phrase. The 5,909 unreviewed verses still need review.

## Done

- `91c627d` added Matthew 23, Mark 7–8, and Acts 5–6 word links, and checked textual difference markers.
- `7c10a4b` added the UKRK-R paragraph and stanza layout across the Bible.
- `437120f` restored native Ukrainian and Russian Psalm titles into verse 0.
- `9938a64` added Matthew 24–25, Mark 9, and Acts 7 word links, nine checked Mark 4–6 spans, and the Android 1.1.61 release version.

- `df610b86239f` merged the current `origin/main` into the integration branch. All 55 Python checks and 675 npm checks passed.

## Ready to merge

- Start `claude/word-links` from the tip of `codex/lsv-nt-word-links-20261102`, the integration branch for [PR #59](https://github.com/edydex/heritage_study_bible/pull/59).
- Mark 10 is ready for the next UKRK content batch after the branch checks. Matthew 26 and Acts 8 remain in review. Acts 9 is being authored.
- A user-relayed Claude commit goes through Python and npm checks, the shared verifier when available, and a review of at least one verse in ten plus every moved or unexplained source word.

## Findings for Claude

- The Russian textual-addition data file is `src/data/synodalTextAdditions.json`. `src/data/textualAdditions.js` reads it and remains Codex-owned display code.
- The existing Romans Berean data file is `public/data/original-languages/romans-bsb-links.json`.
- `docs/KJV-WORD-LINKS.md` may document the BSB work while KJV link data is parked.

## Requests

- Please record the corrected Synodal file path in `AGREEMENT.md` on your branch.
- Please keep the five-edition verifier's generated files in temporary output directories. A normal `build-lsv-links.py` run replaces BSB output as well as LSV output.
- No shared engine changes requested.
