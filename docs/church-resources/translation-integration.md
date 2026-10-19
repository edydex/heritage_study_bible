# Translation integration outline

2026-09-12 · Design for the first integrated version; not an implemented API contract.

Product decisions live in [the shared brief](../../CHURCH_RESOURCES.md). Extend the existing Multilinguum contracts rather than implementing a second translation engine in Heritage or SyncShow.

## Session and ownership

Community authorizes the operator, manages church/service associations and publication, and discovers the processor. The processor is the authority for active capture, provider work, and effective live settings. Store saved service defaults in Community; command acknowledgments and reconnect snapshots come from the processor.

A session needs Community ID, service-document ID/revision when present, optional sermon ID, session ID, source language, target languages, effective processing profile, audio-generation state, and a monotonic settings revision. A standalone browser-started session may initially have no prepared service; it still belongs to the Community and can be associated with a sermon later.

Use a server-enforced active-session lock per Community and one capture lease. Both controllers must attach to an existing session by default. Start/update/stop commands have idempotency keys and an expected settings revision. A retry or stale tab cannot double-start providers or overwrite newer settings silently. No automatic microphone transfer between controllers.

Keep source language explicit. A speaker-language change closes the current recognition interval and advances an interval ID so delayed events cannot be mistaken for the new speaker's direction. Switching source language must not silently enable a previously disabled paid target.

## Text, speech, and display are separate

Model the pipeline as:

```text
Capture → shared source transcription → translated clauses → caption subscribers
                                                        └→ optional speech → audio listeners
```

Screen layout (`hidden`, `full-screen`, `lower-third`, `ticker`) is per output, not a provider mode. The same caption stream can appear differently on each display. Stage-facing treatment is configured independently. Audio-only use hides projected captions while retaining translated text internally and allowing phone captions.

Add an explicit speech-enabled setting. Multilinguum's existing `muted` flag cannot implement it: `SessionEngine.#processChannel()` returns before translation for a muted channel, while translated final captions are otherwise emitted through `#enqueueSpeech()` after rendering. The existing direct realtime adapter also starts a speech-to-speech provider; merely dropping its audio would not meet voice-off requirements.

For text-only operation, select the transcription→text-translation path, publish finalized clauses immediately, and bypass speech rendering, speech archiving, and audio publication. A failed speech renderer must leave text healthy. The text path needs no LiveKit connection. The existing broadcast relay already carries transcript events without an audio relay, but it must not claim successful audible playback when no audio relay exists.

A transition to speech-off establishes a generation number, cancels supported outstanding requests, drops unplayed speech, stops direct speech sessions if active, and rejects late audio from the old generation. Transitioning on starts at a new finalized clause. The current session configuration lock needs a narrow, validated update command for this behavior.

## Events and recovery

Reuse `TranscriptSegment` identity, session/channel/language, sequence, revision, source timestamps, and final state. Extend explicitly where necessary; do not leak OpenAI or LiveKit event payloads into clients.

- Provisional text replaces the same segment, without duplicating words in the ticker. Projected text should default to stable finalized phrases.
- Final text publishes independently of speech. `playout` remains optional and applies to listeners following generated speech.
- Separate caption health, capture health, provider health, and speech health; voice failure must not label healthy captions as failed.
- A reconnect snapshot includes effective session settings, bounded recent finalized captions, current provisional segment, stream cursor, and server time. Resume events from that cursor, deduplicate by identity/revision, and reset on session/interval change.
- Distinguish idle, paused, ended, disconnected, and provider-error states. After a configurable stale threshold, stop moving stale text and show an operator alert. Hiding/clearing projector captions must not clear the server transcript or stop listeners.
- Treat provider text as text, never HTML or executable instructions. Bound paragraph/ticker queues and text size. Render source-faithful text; manuscript context is recognition/translation assistance, not permission to add unspoken content.

Archive source/translations only according to the selected retention policy. A manager reviews an archive before creating a published sermon resource. Personal sync records never become translation context implicitly.

## Integration points

| Codebase | First changes |
| --- | --- |
| Multilinguum | Extend protocol types/schemas; decouple text publication in `session-engine.ts`; gate direct speech sessions in `realtime-capture-pipeline.ts`; add effective-setting updates; separate stage/project configuration and cost accounting. |
| Multilinguum deployment | Make `voice-worker` an opt-in Compose profile; remove processor startup dependency for text/cloud voice; make voice-worker preflight/credentials conditional; retain independent archive storage. |
| Heritage Community | Advertise a live-translation capability; add scoped operator control/capture authorization, listener state/stream routes, `/translate`, and a compatible `/live` alias. Reuse existing manager roles and device authorization rather than a browser-wide master processor token. |
| Heritage Bible | Add a discoverable live-translation entry in the selected Community, reuse the caption listener behavior, and preserve reading position when entering/leaving it. Accounts are only required when the church's audience policy requires them. |
| SyncShow | Add a translation client behind the main-process boundary, narrow renderer IPC, saved service translation settings, live overrides, and per-output caption composition. Preserve pinned ShowPackages and independent output clearing. |

Default public live listening follows Multilinguum's current anonymous-listener model; private church services require authorization before stream/token issuance. No provider API key, processor master token, sermon draft, or private note belongs in the public listener. Community management sessions and read-only listener sessions have separate permissions.

Serve listener assets/API relative to the Community base path, instead of copying the current root-absolute `/api/public/*` assumptions into `/translate`. WebSocket upgrade forwarding and reconnect must be exercised through the real proxy. Use compatible CSP and microphone permissions on the authenticated capture page; public listeners need no microphone access.

## Focused acceptance

1. Translate authorized EN and RU samples with speech and GPU adapters unavailable; captions still arrive, and speech/relay spies record zero calls.
2. Start from Community, attach SyncShow, and attempt a second Start; one active session and capture lease remain.
3. Read the same finalized clauses on two listeners, a lower third, a full-screen feed, and a ticker. No model request is created per listener.
4. Turn speech on, then off during a pending render. Text stays continuous, no old audio publishes afterward, and enabling again starts at the current phrase.
5. Disconnect/reconnect a listener and controller. Revisions remain ordered and no prior-service text reappears. Disconnect internet during Show; loaded presentation cues remain operable.
6. Inspect real project usage for both processing profiles. Keep transcription, text, speech, and transport charges distinct; never equate a local estimate with an account-wide free allowance.

These are acceptance requirements for future implementation, not results of this audit.
