import test from 'node:test'
import assert from 'node:assert/strict'
import { GET } from '../src/app/.well-known/heritage-community.json/route.ts'

test('translation discovery follows installed setup and advertises only public paths and approval scope', async () => {
  const previousUrl = process.env.TRANSLATION_PROCESSOR_URL
  const previousKey = process.env.TRANSLATION_CONTROL_TOKEN
  try {
    delete process.env.TRANSLATION_PROCESSOR_URL
    delete process.env.TRANSLATION_CONTROL_TOKEN
    const disabled = await GET().json()
    assert.equal(disabled.integrations.translation, undefined)
    assert.equal(disabled.integrations.syncShow.resources.translation, undefined)
    process.env.TRANSLATION_PROCESSOR_URL = 'http://private-processor:4310'
    process.env.TRANSLATION_CONTROL_TOKEN = 'synthetic-key-that-must-not-be-advertised'
    const enabled = await GET().json()
    const translation = enabled.integrations.translation
    assert.deepEqual(translation, {
      schemaVersion: 1,
      operatorPath: '/admin/live-translation',
      accessPath: '/api/community/translation/access',
      eventsPath: '/translation/api/public/events',
      scopes: ['syncshow:translation:control'],
    })
    assert.deepEqual(enabled.integrations.syncShow.resources.translation, translation)
    assert.ok(!JSON.stringify(enabled).includes('synthetic-key'))
    assert.ok(!JSON.stringify(enabled).includes('private-processor'))
  } finally {
    if (previousUrl === undefined) delete process.env.TRANSLATION_PROCESSOR_URL
    else process.env.TRANSLATION_PROCESSOR_URL = previousUrl
    if (previousKey === undefined) delete process.env.TRANSLATION_CONTROL_TOKEN
    else process.env.TRANSLATION_CONTROL_TOKEN = previousKey
  }
})
