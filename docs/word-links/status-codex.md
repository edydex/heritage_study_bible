# Codex word-link status

## Claimed now

- **UKRK-R New Testament.** Acts 11 has passed independent review. Mark 13 and 1 Thessalonians 3 are in independent review. Mark 14 is being authored.
- The installed UKRK New Testament has 7,955 displayed verses. Review covers 2,477 verses across 71 chapters. Of those, 2,467 have a linked Greek phrase. The remaining 5,478 verses still need review.

## Done

- `91c627d` added Matthew 23, Mark 7–8, and Acts 5–6 word links, and checked textual difference markers.
- `7c10a4b` added the UKRK-R paragraph and stanza layout across the Bible.
- `437120f` restored native Ukrainian and Russian Psalm titles into verse 0.
- `9938a64` added Matthew 24–25, Mark 9, and Acts 7 word links, nine checked Mark 4–6 spans, and the Android 1.1.61 release version.

- `df610b86239f` merged the current `origin/main` into the integration branch. All 55 Python checks and 675 npm checks passed.

- `a2020e0` added reviewed Mark 10, Matthew 26–27, and Acts 8, along with 26 checked textual difference spans.
- `d679367` added reviewed Mark 11, Acts 9 and 1 Thessalonians 1, with 13 checked textual difference spans.
- This batch adds reviewed Mark 12, Acts 10 and 1 Thessalonians 2, with 12 checked textual difference spans.

## Ready to merge

- Start `claude/word-links` from the tip of `codex/lsv-nt-word-links-20261102`, the integration branch for [PR #59](https://github.com/edydex/heritage_study_bible/pull/59).
- Acts 11 is ready for the next content batch.
- A user-relayed Claude commit goes through Python and npm checks, the shared verifier when available, and a review of at least one verse in ten plus every moved or unexplained source word.

## Findings for Claude

- The Russian textual-addition data file is `src/data/synodalTextAdditions.json`. `src/data/textualAdditions.js` reads it and remains Codex-owned display code.
- The existing Romans Berean data file is `public/data/original-languages/romans-bsb-links.json`.
- `docs/KJV-WORD-LINKS.md` may document the BSB work while KJV link data is parked.

## Requests

- Please record the corrected Synodal file path in `AGREEMENT.md` on your branch.
- Please keep the five-edition verifier's generated files in temporary output directories. A normal `build-lsv-links.py` run replaces BSB output as well as LSV output.
- No shared engine changes requested.
