# Bible audio

The BSB recording by **Barry Hays** is available in the internal audio library and from the BSB chapter view. All 66 books / 1,189 chapters use the same player, resume positions, queue, Android downloads and Internal Storage management as audiobooks. Android Auto exposes a separate **Bible · BSB** folder. Chapters advance within a book. No playback starts merely from opening the reader.

The expanded player opens the playing verse when timing exists, otherwise the chapter. It explicitly opens BSB rather than attaching its recording to another translation. A temporary gray marker shows the currently timed BSB verse, independent of notes, bookmarks and saved highlights. **Auto-scroll this chapter** is opt-in and resets on changing the chapter; manual browsing elsewhere never gets pulled back. Selection mode suppresses the marker and following. A parallel view marks only the BSB text. A timing fetch failure leaves audio playback usable and offers Retry.

## Sources and rights

- Publisher attribution and CC0 dedication: https://biblehub.com/audio/romans/1.htm and https://audiobible.org/ . Both identify Barry Hays, Bob Souer and Jordan Gilbert recordings as public domain under CC0 1.0. This implementation uses **Barry Hays only**.
- Actual public chapter URLs: https://openbible.com/audio/hays/ . The official player and public chapter directory are used directly; no account or download gate is bypassed.
- Timing contributor source: https://github.com/BSB-publishing/bsb-align at `bdb859afc427b215b78e12ee4a7798c32b7b91e0`, MIT license copied to `scripts/bible-audio/bsb-align-LICENSE.txt`. This is a contributed automatic alignment dataset; the GitHub organization name is not evidence of publisher endorsement. Its README calls the narrator “Bob Hays”; the publisher's correct credit, Barry Hays, is used here.

No MP3 recordings are bundled in Git or the APK. The app streams public recordings and stores requested downloads in private app storage. `scripts/bible-audio/hays-metadata.json` records exact byte counts, durations, last-modified headers and SHA-256 hashes of the first 65,536 bytes inspected on September 21, 2026 UTC. These are header hashes, not full-recording hashes.

## Timing quality and limitations

The supplied timings are automatic MMS alignments, **not manually verified word or verse timing**. Many upstream text rows are truncated (for example Genesis 1:3 omits the final clause); some verses are missing. Heritage never reconstructs missing text or extends a valid span across such a gap.

The import accepts only complete word-sequence matches to the displayed BSB verse, with finite ordered spans inside the recording, non-overlapping verses, average word confidence at least 0.65 and both boundary scores at least 0.3. It retains the publisher's verse wording unchanged. Runtime comparison rejects a marker if the displayed verse wording changes.

Current coverage is **14,912 of 31,102 verse records**. Rejected: 15,036 text mismatches, 624 low-confidence alignments, 516 missing verses and 14 spans outside recording duration. Narrator intros, pauses and rejected spans are unhighlighted. Each chapter states its coverage. This protects source fidelity but does not prove the remaining automatic timings are exact; a proper future alignment pass must use the complete displayed text and listening checks. Do not advertise this as full-Bible exact verse synchronization.

SYNO and UKRK recordings are not included: a public-domain text does not automatically license a particular recording. A future recording must have explicit distribution/download permission and match the exact displayed edition before verse following is enabled.

### Russian and Ukrainian source review (2026-09-20)

The bundled texts come from eBible's [Russian Synodal](https://ebible.org/bible/details.php?id=russyn)
and [Kulish/Pulyui](https://ebible.org/details.php?id=ukr1871) editions. Those pages
identify the texts as public domain; they do not supply an audio license or a
matching recording. A Ukrainian recording of another translation must not be
labeled UKRK.

[Bible Brain](https://www.faithcomesbyhearing.com/bible-brain/developer-documentation)
is a possible licensed integration source with audio and verse timings. Its
[API license](https://www.faithcomesbyhearing.com/bible-brain/license) requires an
assigned application key, attribution and applicable content terms. Offline use
is limited to content provided through its download endpoint. No account or
agreement was created, and no recording was copied from that service. Before
adding it, confirm the exact Russian/Ukrainian edition, fileset and download
permission; keep unavailable downloads disabled and validate verse numbering.

## Reproduce

1. Clone `https://github.com/BSB-publishing/bsb-align.git` outside this repository and check out the pinned commit above. The generator rejects a different HEAD.
2. Use the committed metadata snapshot for deterministic generation. To audit new upstream media, run `python3 scripts/bible-audio/fetch-metadata.py /path/to/cache` (Python standard library plus ffprobe). Review changes before copying its `hays-metadata.json` into `scripts/bible-audio/`.
3. From the Heritage repository root, run `BSB_ALIGNMENT_DIR=/path/to/bsb-align node scripts/bible-audio/generate.mjs`.
4. This writes the Bible catalog, combined native/web audio catalog, per-book timing files and `timing-audit.json` with source/text hashes. `scripts/generateAudioCatalog.mjs` preserves the generated Bible catalog when refreshing LibriVox metadata.

## Acceptance

- 267 unit tests and 124 protocol tests passed, including all imported spans against displayed Bible text, media duration, track identity, gaps, changed text and translation boundaries.
- Five real-media-element browser tests passed in Chromium and Firefox using local WAV fixtures. These cover resume/navigation, marker/following, unchanged annotation storage, failed timing fetch, library chapters and narrow layout.
- Real public BSB Romans 1 streaming/seek passed in Chromium and Firefox: position advanced after seeking, the gray marker reached verse 26, and narrow layouts had no overflow or page errors. Playback was muted during this smoke test; this is not an auditory timing review.
- Android app and instrumentation packages compile; the car-library test now checks the 66-book Bible root, Romans queue and pinned recording URL. Packaged emulator acceptance and real public-media smoke results are recorded in the integration delivery record.
- Browser fixtures prove UI behavior, not that automatic timings match the spoken words. Physical Android Auto and device checks remain required.
