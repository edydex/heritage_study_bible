# Service preparation and translation cues

Readings added from Scripture have one numbered title slide, followed by their verse pages. The next song belongs beside the reading. New songs and readings receive a removable blank afterward; Media also offers Blank. Page splitting uses text lines, with a twelve-verse safety ceiling. The internal BSB source note is omitted; imported editions retain their credit.

Song imports understand split verses, distinct refrains, repeat counts, and named section recalls. Repeats become consecutive slides. Existing service copies keep their edited lyrics: re-add a library song to use its newly parsed arrangement. Old generated reading wrappers are flattened when a service is opened; already split pages are not recombined automatically.

Media can save a single slide for reuse. Mark it “Start every new service with this slide” to prepend it to new services. Each insertion is an independent editable copy. A Welcome canvas with the text object `welcome-topic` also gets a topic field below its preview. English, Russian and Stage-facing artwork are preserved independently.

## Automatic translation

1. Open the service’s Translation settings. Choose language, recognition provider, quality, optional sermon notes, and translated phone audio. Save. Economy note sharing is an explicit choice for that service and those selected notes.
2. Right-click a numbered slide in the left outline and add a Start Translate cue. After a Start, the action offers Stop Translate. Cue badges identify both; the menu can remove them. Cue-only edits retain reviewed translation settings; changing service content requires review again.
3. Load the saved service in SyncShow Preview 33 or later. Once per venue/Community connection, open Translation controls and select a named mixer, USB, line-in or virtual audio input. A missing saved input produces an error and never falls back to the system default.
4. Configure each SyncShow output’s existing ticker, full-screen/paragraph, lower-third or hidden translation mode. Phone audio follows the saved service setting.
5. Start Show. The slide immediately before Start prepares the audio input and processor connection without submitting audio. Start begins transmission; Stop stops the owned session. Jumping ahead or backward derives the required state from the destination slide. Ending Show stops translation. Closing SyncShow waits briefly for a server Stop acknowledgement and reports an unconfirmed stop.

The server, network, selected input and provider credentials must be available for translation. Ordinary prepared slides retain offline operation. An external mixer/cable has not been physically tested by automated checks. Translation settings and cues do not start a show by themselves.

## Community read-along books

Create a book in Community administration and choose Members or Public visibility. Save it, then use the read-along folder upload to select a folder with the `heritage-private-audiobook/v1` manifest, chapter MP3s and word-timing JSON. Uploading all audio succeeds before the new text/timing attachment replaces the old one. Audio files and data are checksum matched.

The Heritage book reader follows the current recording position, highlights the timed word, seeks when a paragraph is tapped, resumes the last chapter/position, and offers player controls by holding Play/Pause. Private books require current Community membership for text and audio requests and an online connection; they are not copied into public assets or offline downloads. The read-along book player currently runs inside the reader, without native Android background playback or Android Auto integration.

## Validation

Focused source/parser, reading hierarchy, cue-state, publication, credential-scope and real PostgreSQL member-access checks cover the new paths. Chromium and Firefox planner acceptance exercises Scripture, song insertion, separate EN/RU title images, right-click Start/Stop cues and save/reopen. Packaged desktop and Android acceptance are tracked by their release workflows. Venue audio hardware remains a user acceptance step.
