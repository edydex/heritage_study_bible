# Installed translations

The English reader choices are BSB, KJV and LSV. WEB is no longer an installed
translation or a web/APK asset. Existing saved WEB selections fall back to BSB;
existing annotations are retained with their original translation identity.

`scripts/bible-sources/WEB.json` is an archival public-domain generator input,
outside the app bundle. It keeps existing chronological-plan counts and Psalm
headings reproducible. The translation converter no longer emits WEB assets.
Regenerating the plan after moving this input preserves every reading and count;
only its provenance wording changes.

BSB uses the existing Verse Stacking setting (enabled by default), which flows
verses together into paragraphs. LSV keeps each verse on a separate line even
when that setting is enabled. The current LSV source has no within-chapter
paragraph divisions; separate verse lines avoid a chapter-length block without
adding editorial paragraphs or changing translation text.
