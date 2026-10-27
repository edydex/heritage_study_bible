# Song language choices

In a song's Edit view or Slide settings, choose **Both languages**, **English only**, or **Russian only** for the whole song. Both audience outputs use that choice. The stage screen's **Current + next** view follows the singing language.

These are presentation choices. They retain both exact pinned lyric documents, title-translation visibility, and individual slide primary-language choices. Switching back to Both restores those choices. The old audience routing dropdowns replaced direct content and could prune a translation; they are no longer exposed. Existing history remains unchanged.

Edit both lyric fields directly. Blank lines separate slides; verse and chorus labels remain optional. There is no section-matching proposal or second lyric editor.

Compatibility: SyncShow Preview 39 preserves and compiles the added `songPresentation.audienceLanguage` field. Older apps may discard that preference when normalizing a source document. Deploy the Community change alongside the desktop update.

Validation: editor tests cover source/revision retention, Both → English → Russian → Both after serialization, stage output, per-slide choices, and editing a solo slide through the other audience output. Native tests compile and rasterize all three outputs. Local Payload browser rehearsal confirms a reviewed song save/reopen, repeat arrangement, and service save/reopen.
