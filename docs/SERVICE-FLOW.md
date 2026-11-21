# Service preparation and translation cues

Readings added from Scripture have one numbered title slide, followed by their verse pages. The next song belongs beside the reading. New songs and readings receive a removable blank afterward; Media also offers Blank. Page splitting uses text lines, with a twelve-verse safety ceiling. The internal BSB source note is omitted; imported editions retain their credit.

Song imports understand split verses, distinct refrains, repeat counts, and named section recalls. Repeats become consecutive slides. Existing service copies keep their edited lyrics: re-add a library song to use its newly parsed arrangement. Old generated reading wrappers are flattened when a service is opened; already split pages are not recombined automatically.

Media can save a single slide for reuse. Mark it “Start every new service with this slide” to prepend it to new services. Each insertion is an independent editable copy. A Welcome canvas with the text object `welcome-topic` also gets a topic field below its preview. English, Russian and Stage-facing artwork are preserved independently.

## Automatic translation

1. Right-click a slide and choose Start Translate. The dialog saves the speaker language, optional translated voice, screen language and caption style. Right-click an existing cue to edit its settings. Subsequent slides offer Stop Translate. An active caption band is visible while planning the affected slides.
2. Captions occupy a full-width band at the bottom: 12% for a ticker or 29% for sentence captions. Slide content keeps its full width and uses the remaining height. Text keeps its preferred size when it fits, and reduces only as needed. Place images and objects inside the remaining area. Stage-facing content keeps its full layout.
3. Save the service and load that exact revision in SyncShow. Before Show, open Translation setup to choose a named mixer, USB, line-in, virtual audio device, or Computer audio. Input selection is scoped to the venue and Community connection. Computer audio captures all apps, including Safari; close or mute unrelated audio. Only audio is sent to the processor.
4. Grant any macOS audio recording permission and restart SyncShow if requested. Connect the input once to check its signal. A missing saved input produces an error and never falls back to the system-default microphone.
5. During Show, the slide before Start prepares the local input and processor without submitting audio. The Start slide begins transmission; Stop ends the owned session. Jumping ahead or backward derives the intended state from the destination slide. Ending Show stops translation. Closing SyncShow waits briefly for the server Stop acknowledgement and reports an unconfirmed stop.

The server, network, selected input and provider credentials must be available for translation. Prepared slides retain offline operation. Physical mixer routing remains a venue acceptance check. Saving settings or adding cues does not start translation.

## Community read-along books

Create a book in Community administration and choose Members or Public visibility. Save it, then use the read-along folder upload to select a folder with the `heritage-private-audiobook/v1` manifest, chapter MP3s and word-timing JSON. Uploading all audio succeeds before the new text/timing attachment replaces the old one. Audio files and data are checksum matched.

The Heritage book reader follows the current recording position, highlights the timed word, seeks when a paragraph is tapped, resumes the last chapter/position, and offers player controls by holding Play/Pause. Private books require current Community membership for text and audio requests and an online connection; they are not copied into public assets or offline downloads. The read-along book player currently runs inside the reader, without native Android background playback or Android Auto integration.

## Validation

Focused source/parser, reading hierarchy, cue-state, publication, credential-scope and real PostgreSQL member-access checks cover the new paths. Chromium and Firefox planner acceptance exercises Scripture, song insertion, separate EN/RU title images, right-click Start/Stop cues and save/reopen. Packaged desktop and Android acceptance are tracked by their release workflows. Venue audio hardware remains a user acceptance step.
