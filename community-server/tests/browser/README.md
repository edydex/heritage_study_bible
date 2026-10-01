# Sermon canvas browser rehearsal

From the repository root, install the reader and Community dependencies, then run:

```sh
npx vite build --config community-server/tests/browser/vite.config.mjs
npx vite preview --config community-server/tests/browser/vite.config.mjs
# In another terminal:
node community-server/tests/browser/verify-canvas.mjs
```

Uses the actual planner components and styles, with an isolated in-memory Community API. Chrome and Firefox check editing, selection highlights, objects, pointer movement/resizing, output selection, and canonical save/reopen. No church records are changed. Evidence goes to `test-results/canvas-editor`. `CANVAS_TEST_BUILD` and `CANVAS_TEST_EVIDENCE` optionally override output locations. The harness strips SCSS line comments when loading the otherwise plain CSS; the production build compiles the original stylesheet normally.

Set `PLANNER_QOL=1` to rehearse the Prepare Sermon workspace: compact header and side inspector, right-click slide settings, visible bilingual song previews, ambiguous passage shortcuts, and Ctrl/Command+Z with native text undo preserved. `CANVAS_TEST_ORIGIN` overrides the preview server URL when using a different port.

For focused text regressions, run `CANVAS_TEST_ORIGIN=http://127.0.0.1:4199 node community-server/tests/browser/verify-slide-text.mjs`. This fixture checks idle commits, Escape cancellation, external replacement, and rapid edits across headings, outline rows, and canvas text objects.

For English/Russian passage rendering and next-slide hints, run `CANVAS_TEST_ORIGIN=http://127.0.0.1:4199 node --import tsx tests/browser/verify-authoring-languages.mjs` from `community-server`. Sample first/continuation pages and stage hint screenshots go to `EDITING_EVIDENCE` or `/private/tmp/heritage-authoring-language-evidence`.

For online save-conflict recovery, run `CANVAS_TEST_ORIGIN=http://127.0.0.1:4199 node --import tsx tests/browser/verify-save-conflict.mjs` from `community-server`. It uses an in-memory API to cover exact retry after lost responses, newer local typing, repeated remote writes, read-only history, explicit keep/discard, and Russian conflict UI. No church records are changed.

The canvas and service-reference rehearsals follow the default Slides overview, open the Add slide palette for each addition, and explicitly choose Edit for canvas operations. Canvas display preferences use the actual My account preference component and Payload preference provider inside the isolated `?preferences` fixture; mocked account preference requests survive reloads, and exact saved-source assertions verify patterns do not alter audience content. The workspace run also checks the selected-song English/Russian preview, exact Bible range/text/edition/source provenance, and compact native-text Ctrl/Command+Z.

For the Bible/song/media reference rehearsal in both Chromium and Firefox, run `CANVAS_TEST_ORIGIN=http://127.0.0.1:4199 node --import tsx tests/browser/verify-service-reference.mjs` from `community-server`. `SERVICE_REFERENCE_EVIDENCE` optionally overrides its screenshots and canonical saved-source output.

For the real built Payload sign-in page, run `WORKSPACE_LOGIN_TEST_ORIGIN=http://127.0.0.1:4280 node tests/browser/verify-workspace-login.mjs` from `community-server` after starting an isolated Community server. This read-only check verifies anonymous provider hydration, English/Russian invitation and password recovery guidance, separate reader sign-in, and the actual login form. It never submits credentials. The HTTP production-stack check separately verifies a successful, nonredirecting page with a client bootstrap.
