# Passage reflow and Add Slide workspace

The library workspace (concept A in `add-slide-concepts.html`) replaces the former bottom pane. Sermon cards use the actual slide renderer and presets, with an original sample illustration for the title. Cards add a template directly; the passage card opens Scripture entry. There is no duplicate layout-preview column. Songs keep their useful first-section preview. Opening Add Slide within a sermon selects Sermon automatically; ordinary Scripture remains a separate reading section.

Valid Scripture font sizes repaginate immediately while typing. Empty and intermediate input remains editable, and all changes during one focused edit share a single Undo step. Reflow starts from the beginning of the edit so intermediate sizes do not accumulate page or cue changes. Whole verses move backward or forward using shared font metrics, and both output languages keep matching boundaries. “Reflow pages” also applies the current size to existing saved page breaks.

New slides insert after the whole selected passage, never inside its pagination wrapper. Sermon passages do not create automatic blanks; ordinary service readings and songs retain theirs. Opening a legacy malformed wrapper lifts unrelated inserted slides to sibling positions, preserving the saved slide order and content.

A passage's pagination wrapper has no separate row in the outline. Its first numbered slide is the parent of any later pages, with a small page-count label. A single-page passage looks ordinary. Clicking the first page selects the passage; Ctrl/Command-click selects that page alone. Deleting a complete passage also removes its internal wrapper. Reading titles and ending blanks survive reflow; unrelated sermon references remain independent.

Authored display-text excerpts retain their page boundaries. Reflow preserves source formatting spans and stops at page-specific translation cues, durations, notes or incompatible styling/editions. No saved service is rewritten merely by opening it.

Validation includes TypeScript, focused planner/presentation tests, and browser rehearsal of typing without Enter, single-step Undo, preset insertion, section selection, and compact template layout. Deployment/live verification is recorded in the task response.

## Sermon language context

`SermonContext.js` resolves each output's preceding sermon title and outline independently. This authored-language view is shared by the editor and compiler. Missing or incomplete sermon outputs borrow a complete language only in compiled display blocks, with `fallbackFromChannelId` producing the editor warning. An inherited heading alone does not make an otherwise empty point or quotation complete.

Progressive outlines use numbered point/sub-point keys. `sermonInheritance` records which preceding rows and heading remain linked; it contains no translated words. Links are captured before editing an earlier slide, including legacy copied outlines. Editing or removing an inherited row on a later slide makes that row local. Formatting spans follow the resolved words, and save/reopen retains the links. Both English-first and Russian-first authoring are covered. A new sermon title or ordinary song/reading ends the preceding context.

Outline list labels show the last populated outline row. Canvas body placement is measured below the rendered heading at every size, including explicit reading font sizes; multiline headings no longer overlap Scripture. The song collection has a prominent, labelled search connected to Payload's existing server-side pagination/filter query.
