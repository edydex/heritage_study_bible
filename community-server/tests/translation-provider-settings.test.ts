import assert from 'node:assert/strict'
import test from 'node:test'
import { translationProviderSettingsResponse } from '../src/endpoints/translationProviderSettings.ts'
import { parseTranslationSettings } from '../src/lib/serviceTranslationPlan.ts'
const origin = 'https://church.example'
const controlToken = 'MASTER_TOKEN_NOT_FOR_BROWSER_RESPONSE'
const providerToken = 'PROVIDER_TOKEN_NOT_FOR_BROWSER_RESPONSE'
function fixture(user: Record<string, unknown> | null = { id: 1, systemRole: 'system-admin' }) {
  let calls = 0
  const payload = { auth: async () => ({ user }), find: async ({ collection }: { collection: string }) => ({ docs: collection === 'communities' ? [{ id: 2 }] : [] }) }
  const request = (method = 'GET', body?: unknown, headers: Record<string, string> = {}) => Object.assign(new Request(origin + '/api/community/translation/settings/muse', { method, headers: { origin, 'content-type': 'application/json', ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), { payload })
  const options = { origin, controlToken, processorUrl: 'http://processor.internal:4310', fetch: (async (url, init) => {
    calls++
    assert.equal(String(url), 'http://processor.internal:4310/api/settings/muse')
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${controlToken}`)
    if (init?.method === 'PUT') assert.equal(JSON.parse(String(init.body)).apiKey, providerToken)
    return Response.json({ configured: true, source: 'saved', verifiedAt: '2026-09-20T12:00:00Z', apiKey: providerToken, master: controlToken })
  }) as typeof fetch }
  return { request, options, calls: () => calls }
}
test('a manager can configure Muse, but no secret returns to the browser', async () => {
  const f = fixture()
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const response = await translationProviderSettingsResponse(f.request(method, method === 'PUT' ? { apiKey: providerToken } : undefined) as never, f.options)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control') || '', /no-store/)
    const body = await response.text()
    assert.ok(!body.includes(controlToken) && !body.includes(providerToken))
    assert.deepEqual(Object.keys(JSON.parse(body)).sort(), ['configured', 'source', 'verifiedAt'])
  }
  assert.equal(f.calls(), 3)
})
test('anonymous, member, device, and foreign-origin writes cannot reach settings', async () => {
  for (const [user, headers, status] of [[null, {}, 401], [{ id: 1, systemRole: 'member' }, {}, 403], [{ id: 1, systemRole: 'system-admin' }, { authorization: 'SyncShow device-token' }, 403], [{ id: 1, systemRole: 'system-admin' }, { origin: 'https://other.example' }, 403]] as const) {
    const f = fixture(user)
    const response = await translationProviderSettingsResponse(f.request('PUT', { apiKey: providerToken }, headers) as never, f.options)
    assert.equal(response.status, status); assert.equal(f.calls(), 0)
  }
})
test('invalid and oversized token bodies are rejected, and upstream errors are redacted', async () => {
  for (const body of [{ apiKey: providerToken, extra: true }, { apiKey: 'a'.repeat(9000) }, { apiKey: 'short' }]) {
    const f = fixture(); const response = await translationProviderSettingsResponse(f.request('PUT', body) as never, f.options)
    assert.ok([400, 413].includes(response.status)); assert.equal(f.calls(), 0)
  }
  const f = fixture()
  const response = await translationProviderSettingsResponse(f.request('GET') as never, { ...f.options, fetch: (async () => Response.json({ error: providerToken }, { status: 409 })) as typeof fetch })
  assert.equal(response.status, 409); assert.ok(!(await response.text()).includes(providerToken))
})
test('saved service plans accept provider selection while preserving old plans', () => {
  const old = { sourceLanguage: 'en', translationProfile: 'quality', speechEnabled: false, contextDocumentIds: [] }
  assert.deepEqual(parseTranslationSettings(old), old)
  assert.equal(parseTranslationSettings({ ...old, transcriptionProvider: 'muse' }).transcriptionProvider, 'muse')
  assert.throws(() => parseTranslationSettings({ ...old, sourceLanguage: 'ru', transcriptionProvider: 'muse' }), /Russian/)
  assert.throws(() => parseTranslationSettings({ ...old, transcriptionProvider: 'invalid' }))
})
