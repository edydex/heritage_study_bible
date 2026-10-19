# Heritage church resources

The shared implementation workspace now lives in [heritage-community](https://github.com/edydex/heritage-community), with pinned component revisions and current delivery status. This document preserves the initial product brief.

Product brief · 2026-09-12 · Proposed architecture, with the user's confirmed requirements below.

Heritage should be the congregation's home for Bible reading, church songs, passage-linked sermon material, live translation, and personal reading continuity. A church prepares its material once, presents it in SyncShow, and makes the appropriate resources available in Heritage.

This brief is the shared starting point for work across Heritage, SyncShow, and Multilinguum. It defines the intended experience; it does not claim that the integration is finished. See the [current audit](docs/church-resources/2026-09-12-audit.md) for what was actually inspected.

## Confirmed requirements

- English → Russian and Russian → English are both first-version requirements.
- A manager can start translation from either SyncShow or Heritage Community, including a service presented without SyncShow.
- Translation supports a full-screen text feed, a lower third, and a horizontal ticker. Church displays do not need a pulpit camera feed.
- Translated speech is optional. Turning it off stops speech generation while captions continue.
- Users can choose a quality profile or an economy profile using eligible OpenAI shared-data usage.
- Songs and sermon preparation are available through both SyncShow and Community administration.
- Heritage Communities support personal notes and reading-progress synchronization across devices.

## One product, clear responsibilities

| Component | Responsibility |
| --- | --- |
| Heritage Bible | Read, study, open this church's resources, follow a service, read/listen to translation, keep personal notes and progress. |
| Heritage Community | Own church resources, service documents, publication decisions, permissions, personal-sync accounts, and access to live sessions. Provide the browser preparation/control surface. |
| SyncShow | Prepare locally or through Community, download a complete service, and operate physical screens with `Prepare → Load → Show`. Control the shared translation session. |
| Multilinguum | Capture/receive audio, transcribe, translate, optionally generate speech, stream captions/audio, and retain configured transcript/archive records. |

Keep static public Content Servers distinct from authenticated Communities. A reader may use public resources without a sync account, and a personal sync account does not automatically confer church membership. Personal notes are distinct from published church commentary and sermon notes.

Community owns saved church content. SyncShow and the Community admin edit the same versioned service document, songs, and sermon records. Offline SyncShow edits remain local until reconciled; concurrent edits require visible conflict handling. A loaded ShowPackage pins the content revision for the service. Subsequent edits do not silently change a running show.

The translation processor owns active capture and translation execution. Community authorizes controllers and publishes the session's availability. Both controllers read the same acknowledged processor state; opening a second controller must not create another paid session.

## The experience

Before Sunday, a preparer creates a service in Community or SyncShow, chooses songs and their approved translations, adds sermon notes and canonical Bible readings, and chooses the translation direction and display treatment. Translation context can use the selected sermon outline and a church glossary. It must not invent missing speech from the outline.

At church, the operator loads the service, checks the screens and mixer input, and starts Show. Starting the sermon can offer a translation cue. The operator has separate controls for **Translation**, **Screen text**, and **Translated voice**. Screen text can be hidden while people continue listening on phones. Turning voice off leaves the text stream running. Stopping translation stops new provider work.

A person opens their church in Heritage and sees **This service**, **Sermons**, **Songs**, and **Live translation**. Passage-linked sermon material also appears beside Bible reading. The same public listener is available at the church's `/translate` address. If there is no service, it says so; if the connection is interrupted, it distinguishes that from a quiet speaker.

After the service, a manager may attach a transcript and recording to the sermon, review them, and publish them. A live AI translation does not automatically become approved church commentary. Manuscript, projected notes, primary reading, mentioned passages, and recordings remain distinct parts of the sermon.

## Translation behavior

Use one source transcription and an ordered translated-text stream per target language. Feed those results to screens, Heritage, and the optional speech renderer. Each listener subscribes to the existing stream; listener count must not multiply model calls.

- **Full-screen feed:** a few readable paragraphs on an opaque background, older text subdued, newest complete phrase prominent. No camera is required.
- **Lower third:** two or three stable caption lines below the current sermon visual, with a reserved safe area so text never covers Bible verses or sermon points.
- **Ticker:** a single moving line with adjustable speed and a bounded queue. Keep a nonmoving caption alternative for readability and reduced-motion use.
- **Screen text off:** presentation cues continue, and listener text/audio can remain available.

Use separate text timing and audio timing. Projectors should show a finalized translation as soon as it is ready. A phone playing speech may follow that speech's timing. Neither screen captions nor transcript retention should wait for speech rendering to succeed.

Voice is a processing switch, separate from an individual listener's mute button. A live switch to voice-off cancels pending speech work where supported, clears pending playout, prevents additional speech requests, and continues text. Already incurred provider charges cannot be undone. Re-enabling voice begins at the current phrase and must not read out an old backlog. Audio-only use still creates translated text internally.

Start with an explicit source-language choice per sermon or speaker interval. Both directions need acceptance coverage. Automatic handling of rapid bilingual code-switching is a later extension, not an implied property of the language selector.

The [translation integration outline](docs/church-resources/translation-integration.md) records the shared state and the concrete changes needed in the existing code.

## Hosting

The recommended first deployment places a separately supervised Multilinguum processor beside the Community application on the same ordinary server. The database/web app and translation process have separate resource limits and restart lifecycles. The existing mixer-connected computer supplies audio over an authenticated secure connection.

`https://wotbc.heritage.faith/translate` becomes the stable listener route. Keep `/live` as a compatible alias when replacing today's embed. Community serves the listener UI and routes only its necessary public stream/state endpoints to the processor. Manager controls use authenticated, scoped routes. Do not proxy the processor's entire private API publicly.

This design does not require `vr-mayos` or a GPU for cloud processing. Ordinary cloud TTS also needs no local GPU. Keep the current NVIDIA voice worker as an optional remote component for its existing cloned-voice mode. Local transcription/translation models would have their own hardware requirements; their adapters are not yet implemented.

Starting from the Community website still requires an active computer connected to the mixer. The browser can be that capture device, or control an already-paired capture agent. A server-side Start button alone cannot receive audio from an absent capture device. Use one active capture lease, an input meter, and visible capture ownership.

The processor could alternatively run on the presentation computer, but public listeners then depend on that computer staying awake and reachable. Cohosting on Community is the more convenient default for independent browser control. Actual WOTBC capacity and network behavior must be measured before migrating.

Prepared Bible content and ShowPackages continue offline. Cloud translation needs internet; its failure must not stop Bible reading or Show. A fully offline translation provider is separate future work.

## Quality and economy

Expose **Quality** and **Economy · shared-data allowance**, with the actual model and cost estimate available in setup. Separate quality selection from voice selection. Use a validated model configuration for each release; changing to a new model requires a short bilingual sermon comparison for meaning, Bible names, negation, omissions, and delay.

Current official documentation lists GPT-6 Astra as a strongest-model candidate for text, but this audit did not test its translation latency or accuracy. Multilinguum already uses a glossary-aware Terra text path and has an older small benchmark demonstrating eligible complimentary text usage. Choose a live default from measured sermon performance, not the model name alone. [OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra)

OpenAI's allowance requires account eligibility and opt-in on the relevant project. Listed models include Sol, Terra, and Luna, so eligible does not necessarily mean an old model. Audio transcription, speech synthesis, and realtime speech translation are not listed for that allowance. Requests crossing the daily quota can be charged in full. Use a dedicated sharing project, stage-specific usage estimates, and an explicit overage policy; an application cannot infer the remaining organization-wide allowance from its own requests alone. Account eligibility was not rechecked in this audit. [OpenAI shared-data terms](https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai)

For scale, 120 minutes of the currently documented Live Transcribe rate is **$2.04 for transcription alone**, before text translation, optional voice, hosting, and delivery. Economy captions can therefore be inexpensive without being entirely free. [Live Transcribe pricing](https://developers.openai.com/api/docs/models/gpt-live-transcribe)

Shared-data mode is a deliberate church setting for approved service content. Personal reading notes, account data, credentials, and private preparation material must not enter that project automatically. The pipeline needs separate project credentials for stages if only translated-text traffic is intended to be shared. This audit made no account, key, billing, or sharing changes.

## Development home

Keep the current repositories for this first integration. Use Heritage as the product-documentation home and [the shared workspace](heritage-church-resources.code-workspace) to open all three codebases together. The workspace is navigation only; it does not install, run, pull, or modify the other projects.

Unify the service/translation contracts, roadmap, and acceptance service now. Do not move the applications or duplicate their implementations into a fourth repository as a prerequisite. Desktop releases, Android/web releases, and the processor have different runtimes and deployment needs. A monorepo can be reconsidered after the shared contracts and release workflow are proven.

One source must own each shared package. Existing copies of `@syncshow/service-core` need explicit release provenance and compatibility checks. A translation protocol package should contain provider-neutral session/events and conformance fixtures; secrets, vendor SDK state, and renderer implementations stay outside it.

## Delivery order

| Milestone | Usable result | Completion evidence |
| --- | --- | --- |
| 1. Establish the integration baseline | The committed revisions reproduce the running Heritage pilot, SyncShow build, and Multilinguum behavior. Preserve all dirty work while reconciling in clean checkouts. | Recorded source/deployment versions; one current service opens in both preparers and loads in the packaged app. |
| 2. Text translation through Community | Start EN→RU or RU→EN in the browser; read at `/translate` and enter from Heritage. No GPU, speech renderer, or audio relay is required for text. | Mixer or authorized recording reaches two real browsers; stop/reconnect works; voice-off makes zero speech calls. |
| 3. Translation in SyncShow | The same session can be controlled from Show, with full-screen feed, lower third, ticker, hide, and manual override. | Both language outputs plus stage-facing output; captions do not cover existing text; starting from two controllers creates one session; lost internet leaves Show working. |
| 4. Optional voice and economy profile | Toggle ordinary speech on/off; select quality or sharing-eligible text settings. Keep cloned voice optional. | Actual API usage, text continuity during voice failure/off, no stale-audio replay, and representative phone listening. |
| 5. Finish the weekly Heritage experience | Shared songs, passage-linked sermon resources, service/archive navigation, and personal sync are convenient together. | Prepare and run a representative service; publish/reopen resources; real email sign-in and two-device notes/progress/conflict/offline checks. |

Use one representative English/Russian service as the common acceptance fixture. Every milestone must ship a useful behavior; its checks support that behavior. Detailed test histories belong in the audit/evidence notes, not this product brief.
