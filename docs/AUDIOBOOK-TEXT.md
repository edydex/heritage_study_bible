# Navigate from an audiobook to its text

Expand the internal player and choose **Go to nearby text**. It opens the book at
a checked paragraph near the playback timestamp, scrolls it into view, and adds
a temporary gray marker. This does not create a highlight or note and does not
start playback. The link contains the recording identity and timestamp so it
can recover after a browser reload. It never copies a transcript over the book.

The control remains **Open book text** when no nearby match is available, during
narrator introductions or long unmatched passages, and after a timing-load
failure. Audio playback and saved position are independent of timing data.

## What the match means

The offline generator runs local Whisper, then requires exact seven-word phrases
that occur only once in the book's parsed paragraphs. It rejects low-confidence
speech, invalid/out-of-recording timestamps, ambiguous phrases and competing
overlapping destinations. At playback time, navigation can select a checked
phrase at most 20 seconds away. The reader verifies the exact current paragraph
before focusing it; a changed text cannot silently redirect to an old location.

These are automatic **paragraph** matches, not word-perfect synchronization.
The audio player opens the named text edition that matches each recording.
Polycarp uses Kirsopp Lake (1912); Tertullian uses Charles Dodgson (1842).
The Institutes audio text combines both printed volumes of John Allen’s
translation; the previous file contained only volume one. The earlier reading
editions remain available through an edition link, with
separate book IDs so existing reading positions and bookmarks are preserved.
Recording IDs, downloaded audio and listening progress do not change. Reloadable
links and fallback **Open book text** both use the recording's text edition.
The public-domain historical texts are imported from the source URLs recorded in
`public/data/books/audio-editions-sources.json`; no AI translation is used.
Scholarly notes remain available at the original source link.

No speculative interpolation fills long unmatched intervals. Maximus currently
links to an external source rather than bundled book text, so it has no internal
paragraph destinations.

The index in `src/data/audiobookTextIndex.json` records exactly which books have
installed data. Each `public/data/audio/books` file records its actual track IDs,
recording URLs/byte counts/full SHA-256 hashes, model file hashes, source text
hash, accepted spans and exact reference paragraphs. Only installed data is used;
partially generated local files outside the repository do not affect the app.

The installed set covers 383 recordings in nine books. Accepted phrase spans
cover approximately 87.3% of City of God, 82.8% of Wars, 82.6% of Antiquities,
92.1% of Institutes, 80.7% of Confessions, 86.6% of Enchiridion, 80.4% of First Apology, 81.4% of
Martyrdom of Polycarp and 81.8% of Tertullian’s Apology by recording duration.
Those percentages measure matched time, not independently measured accuracy.
All catalog recordings with bundled reading text have completed generation.

Validation includes reader unit/protocol tests, five Python matcher cases,
Chromium and Firefox audio/navigation flows, and exact recording/paragraph
integrity checks for every installed destination. Edition-specific checks prove
reload navigation, preserved original bookmarks, and separate bookmarks in the
recording edition. Physical Android and car testing remain separate.

## Reproduce or extend coverage

On an Apple-silicon Mac with Python and ffmpeg, install the pinned package into an
isolated virtual environment:

```sh
python3 -m venv /path/to/audio-venv
/path/to/audio-venv/bin/pip install -r scripts/audiobook-alignment/requirements.txt
```

Use a local MLX Whisper model folder. The initial pass uses
[MLX Whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper) and the
[converted Whisper base model](https://huggingface.co/mlx-community/whisper-base-mlx)
at revision `1e3e249fb8d01c655324bd6841b1deadffd6d04c`. Model hashes and the engine
version are recorded in generated output. From the repository root:

```sh
/path/to/audio-venv/bin/python scripts/audiobook-alignment/generate.py \
  --work /private/work/audiobook-alignment \
  --output /private/work/audiobook-alignment/generated \
  --model /path/to/local/whisper-base-model
python3 scripts/audiobook-alignment/test_match.py
```

Add `--book <resource-id>` to process one book. The reference exporter uses the
reader's own chapter parser. Media and raw transcripts stay in the work folder;
source downloads must match the catalog byte count. Successful temporary MP3s
are deleted by default, while transcripts allow resumable generation without
repeating recognition. Existing transcripts must match the exact recording and
model. Failures are listed in the private work folder's `errors.json` and do not
become successful matches. No paid API is used.

After review, verify that each completed book contains exactly the track IDs in
all its catalog editions, then copy its JSON into `public/data/audio/books` and
merge only that book's entry into `src/data/audiobookTextIndex.json`. The staged
index updates after each track and can include incomplete books; never copy the
whole staged index while generation is running. Run the data-integrity and
navigation tests. Rebuild/review the timings whenever source text or its chapter
parser changes. Do not commit downloaded audio, raw transcripts, caches or API
credentials. Word-perfect timing and human listening verification are separate
from this automatic navigation feature.

## NVIDIA GPU worker

A Linux/NVIDIA worker can use the same reference paragraphs and conservative
matcher through [faster-whisper](https://github.com/SYSTRAN/faster-whisper). Install
`requirements-cuda.txt` in a separate virtual environment and configure its CUDA
12/cuDNN 9 library paths as described by that project. Export the reference with
`node scripts/audiobook-alignment/export-reference.mjs /work/reference.json` on
the reader checkout; transfer that file, `src/data/audioCatalog.json`,
`generate.py` and `match.py` to the worker. No credentials or private application
configuration are needed.

Download a pinned CTranslate2-format Whisper model into a local folder, then run:

```sh
/path/to/gpu-venv/bin/python generate.py \
  --engine faster-whisper --model /work/model \
  --work /work/cuda-transcripts --output /work/generated \
  --reference /work/reference.json --catalog /work/audioCatalog.json \
  --book city-of-god --book josephus-antiquities --book institutes \
  --stop-file /work/STOP
```

Use a separate transcript directory for each engine/model configuration. GPU
output records model hashes, engine/runtime versions and decoding settings; it
does not reuse or relabel MLX transcripts. Creating the stop file lets the current
recording finish before exiting. Remove it deliberately before resuming. Retrieve
completed data and run the exact reader/catalog tests on the source checkout
before installing it. The GPU worker is optional development tooling, not a
server dependency of the reader or audio player.

## Matching a corrected text edition

Download the two historical HTML sources listed in
`public/data/books/audio-editions-sources.json` into a separate folder as
`polycarp-lake.html` and `tertullian-dodgson.html`, then run
`node scripts/import-audiobook-editions.mjs /work/html`. The importer checks chapter
counts and records full source/output hashes. Regenerate the audio catalog when
changing its `textBookId` mapping. Existing recording IDs remain unchanged.

Export references again, then reuse the retained original Whisper output without
running recognition or downloading audio again:

```sh
node scripts/audiobook-alignment/export-reference.mjs /work/reference.json
python3 scripts/audiobook-alignment/rematch.py \
  --work /work/original-transcripts --reference /work/reference.json \
  --output /work/rematched \
  --book martyrdom-of-polycarp --book tertullian-apology
```

Re-matching verifies source recording identity and preserves original model and
audio hashes. It writes only complete books and rejects mixed model provenance.
Review the output and run the same integrity/navigation checks before installing.

The complete Institutes text is reproducible with
`node scripts/import-institutes-complete.mjs /work/institutes-volume-2.txt`.
The existing volume-one bytes are retained; volume two comes from Gutenberg
64392. Its manifest records both source hashes. The combined reading edition
contains all 80 chapters of Books I–IV; it omits front matter and scholarly
footnotes (available at the sources), never rewrites the main text, and uses a
new book ID to preserve older volume-one bookmarks. Rematch the existing GPU
transcripts with `--book institutes`; `--catalog` allows this on a separate
compute machine without copying the reader repository.
