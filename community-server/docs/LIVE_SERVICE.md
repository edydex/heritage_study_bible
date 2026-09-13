# Live service integration

Church settings includes a Live service group for the YouTube channel, current service video, public Multilinguum listener address, and measured broadcast delay. The channel and individual video are separate, so an old video never silently becomes the permanent channel address. Provider and operator secrets belong in server configuration, not in this publicly readable collection.

`GET /live/settings.json` returns schema version 1 with `churchName`, `channelUrl`, `videoId`, `translationUrl`, and `broadcastDelaySeconds`. It is a public, uncached, explicitly shaped response for the configured community. This endpoint reports settings; it does not assert that a video or translation session is live. `/live` still uses the existing listener until the combined player is connected in the next integration change.

Migration `20260913_010000_live_service_settings` adds four nullable/defaulted columns to `communities`. It follows the existing explicit migration chain. Before deployment, use the supported appliance backup/update procedure; do not replace an existing church's saved settings with example values.

WOTBC's user-supplied channel is `https://www.youtube.com/@wordoftruthbiblech`. Configure it for WOTBC when deploying the combined player. Other installations choose their own channel. The September 13 stream `yVg2nsbpJC0` was observed on the channel page during development; it is not a permanent default.

Validation: `npm run test:live-service` runs URL/public-shape tests and an optional database test. For the latter, set `DATABASE_URL` and `LIVE_SERVICE_DATABASE_URL` to the same loopback PostgreSQL database named `heritage_live_service_ci`, set `HERITAGE_DISPOSABLE_CI=heritage-live-service`, and run with production migrations enabled. The test checks real Payload storage, public reads, rejected anonymous writes, and rejected lookalike video URLs. Only use a disposable database.

On 2026-09-12, the full migration chain applied successfully to a fresh PostgreSQL 17 instance, the database test passed, TypeScript checks passed, and the server production build passed. No WOTBC deployment or actual stream/audio synchronization is claimed by these checks.
