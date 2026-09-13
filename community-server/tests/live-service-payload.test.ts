import assert from 'node:assert/strict'
import test from 'node:test'
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'
import { publicLiveServiceSettings } from '../src/lib/liveServiceConfig.ts'

test('migrated church settings round-trip through Payload and reject anonymous changes', { skip: !process.env.LIVE_SERVICE_DATABASE_URL }, async () => {
  assertDisposableLiveDatabase({
    databaseUrl: process.env.LIVE_SERVICE_DATABASE_URL,
    expectedDatabase: 'heritage_live_service_ci',
    expectedMarker: 'heritage-live-service',
    variableName: 'LIVE_SERVICE_DATABASE_URL',
  })
  const resolved = await config
  const payload = await getPayload({ config: { ...resolved, onInit: async () => {} } })
  try {
    const community = await payload.create({ collection: 'communities', overrideAccess: true, data: {
      name: 'Disposable live service test', slug: `live-service-${Date.now()}`, timeZone: 'America/Los_Angeles', joinPolicy: 'invite',
      liveService: { youtubeChannelUrl: 'https://www.youtube.com/@wordoftruthbiblech', youtubeVideoUrl: 'https://www.youtube.com/watch?v=yVg2nsbpJC0', translationUrl: '/translate', broadcastDelaySeconds: 25 },
    } })
    const read = await payload.findByID({ collection: 'communities', id: community.id, overrideAccess: false })
    assert.deepEqual(publicLiveServiceSettings(read as unknown as Record<string, unknown>), {
      churchName: 'Disposable live service test', channelUrl: 'https://www.youtube.com/@wordoftruthbiblech', videoId: 'yVg2nsbpJC0', translationUrl: '/translate', broadcastDelaySeconds: 25,
    })
    await assert.rejects(payload.update({ collection: 'communities', id: community.id, overrideAccess: false, data: { liveService: { youtubeVideoUrl: 'https://youtu.be/AAAAAAAAAAA' } } }))
    await assert.rejects(payload.update({ collection: 'communities', id: community.id, overrideAccess: true, data: { liveService: { youtubeVideoUrl: 'https://youtube.com.evil.test/watch?v=yVg2nsbpJC0' } } }))
  } finally {
    const database = payload.db as unknown as {
      pool?: { end: () => Promise<void>; _clients?: Array<{ release?: (destroy?: boolean) => void; end?: () => Promise<void> }> }
      destroy?: () => Promise<void>
    }
    if (database.pool) {
      // Payload retains a transaction-free schema client; all clients here belong to the guarded disposable database.
      const pool = database.pool
      const ending = pool.end()
      let timer: ReturnType<typeof setTimeout> | undefined
      const ended = await Promise.race([ending.then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 1000) })])
      clearTimeout(timer)
      if (!ended) {
        for (const client of [...(pool._clients || [])]) {
          if (client.release) client.release(true)
          else await client.end?.()
        }
        await ending
      }
    }
    await database.destroy?.()
  }
})
