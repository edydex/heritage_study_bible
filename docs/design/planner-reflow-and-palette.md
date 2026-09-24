# Passage reflow and Add Slide workspace

Implemented the library workspace (concept A in `add-slide-concepts.html`). Categories, choices and an output preview replace the former bottom-pane layout. Sermon cards use the existing slide renderer and presets, with an original sample illustration for the title. Sample content never enters the saved service. Opening Add Slide within a sermon selects Sermon automatically; ordinary Scripture remains a separate reading section.

Committing a Scripture font size repaginates that passage using the shared output font metrics. Whole verses move backward or forward, both output languages keep matching boundaries, and the complete change is one Undo operation. “Reflow pages” also applies the current size to existing saved page breaks. Reading titles and ending blanks survive; unrelated sermon references remain independent.

Authored display-text excerpts retain their page boundaries. Reflow preserves source formatting spans and stops at page-specific translation cues, durations, notes or incompatible styling/editions. No saved service is rewritten merely by opening it.

Validation: TypeScript check, 82 focused planner/presentation tests, Vite browser rehearsal of preset previews, template insertion and Undo, and tablet-width layout. Deployment/live verification is recorded in the task response.
