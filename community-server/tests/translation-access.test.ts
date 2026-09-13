import assert from 'node:assert/strict'
import test from 'node:test'
import { translationAccessResponse } from '../src/endpoints/translation.ts'
import { SYNCSHOW_TRANSLATION_CONTROL_SCOPE } from '../src/lib/syncShowProtocol.ts'
const origin = 'https://church.example'
const controlToken = 'test-server-key-that-must-never-reach-the-browser'
function fixture({ user = { id: 7, systemRole: 'member' } as Record<string, unknown> | null, role = 'admin', scopes = [SYNCSHOW_TRANSLATION_CONTROL_SCOPE], device = false, revoked = false, otherChurch = false } = {}) {
  let upstreamCalls = 0
  const req = {
    headers: new Headers(device ? { authorization: 'SyncShow test-device-token' } : { origin }),
    payload: {
      auth: async () => ({ user }),
      find: async ({ collection, where }: { collection: string; where?: { and?: Array<{ role?: { in: string[] } }> } }) => ({ docs: collection === 'communities' ? [{ id: 2 }]
        : collection === 'memberships' ? role && (!where?.and?.some(item => item.role) || ['owner', 'admin', 'leader'].includes(role)) ? [{ id: 1, user: 7, community: 2, role }] : []
        : collection === 'syncshow-connections' ? revoked ? [] : [{ id: 3, community: otherChurch ? 99 : 2, user: 7, scopes, lastUsedAt: new Date().toISOString() }] : [] }),
      update: async () => ({}),
    },
  }
  const options = { origin, controlToken, processorUrl: 'http://processor.internal:4310', fetch: (async (input: URL | string | Request, init?: RequestInit) => {
    upstreamCalls++
    assert.equal(String(input), 'http://processor.internal:4310/api/control/leases')
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${controlToken}`)
    assert.match(JSON.parse(String(init?.body)).subject, /^[a-f0-9]{64}$/)
    return Response.json({ token: 'mlg1.test.signature', expiresAtUnixMs: Date.now() + 600000, secret: controlToken })
  }) as typeof fetch }
  return { req, options, calls: () => upstreamCalls }
}
test('a church manager receives only a short-lived scoped lease', async () => {
  const { req, options, calls } = fixture()
  const response = await translationAccessResponse(req as never, options)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control')!, /no-store/)
  const body = await response.text()
  assert.ok(!body.includes(controlToken))
  assert.deepEqual(Object.keys(JSON.parse(body)).sort(), ['apiBase', 'expiresAtUnixMs', 'token'])
  assert.equal(JSON.parse(body).apiBase, `${origin}/translation/`)
  assert.equal(calls(), 1)
})
test('anonymous and nonmanager requests never reach the processor', async () => {
  for (const [config, status] of [[{ user: null }, 401], [{ role: 'member' }, 403], [{ role: '' }, 403]] as const) {
    const { req, options, calls } = fixture(config)
    assert.equal((await translationAccessResponse(req as never, options)).status, status)
    assert.equal(calls(), 0)
  }
})
test('cross-origin and origin-less browser writes are rejected', async () => {
  for (const value of [null, 'https://other.example', 'null']) {
    const { req, options, calls } = fixture()
    if (value === null) req.headers.delete('origin'); else req.headers.set('origin', value)
    assert.equal((await translationAccessResponse(req as never, options)).status, 403)
    assert.equal(calls(), 0)
  }
})
test('SyncShow needs the dedicated scope, a current connection and manager membership', async () => {
  const cases: Array<[Parameters<typeof fixture>[0], number]> = [[{}, 200], [{ scopes: ['syncshow:songs:read'] }, 401], [{ revoked: true }, 401], [{ role: 'member' }, 403], [{ otherChurch: true }, 403]]
  for (const [config, status] of cases) {
    const { req, options, calls } = fixture({ device: true, ...config })
    assert.equal((await translationAccessResponse(req as never, options)).status, status)
    assert.equal(calls(), status === 200 ? 1 : 0)
  }
})
test('missing setup and upstream failure return an actionable error without leaking secrets', async () => {
  const { req, options, calls } = fixture()
  assert.equal((await translationAccessResponse(req as never, { ...options, controlToken: '' })).status, 503)
  assert.equal(calls(), 0)
  const response = await translationAccessResponse(req as never, { ...options, fetch: (async () => Response.json({ error: controlToken }, { status: 401 })) as typeof fetch })
  assert.equal(response.status, 503)
  assert.ok(!(await response.text()).includes(controlToken))
})
