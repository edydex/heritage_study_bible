import assert from 'node:assert/strict'
import test from 'node:test'
import { translationPlansResponse } from '../src/endpoints/translationPlans.ts'
import { parseTranslationPlanWrite, serviceTranslationPlan } from '../src/lib/serviceTranslationPlan.ts'
const origin = 'https://church.example'
const settings = { sourceLanguage: 'ru', translationProfile: 'economy', speechEnabled: false, contextDocumentIds: [] }
const input = { serviceId: 'service-1', serviceRevision: 'a'.repeat(64), baseRevision: 0, settings }
function fixture({ authenticated = true, manager = true } = {}) {
  let document: Record<string, unknown> = { id: 5, community: 2, syncId: 'service-1', revision: input.serviceRevision, title: 'Sunday', serviceDate: '2026-09-13', status: 'planning', translationPlan: null, privateSecret: 'do-not-expose' }
  const calls = { save: 0, commit: 0, rollback: 0, lock: 0, upstream: 0 }
  const payload = {
    auth: async () => ({ user: authenticated ? { id: 7, systemRole: manager ? 'system-admin' : 'member' } : null }),
    find: async ({ collection, showHiddenFields }: { collection: string; showHiddenFields?: boolean }) => {
      if (collection === 'communities') return { docs: [{ id: 2 }] }
      if (collection === 'service-documents') { assert.equal(showHiddenFields, true); return { docs: [structuredClone(document)] } }
      return { docs: [] }
    },
    update: async ({ data, req }: { data: Record<string, unknown>; req: { transactionID?: unknown } }) => {
      assert.equal(req.transactionID, 'tx'); calls.save++; document = { ...document, ...data }; return document
    },
    db: { beginTransaction: async () => 'tx', sessions: { tx: { db: { execute: async () => { calls.lock++ } } } },
      commitTransaction: async () => { calls.commit++ }, rollbackTransaction: async () => { calls.rollback++ } },
  }
  function request(method = 'GET', body?: unknown, requestOrigin: string | null = origin) {
    return Object.assign(new Request(`${origin}/api/community/translation/plans`, { method,
      headers: { ...(requestOrigin ? { origin: requestOrigin } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }), { payload })
  }
  const options = { origin, controlToken: 'private-control-token-over-thirty-two-characters', fetch: (async () => { calls.upstream++; return Response.json([]) }) as typeof fetch }
  return { request, options, calls, change: (value: Record<string, unknown>) => { document = { ...document, ...value } } }
}
test('plans are private, shaped metadata; cookie GET need not carry Origin', async () => {
  const f = fixture()
  const response = await translationPlansResponse(f.request('GET', undefined, null) as never, f.options)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control')!, /no-store/)
  const body = await response.json()
  assert.equal(body.services[0].revision, 0)
  assert.equal(body.services[0].settings, null)
  assert.ok(!JSON.stringify(body).includes('do-not-expose'))
})
test('unauthorized and cross-origin requests never save or inspect notes', async () => {
  for (const [config, expected] of [[{ authenticated: false }, 401], [{ manager: false }, 403]] as const) {
    const f = fixture(config)
    assert.equal((await translationPlansResponse(f.request('PUT', input) as never, f.options)).status, expected)
    assert.deepEqual([f.calls.save, f.calls.upstream], [0, 0])
  }
  for (const value of [null, 'https://other.example']) {
    const f = fixture()
    assert.equal((await translationPlansResponse(f.request('PUT', input, value) as never, f.options)).status, 403)
  }
})
test('save uses hidden fields and transactional locks; stale writers cannot overwrite', async () => {
  const f = fixture()
  const req = f.request('PUT', input)
  assert.equal((await translationPlansResponse(req as never, f.options)).status, 200)
  assert.equal((req as unknown as { transactionID?: unknown }).transactionID, undefined)
  assert.deepEqual([f.calls.save, f.calls.commit, f.calls.lock], [1, 1, 2])
  assert.equal((await translationPlansResponse(f.request('PUT', input) as never, f.options)).status, 409)
  assert.deepEqual([f.calls.save, f.calls.rollback], [1, 1])
  f.change({ revision: 'b'.repeat(64) })
  const read = await (await translationPlansResponse(f.request() as never, f.options)).json()
  assert.equal(read.services[0].stale, true)
  assert.equal((await translationPlansResponse(f.request('PUT', { ...input, baseRevision: 1 }) as never, f.options)).status, 409)
})
test('missing notes and archived services cannot be saved', async () => {
  const f = fixture()
  assert.equal((await translationPlansResponse(f.request('PUT', { ...input, settings: { ...settings, contextDocumentIds: ['11111111-1111-4111-8111-111111111111'] } }) as never, f.options)).status, 409)
  assert.equal(f.calls.upstream, 1)
  assert.equal(f.calls.save, 0)
  f.change({ status: 'archived' })
  assert.equal((await translationPlansResponse(f.request('PUT', input) as never, f.options)).status, 409)
})
test('service-specific sharing choice is explicit; reject malformed, duplicate and oversized writes', async () => {
  assert.equal(parseTranslationPlanWrite({ ...input, settings: { ...settings, shareSermonNotesWithEconomy: true } }).settings.shareSermonNotesWithEconomy, true)
  assert.throws(() => parseTranslationPlanWrite({ ...input, settings: { ...settings, shareSermonNotesWithEconomy: 'true' } }))
  assert.throws(() => parseTranslationPlanWrite({ ...input, serviceId: '../other' }))
  assert.throws(() => parseTranslationPlanWrite({ ...input, settings: { ...settings, sourceLanguage: ['ru'] } }))
  assert.throws(() => parseTranslationPlanWrite({ ...input, baseRevision: Number.MAX_SAFE_INTEGER }))
  const id = '11111111-1111-4111-8111-111111111111'
  assert.throws(() => parseTranslationPlanWrite({ ...input, settings: { ...settings, contextDocumentIds: [id, id] } }))
  const f = fixture()
  assert.equal((await translationPlansResponse(f.request('PUT', { ...input, extra: 'x'.repeat(17000) }) as never, f.options)).status, 413)
  assert.equal(f.calls.save, 0)
  const plan = serviceTranslationPlan({ syncId: 's', translationPlan: { schemaVersion: 1, revision: 1, serviceRevision: input.serviceRevision, settings }, revision: input.serviceRevision }, 2)
  assert.deepEqual(plan.settings, settings)
})
