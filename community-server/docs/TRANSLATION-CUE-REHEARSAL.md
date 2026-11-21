# Rehearsing planned translation

Translation belongs to the service document. The operator selects the audio source before Show; slide cues control when translation starts and stops.

1. In Planner, right-click the slide where translation should begin and choose **Add “Start Translate” Cue**.
2. Choose the speaker’s language, translated phone audio, and optional on-screen text. The ticker reserves the bottom 12%; appearing sentences reserve 29%. Choose English, Russian or both audience screens. Stage keeps its usual layout.
3. Check the reserved band in each affected slide preview. It stays active until a Stop cue. Right-click the Start slide and choose **Edit Translation Settings…** to change it.
4. Add **Stop Translate** where translation should end. Save the service.
5. In SyncShow Load, open **Translation setup → Choose audio source & check translation**. The Community connection needs live-translation control. Choose the mixer/USB device, or **Computer audio · Safari and other apps** on a supported Mac/Windows runtime. This captures system audio, not an individual app. Video tracks are discarded and never sent to translation.
6. Reload the saved service in SyncShow. Visit the slide preceding Start to prepare the source and providers; advance to Start to translate. Advance to Stop to stop. If Start is the first slide or you jump directly to it, preparation happens there and may take a moment.

Before a live service, rehearse actual device permissions, the incoming level, both caption layouts on the configured audience outputs, translated phone audio, and Stop/restart. Use a recording with known speech and verify that advancing over or backwards across cues produces the expected state. A successful build or local unit test does not prove the audio hardware/provider path.

Planner labels follow the selected preview language and fall back to available content without copying it into the unfinished language. Personal monochrome preferences are under **My account**.

## Components

- Heritage Community: branch `codex/planner-translation-cues-20260924`.
- SyncShow and Multilinguum: branch `codex/planned-translation-20260924` in their respective repositories.
- New cue settings require these versions together. Older cues without local settings continue using the separately saved service translation plan.

Planned cues now use OpenAI continuous realtime interpretation. New translated words appear immediately in the sentence band; completed sentences become gray. The interpreter supplies its voice, so cue setup does not expose the cascade narrator selector. Phone audio uses the same stream through `/translate`; Muse comparison and broadcast-video synchronization are separate work.
