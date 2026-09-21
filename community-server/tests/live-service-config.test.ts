import assert from 'node:assert/strict'
import { test } from 'node:test'
import { publicLiveServiceSettings, publicTranslationUrl, youtubeChannel, youtubeVideoId } from '../src/lib/liveServiceConfig.ts'

test('accepts the supplied WOTBC channel and supported video URLs', () => {
  assert.equal(youtubeChannel('https://www.youtube.com/@wordoftruthbiblech')?.handle, '@wordoftruthbiblech')
  for (const url of ['https://www.youtube.com/watch?v=yVg2nsbpJC0', 'https://youtu.be/yVg2nsbpJC0?si=example', 'https://www.youtube.com/live/yVg2nsbpJC0']) {
    assert.equal(youtubeVideoId(url), 'yVg2nsbpJC0')
  }
  assert.equal(youtubeVideoId('https://www.youtube.com/@wordoftruthbiblech'), null)
})

test('rejects lookalike hosts, executable URLs, credential URLs and invalid IDs', () => {
  for (const value of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=yVg2nsbpJC0', 'https://youtube.com@evil.test/watch?v=yVg2nsbpJC0', 'https://user:password@youtube.com/watch?v=yVg2nsbpJC0', 'https://youtube.com:8443/watch?v=yVg2nsbpJC0', 'http://youtube.com/watch?v=yVg2nsbpJC0', 'https://youtube.com/watch?v=bad']) {
    assert.equal(youtubeVideoId(value), null)
  }
  assert.equal(publicTranslationUrl('/translate'), '/translate')
  for (const value of ['//example.test', 'https://user:token@example.test', 'https://example.test?token=private', 'javascript:alert(1)']) assert.equal(publicTranslationUrl(value), null)
})

test('returns only safe public settings and bounds the delay', () => {
  const result = publicLiveServiceSettings({ name: 'Church', privateToken: 'private', liveService: { youtubeChannelUrl: 'https://www.youtube.com/@wordoftruthbiblech', translationUrl: '/translate', broadcastDelaySeconds: -10, secret: 'private' } })
  assert.deepEqual(result, { churchName: 'Church', channelUrl: 'https://www.youtube.com/@wordoftruthbiblech', videoId: null, translationUrl: '/translate', broadcastDelaySeconds: 0 })
})
