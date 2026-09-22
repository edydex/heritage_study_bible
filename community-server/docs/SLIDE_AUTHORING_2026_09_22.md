# Slide authoring: September 22

The shared service compiler now assigns one body font size across each song and each paginated reading. It measures the Noto Sans font bundled with SyncShow; the browser loads that same font. This removes independent per-page shrinking. Regular readings use an 85 px starting size at 1920×1080, matching the reference deck's 32 pt text. New passages are paginated using measured line width; existing slide boundaries and edits are preserved.

Songs try to preserve authored line breaks using the smallest necessary reduction, bounded to 25%. One size applies to both audience languages and every lyric cue. Managers can change the size/alignment and use **Remember for this song** to store library defaults for future additions. Edits to existing service copies stay independent. Exceptionally large pieces may still require an operator to split the text; the native renderer continues to report overflow rather than silently clip it.

Text, headings and credits have alignment controls beside the slide. New Welcome copies start with their topic left aligned. Reading titles can switch between the centered style and **Pre-sermon**, based on slide 42 of the supplied September 20 deck: separate, movable passage reference, edition and topic fields. Quote slides inherit the preceding sermon heading; the optional author/source field stays below the quotation. Font inputs commit complete typed values on blur/Enter.

**Add slide** in the left pane opens the selection palette in the main panel. Choosing a type returns to the editor. Move/delete dialogs remain available while the palette is closed. The permanent bottom palette is removed.

## Validation

- Shared source round-trip tests cover uniform song/reading size, minimal reduction, explicit size/alignment, quotation context, and reversible pre-sermon templates.
- Endpoint tests cover manager access, church scoping, missing songs and invalid style values.
- Native raster and browser-scene validators cover font size and alignments, including title/credit placement; renderer version 15 invalidates newly prepared output caches while existing packages remain readable.
- Browser rehearsal covers the palette, hidden title → inherited quote heading, quote/source placement, typed font size, alignment and pre-sermon reading with a nonsequential reference.

For LSB/NASB lookup findings and the unresolved API activation requirements, see [Bible passage sources](BIBLE_PASSAGE_SOURCES.md).

## Real service check

Compiled the church's saved September 20 service (51 slides) and rendered all 78 English/Russian song and Scripture outputs at 1920×1080 with SyncShow. “Мы славим Тебя” requires size 82 to preserve its longest authored line; that size applies to the entire song. Reading pages use 85, sermon Scripture 78. These values are logical pixels at 1920×1080, not PowerPoint points. Private service source and renderings are excluded from the repository.
