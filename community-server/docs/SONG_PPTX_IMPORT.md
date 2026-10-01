# Song PowerPoint import

In Song library → Add song (or an existing song), choose **Import PowerPoint**.
Select one `.pptx` containing a song, review the two language columns and authors,
then choose **Use these lyrics**. Save normally. Existing songs instead show
**Replace song fields**, with an explicit warning. Cancel leaves the form intact.
Both lyric review fields expand to show all text, resizing after edits and when
the columns change width. The English section suggestion uses the same behavior.

The file is read in the browser. No presentation, media, lyrics or credentials
are sent to an AI or third-party extraction service. Only the normal song Save
persists the reviewed text. Images, audio, video, speaker notes and slide styling
are not imported. This is a text import, not a PowerPoint layout conversion.

The importer follows presentation relationships (not slide filename order),
joins text runs, honors paragraph and manual line breaks, and orders separate
text shapes top-to-bottom/left-to-right. Cyrillic and Latin scripts separate the
Russian/English lanes even when they share a text box. A few Latin lookalikes
inside a predominantly Cyrillic word stay in the Russian lane without spelling
changes. Short ambiguous script fragments and other scripts require a language
choice or an explicit Skip. Footer/date/slide-number placeholders and hidden
shapes are omitted.

The first slide is suggested as a title slide when its text looks short enough;
the checkbox lets the user include it in lyrics instead. Recognized title-slide
credits populate authors. Every lyric slide gets a matching `^slide-N` marker in
each language. These markers are editing labels, not projected lyric words.
Recognized verse/chorus headings become structure rather than projected lyrics and are listed in the review. Repeated slides remain exact editable occurrences. Missing translations are
reported and keep their original IDs rather than shifting the next slide's
translation into the wrong place. Blank and picture-only slides are listed as
skipped. Image-only presentations show an actionable error; there is no OCR.

A Russian-only song has an empty English lyrics field. Since the current library
requires a main title, the original Russian title also supplies its library name,
with a notice in the review. Its address is transliterated automatically. Existing
addresses remain stable and manually chosen addresses take precedence.

Input limits: one song, 32 MB compressed, 200 slides, 2,000 ZIP entries,
2 MB per text XML part, 8 MB cumulative text XML. Both declared ZIP sizes and
actual decompression are bounded. XML declarations, unsafe paths and external
slide references are rejected. The browser never fetches relationship targets.

Validation:

- `npm run test:song-pptx` covers synthetic decks, multilingual runs/breaks,
  shape and presentation order, repeats, credits, missing translations, corrupt
  packages, image-only slides and size limits.
- Set `SONG_PPTX_SAMPLES_DIR` to a local sample directory to additionally check
  the 11 supplied church decks: 7 bilingual, 4 Russian-only, 88 lyric slides,
  exact source-lane lines and matching canonical language sections. The original
  song files and lyric contents are not committed as fixtures.
- Local Payload browser rehearsal: supplied bilingual and Russian-only files
  imported, saved privately and reopened; persisted lyric text and generated
  canonical documents checked against the extraction. No production song or
  service is created or changed for this rehearsal.
