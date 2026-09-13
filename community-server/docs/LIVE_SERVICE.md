# Church live-service settings and listener

Church administrators configure the YouTube channel, current service video, public translation listener URL, and planned broadcast delay in the community's Live service settings. WOTBC's supplied channel is `https://www.youtube.com/@wordoftruthbiblech`; it is church data, not a default for other installations. The current video must be selected for each service. Automatic channel live discovery is not implemented.

`/live` loads the church's YouTube video and the shared Multilinguum listener. `/translate` uses that same client without video. Text and audio language choices are independent. Original `/live` audio comes from YouTube. The shared client handles audio cancellation, a floating panel, and optional Document Picture-in-Picture; see Multilinguum's `docs/heritage-listener-client.md` for its contract and acceptance boundaries.

For a companion processor in the same deployment, set the public translation URL to `/translate`. Heritage proxies only the public listener contract under `/translation/`. The processor origin is recorded at build time from `TRANSLATION_PROCESSOR_URL`, defaulting to `http://translation-processor:4310`; use the corresponding Docker build argument for another address. The processor must include the matching browser client. If it is absent or incompatible, the page shows an unavailable state with church video/listener links instead of silently loading an old embedded audio player.

For an external public listener, its URL must identify the base containing `client/heritage.js` and `api/public/*`. The listener must allow public cross-origin module/API requests. No keys or control tokens belong in church settings or the module's mount options.

`/live/settings.json` is the public version-1 settings document. URL validation accepts supported YouTube links and rejects lookalike hosts; public fields are explicitly shaped. The migration adds four nullable/defaulted columns. Public reads remain available; anonymous writes are rejected.

The stored broadcast delay is not applied to the player yet. YouTube/translation timing, real translated audio, native floating-window behavior, actual phone playback, companion installation, and WOTBC deployment remain acceptance work. Local production builds, the real public WebSocket through Heritage, bilingual synthetic text, and the in-page floating panel have been verified. No WOTBC deployment is represented by those local checks.

## Manager controls

The church workspace links to `/admin/live-translation`. The embedded Multilinguum operator opens in control-only mode; **Connect this mixer** explicitly opens the selected input. A second console can control the service without claiming that input. English/Russian text and the generated-speech toggle use the same processor session as SyncShow.

`POST /api/community/translation/access` checks the configured church and the signed-in manager's current membership (or system administrator role). Browser requests must have the same Origin as `COMMUNITY_PUBLIC_URL`. SyncShow uses its existing device authorization with an explicitly granted `syncshow:translation:control` scope. Existing connections must be reauthorized with that scope; no implicit permission expansion occurs.

Set `TRANSLATION_CONTROL_TOKEN` to the processor's permanent `PROCESSOR_CONTROL_TOKEN` through private server configuration. Only a signed ten-minute control lease reaches the browser. The lease renews every two minutes while the operator is open; it is never saved in local storage. Revocation takes effect on renewal, within the maximum ten-minute lease lifetime. Heritage proxies the enumerated authenticated session/control/capture endpoints and does not proxy the lease issuer, archives, replay, or voice-profile administration.

`TRANSLATION_PROCESSOR_URL` must identify the same processor at build time and runtime. The production Compose configuration passes it to both. `/client/operator.js` and `/client/pcm-worklet.js` must be installed in the processor alongside the listener module. The Multilinguum processor Dockerfile includes both builds.

The complete optional companion installer, translation archive backup/restore, WOTBC deployment, provider/account setup, actual mixer/audio acceptance, broadcast delay alignment, and SyncShow screen layouts remain integration work. Merely setting these variables does not install the companion.
