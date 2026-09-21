# Monochrome / colorblind authoring

Prepare a sermon and Plan a service have a local display toggle in the left sidebar. The choice is remembered on that browser/device, separately from the service document. It never changes a saved color, compiled slide, audience output, or undo history.

The color chooser shows named colors and matching patterns. Existing custom colors retain their exact hex value and use the nearest hue family's pattern; the sidebar includes both the family name and exact value. Filled shapes use pattern fills, thin outlines use distinct dash samples, and colored text stays black with a patterned underline. Highlights use a lighter pattern behind the words. Images become grayscale. The reference lists colors used by the selected item, including its other output variants.

The normal color view remains available at any time. Choosing a color in either view saves the ordinary color value. Patterns are display aids, not additions to the presentation format.

## Verification

The browser rehearsal in `tests/browser/verify-canvas.mjs` checks Chromium and Firefox: view toggling without a dirty document, formatting with a named pattern, restoration of the actual color, undo, save/reopen, exact preservation of canonical project items, persistence of the local preference, and existing compact editing/output workflows. The production Next build and TypeScript validation pass. Pure palette tests run in Community CI.

Actual e-ink refresh, stylus behavior and legibility on reMarkable/BOOX hardware still need device acceptance. Patterned text can require zooming on very small screens. A photographed or imported raster image is grayscale here; its internal colors are not semantic slide objects.
