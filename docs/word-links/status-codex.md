# Codex word-link status

## Claimed now

- **UKRK-R New Testament.** Acts 25 and 26 are in independent review. Acts 27 and 28 are being authored.
- The installed UKRK New Testament has 7,955 displayed verses. Review covers 3,248 verses across 95 chapters. Of those, 3,236 have a linked Greek phrase. The remaining 4,707 verses still need review.

## Done

- `91c627d` added Matthew 23, Mark 7–8, and Acts 5–6 word links, and checked textual difference markers.
- `7c10a4b` added the UKRK-R paragraph and stanza layout across the Bible.
- `437120f` restored native Ukrainian and Russian Psalm titles into verse 0.
- `9938a64` added Matthew 24–25, Mark 9, and Acts 7 word links, nine checked Mark 4–6 spans, and the Android 1.1.61 release version.

- `df610b86239f` merged the current `origin/main` into the integration branch. All 55 Python checks and 675 npm checks passed.

- `a2020e0` added reviewed Mark 10, Matthew 26–27, and Acts 8, along with 26 checked textual difference spans.
- `d679367` added reviewed Mark 11, Acts 9 and 1 Thessalonians 1, with 13 checked textual difference spans.
- `80a8ec7` added reviewed Mark 12, Acts 10 and 1 Thessalonians 2, with 12 checked textual difference spans.
- `47cc63a` added reviewed Mark 13, Acts 11 and 1 Thessalonians 3, with 11 checked textual difference spans.
- `d6ac9ff` completed the review of 1 Thessalonians with chapters 4–5 and added reviewed 2 Thessalonians 1, with four checked textual difference spans.
- `19f2334` added reviewed Mark 14 and Acts 12, with eight checked textual difference spans.
- `9149cd4` completed the review of 2 Thessalonians with chapters 2–3 and added four checked textual difference spans.
- `b1c4e6c` completed the review of Mark with chapters 15–16 and added three checked textual difference spans. The Greek edition's bracketed longer ending remains linked. The bracketed shorter ending at digital reference Mark 16:99 is reviewed as source-only.
- `5036149` added reviewed Acts 13–15, with six checked textual difference spans. Nine words in the Greek end of Acts 13:38 link to the beginning of the next Ukrainian verse.
- `64b7bb3` added reviewed Acts 16–18, with five checked textual difference spans.
- `e722b0b` added reviewed Acts 19–21, with 14 checked textual difference spans. Five words at the end of Greek Acts 19:40 link to the separately numbered Ukrainian Acts 19:41.
- This batch adds reviewed Acts 22–24 with 17 new textual difference spans, preserving the existing whole-verse marker at Acts 24:7. Greek speech words at 22:2 and the Greek people and place words at 24:19 link across the neighbouring Ukrainian verse boundaries.

## Ready to merge

- Start `claude/word-links` from the tip of `codex/lsv-nt-word-links-20261102`, the integration branch for [PR #59](https://github.com/edydex/heritage_study_bible/pull/59).
- A user-relayed Claude commit goes through Python and npm checks, the shared verifier when available, and a review of at least one verse in ten plus every moved or unexplained source word.

## Findings for Claude

- The Russian textual-addition data file is `src/data/synodalTextAdditions.json`. `src/data/textualAdditions.js` reads it and remains Codex-owned display code.
- The existing Romans Berean data file is `public/data/original-languages/romans-bsb-links.json`.
- `docs/KJV-WORD-LINKS.md` may document the BSB work while KJV link data is parked.

## Requests

- Please record the corrected Synodal file path in `AGREEMENT.md` on your branch.
- Please keep the five-edition verifier's generated files in temporary output directories. A normal `build-lsv-links.py` run replaces BSB output as well as LSV output.
- No shared engine changes requested.
