# Bible audio

The BSB recording by **Barry Hays** is available in the internal audio library and from the BSB chapter view. All 66 books / 1,189 chapters use the same player, resume positions, queue, Android downloads and Internal Storage management as audiobooks. Android Auto exposes a separate **Bible · BSB** folder. Chapters advance within a book. No playback starts merely from opening the reader.

**Play/Pause** is beside the book/chapter name in the existing bottom navigation.
There is no audio card above Scripture or extra fixed player below it. While
playing (including startup), tapping a timed verse seeks to its beginning;
unmapped verses show a small notice rather than opening notes. Normal verse
notes remain available when audio is paused.

**Settings → Audio Settings** contains playback position/speed, chapters and
downloads. Bible auto-scroll is on by default and saved per device; turn it off
there. The temporary gray spoken-verse marker is independent of saved notes and
highlights. Only BSB text is marked in parallel view. Selection mode pauses
following, and browsing an unrelated chapter does not pull the reader back.
When playback advances within the current book, a following reader advances too.

Android can download the whole BSB recording from Audio Settings, with remaining
size and confirmation before transfer. The queue survives page navigation,
skips valid saved chapters and can stop after its current atomic download.
Retry retains completed files. There is no forced first-play popup or delay.
Timing failures do not prevent listening or alter the Bible text.

## Sources and rights

- Publisher attribution and CC0 dedication: https://biblehub.com/audio/romans/1.htm and https://audiobible.org/ . Both identify Barry Hays, Bob Souer and Jordan Gilbert recordings as public domain under CC0 1.0. This implementation uses **Barry Hays only**.
- Actual public chapter URLs: https://openbible.com/audio/hays/ . The official player and public chapter directory are used directly; no account or download gate is bypassed.
- Timing contributor source: https://github.com/BSB-publishing/bsb-align at `bdb859afc427b215b78e12ee4a7798c32b7b91e0`, MIT license copied to `scripts/bible-audio/bsb-align-LICENSE.txt`. This is a contributed automatic alignment dataset; the GitHub organization name is not evidence of publisher endorsement. Its README calls the narrator “Bob Hays”; the publisher's correct credit, Barry Hays, is used here.

No MP3 recordings are bundled in Git or the APK. The app streams public recordings and stores requested downloads in private app storage. `scripts/bible-audio/hays-metadata.json` records exact byte counts, durations, last-modified headers and SHA-256 hashes of the first 65,536 bytes inspected on September 21, 2026 UTC. These are header hashes, not full-recording hashes.

## Timing quality and limitations

The supplied timings are automatic **complete-text MMS alignments**, not a
manual listening review. The previous imported dataset accepted only 14,912
verse records: many upstream rows were truncated or missing. Version 1.1.43
replaces those timings for **all 1,189 chapters**, using the complete displayed
BSB text without changing Scripture, recordings or saved positions.

Current coverage is **29,630 of 31,102 verse entries (95.27%)**. This is coverage,
not an accuracy score. Exclusions include 983 low-confidence verses, 497 with
numeric tokens requiring spoken-form review, and 16 intentionally blank BSB
verse entries. Reasons overlap for 24 verses. Blank entries preserve the BSB's
numbering; no spoken verse is invented for them.

Every accepted span has finite ordered word positions inside the exact recording,
no overlapping verses, average word confidence at least 0.65 and boundary scores
at least 0.3. Runtime comparison rejects a marker if the displayed wording
changes. Intros, pauses and rejected passages remain unhighlighted.

An independent Whisper large-v3 check transcribed 60 cropped samples with no
reference prompt: every verse of Romans 8, plus first/middle/last samples from
Genesis 1, Psalms 23 and 119, Isaiah 53, John 3, Ephesians 2 and Revelation 22.
58 matched all normalized reference words. The other two were examined against
an additional full-context Romans 8 transcription: verse 15 includes the spoken
phrase “adoption to sonship” where the displayed text says “sonship”; the cropped
verse 20 recognition invented a continuation absent from the full-context
recognition. Neither observation changes the displayed Bible text. Verse-level
following does not promise a word-for-word recording of every displayed phrase.

Romans 8 now has 38 of 39 timed verses, including 2–3 and 6–8. Verse 9 remains
excluded by its boundary-confidence check despite an exact cropped transcript;
recognition alone does not prove a precise boundary. The source hashes, model
versions, sample results and limitations are in `full-text-audit.json` and
`independent-review.json` under `scripts/bible-audio/`. No human listening review
or full-library speech-recognition accuracy score is claimed.

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

## Historical upstream import

These steps reproduce the previous dataset, not the 1.1.43 replacement. Do not
run the old generator over the complete-text timings without restoring them.

1. Clone `https://github.com/BSB-publishing/bsb-align.git` outside this repository and check out the pinned commit above. The generator rejects a different HEAD.
2. Use the committed metadata snapshot for deterministic generation. To audit new upstream media, run `python3 scripts/bible-audio/fetch-metadata.py /path/to/cache` (Python standard library plus ffprobe). Review changes before copying its `hays-metadata.json` into `scripts/bible-audio/`.
3. From the Heritage repository root, run `BSB_ALIGNMENT_DIR=/path/to/bsb-align node scripts/bible-audio/generate.mjs`.
4. This writes the Bible catalog, combined native/web audio catalog, per-book timing files and `timing-audit.json` with source/text hashes. `scripts/generateAudioCatalog.mjs` preserves the generated Bible catalog when refreshing LibriVox metadata.

## Reproduce complete-text alignment

`scripts/bible-audio/export-reference.mjs` exports all 31,102 displayed verses
and the pinned recording identities. `align-full-text.py` runs separately on a
CUDA worker against that complete text. It does **not** install timings in the
app or edit Bible wording. The separate importer validates the whole batch before
writing accepted timing data and catalog coverage.

```sh
node scripts/bible-audio/export-reference.mjs /outside-repo/reference.json
# On the worker: ffmpeg, NumPy 2.2.6, and official PyTorch/TorchAudio 2.8 CUDA wheels.
python scripts/bible-audio/align-full-text.py \
  --reference /outside-repo/reference.json \
  --work /outside-repo/media --output /outside-repo/timings \
  --stop-file /outside-repo/STOP
python -m unittest discover -s scripts/bible-audio -p 'test_*.py'
python scripts/bible-audio/import-full-text.py \
  --candidates /outside-repo/timings --reference /outside-repo/reference.json
# After reviewing the batch and independent samples, repeat with --install.
```

The model is [Meta MMS](https://github.com/facebookresearch/fairseq/tree/main/examples/mms),
whose weights carry **CC-BY-NC 4.0**; no weights or audio are distributed in the
repository or APK. The pipeline uses the official
[TorchAudio forced-alignment API](https://docs.pytorch.org/audio/2.8/tutorials/forced_alignment_for_multilingual_data_tutorial.html),
pinned to 2.8 because that API is removed in 2.9. Model, pipeline, reference,
recording header and full recording hashes are retained with every result.
Thirty-second windows with one-second context bound GPU memory. Convolution
frame centers are mapped back to source time, and discontinuous frames fail.

This is an automatic candidate generator. It rejects changed recording identity,
out-of-bounds/overlapping spans, implausible durations, low average or boundary
scores, and verses with numeric tokens whose spoken form has not been reviewed.
Numbers are not removed from the canonical text. Validated caches can resume;
a changed reference/model requires a new output directory. A STOP file stops
between recordings without touching the current app data.

The first 1,174 chapters retain the original pipeline hash. A compatible fix
handles empty BSB verse entries without consuming an audio token, allowing the
remaining 15 chapters to complete. Existing candidates are re-assessed and retain
their original provenance; they are not relabelled as regenerated output. All
other changes to model/reference/inference require new results.

## Acceptance

- 284 unit tests and 125 protocol tests passed, including all imported spans against displayed Bible text, media duration, track identity, gaps, changed text and translation boundaries.
- Five real-media-element browser tests passed in Chromium and Firefox using local WAV fixtures. These cover resume/navigation, marker/following, unchanged annotation storage, failed timing fetch, library chapters and narrow layout.
- Real public BSB Romans 1 streaming/seek passed in Chromium and Firefox: position advanced after seeking, the gray marker reached verse 26, and narrow layouts had no overflow or page errors. Playback was muted during this smoke test; this is not an auditory timing review.
- Android app and instrumentation packages compile; the car-library test now checks the 66-book Bible root, Romans queue and pinned recording URL. Packaged emulator acceptance and real public-media smoke results are recorded in the integration delivery record.
- Browser fixtures prove UI behavior, not that automatic timings match the spoken words. Physical Android Auto and device checks remain required.
