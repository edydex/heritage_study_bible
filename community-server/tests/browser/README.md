# Sermon canvas browser rehearsal

From the repository root, install the reader and Community dependencies, then run:

```sh
npx vite build --config community-server/tests/browser/vite.config.mjs
npx vite preview --config community-server/tests/browser/vite.config.mjs
# In another terminal:
node community-server/tests/browser/verify-canvas.mjs
```

Uses the actual planner components and styles, with an isolated in-memory Community API. Chrome and Firefox check editing, selection highlights, objects, pointer movement/resizing, output selection, and canonical save/reopen. No church records are changed. Evidence goes to `test-results/canvas-editor`. `CANVAS_TEST_BUILD` and `CANVAS_TEST_EVIDENCE` optionally override output locations. The harness strips SCSS line comments when loading the otherwise plain CSS; the production build compiles the original stylesheet normally.

Set `PLANNER_QOL=1` to rehearse the Prepare Sermon workspace: compact header and side inspector, right-click slide settings, song previews, ambiguous passage shortcuts, and Ctrl/Command+Z with native text undo preserved. `CANVAS_TEST_ORIGIN` overrides the preview server URL when using a different port.
