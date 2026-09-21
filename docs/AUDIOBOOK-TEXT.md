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
Some recordings use a different English translation. For example, the selected
Polycarp recording has far fewer literal matches to the bundled text than Justin
Martyr's First Apology. The interface explicitly allows wording differences and
does not invent corresponding words. No speculative interpolation fills long
unmatched intervals. Maximus currently links to an external source rather than
bundled book text, so it has no internal paragraph destinations.

The index in `src/data/audiobookTextIndex.json` records exactly which books have
installed data. Each `public/data/audio/books` file records its actual track IDs,
recording URLs/byte counts/full SHA-256 hashes, model file hashes, source text
hash, accepted spans and exact reference paragraphs. Only installed data is used;
partially generated local files outside the repository do not affect the app.

The installed set covers 195 recordings in seven books. Accepted phrase
spans cover about 87.3% of City of God, 82.8% of The Wars of the Jews, 80.7% of Confessions, 86.6% of
Enchiridion, 80.4% of First Apology, 8.7% of Martyrdom of Polycarp and 2.0% of Tertullian's Apology by recording
duration. Those percentages measure matched time, not independently measured
accuracy. The two sparse books use different wording from the bundled text;
most timestamps in them correctly fall back to plain book navigation. Longer
Josephus Antiquities and Institutes recordings are still being processed.

Validation includes 275 reader unit tests, 124 protocol tests, five Python
matcher cases, and five audio/navigation browser checks each in Chromium and
Firefox. The expanded seven-book data also passes exact recording and paragraph
integrity checks. Physical Android and car testing remain separate.

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
