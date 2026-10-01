# Song language choices

In a song's Edit view or Slide settings, choose **Both languages**, **English only**, or **Russian only** for the whole song. Both audience outputs use that choice. The stage screen's **Current + next** view follows the singing language.

These are presentation choices. They retain both exact pinned lyric documents, title-translation visibility, and individual slide primary-language choices. Switching back to Both restores those choices. The old audience routing dropdowns replaced direct content and could prune a translation; they are no longer exposed. Existing history remains unchanged.

The song editor offers **Match Russian sections** below English lyrics. Paste unlabelled English words and label the Russian verses/choruses first. The helper proposes matching slide breaks and repeat references when nonempty line counts match. It handles both unique lyrics and already-expanded identical repeats. It never translates or invents words. Different repeat words, ambiguous Russian labels, and incompatible line counts require manual editing.

The proposal remains separate from the English field until **Confirm sections**. Edit the preview to check semantic alignment. Changing either source disables confirmation until the suggestion is regenerated. Normal song Save publishes the confirmed draft according to its selected publication setting.

Compatibility: SyncShow Preview 39 preserves and compiles the added `songPresentation.audienceLanguage` field. Older apps may discard that preference when normalizing a source document. Deploy the Community change alongside the desktop update.

Validation: editor tests cover source/revision retention, Both → English → Russian → Both after serialization, stage output, per-slide choices, and editing a solo slide through the other audience output. Native tests compile and rasterize all three outputs. Local Payload browser rehearsal confirms a reviewed song save/reopen, repeat arrangement, and service save/reopen.
