import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeSermonMedia } from '../src/lib/syncshow/SermonMediaStore.ts'
import { publicUrl } from '../src/lib/publicConfig.ts'

const origin = new URL(publicUrl).origin
function request({ role = 'leader', user = { id: 17, systemRole: 'member' }, headers = {} }:
  { role?: string | null; user?: { id: number; systemRole: string } | null; headers?: Record<string, string> } = {}) {
  const calls: string[] = []
  return {
    calls,
    headers: new Headers(headers),
    payload: {
      auth: async () => { calls.push('auth'); return { user } },
      find: async ({ collection, where }: any) => {
        calls.push(collection)
        if (collection === 'communities') return { docs: [{ id: 7 }] }
        if (collection === 'memberships') {
          assert.deepEqual(where.and, [{ user: { equals: 17 } }, { community: { equals: 7 } }])
          return { docs: role ? [{ role }] : [] }
        }
        if (collection === 'syncshow-connections') return { docs: [] }
        throw new Error(`Unexpected collection ${collection}`)
      },
    },
  } as any
}

test('browser manager uses the configured church and a real user actor, without a device connection', async () => {
  for (const role of ['owner', 'admin', 'leader']) {
    const req = request({ role, headers: { origin } })
    assert.deepEqual(await authorizeSermonMedia(req, 'write'), {
      connectionId: null, userId: 17, communityId: 7, mode: 'write',
    })
    assert.deepEqual(req.calls, ['communities', 'auth', 'memberships'])
  }
  const admin = request({ user: { id: 17, systemRole: 'system-admin' }, headers: { origin } })
  assert.equal((await authorizeSermonMedia(admin, 'write')).connectionId, null)
  assert.deepEqual(admin.calls, ['communities', 'auth'])
})

test('cookie writes require the church origin; reads reject an explicit foreign origin', async () => {
  for (const headers of [{}, { origin: 'https://another.example' }, { origin: 'null' }] as Record<string, string>[]) {
    const req = request({ headers })
    await assert.rejects(authorizeSermonMedia(req, 'write'), { code: 'ORIGIN', status: 403 })
    assert.deepEqual(req.calls, [])
  }
  await assert.rejects(authorizeSermonMedia(request({ headers: { origin: 'https://another.example' } }), 'read'), { code: 'ORIGIN' })
  assert.equal((await authorizeSermonMedia(request(), 'read')).mode, 'read')
})

test('logged-out, member and unrelated accounts cannot manage recordings', async () => {
  await assert.rejects(authorizeSermonMedia(request({ user: null, headers: { origin } }), 'write'), { code: 'UNAUTHORIZED', status: 401 })
  for (const role of ['member', null]) {
    await assert.rejects(authorizeSermonMedia(request({ role, headers: { origin } }), 'write'), { code: 'MANAGER_REQUIRED', status: 403 })
  }
})

test('an invalid explicit device token never falls back to a signed-in manager cookie', async () => {
  const req = request({ headers: { origin, authorization: 'SyncShow invalid-device-token' } })
  await assert.rejects(authorizeSermonMedia(req, 'write'), { code: 'UNAUTHORIZED', status: 401 })
  assert.deepEqual(req.calls, ['syncshow-connections'])
})


test('an empty explicit SyncShow scheme cannot fall back to the browser session', async () => {
  const req = request({ headers: { origin, authorization: 'SyncShow ' } })
  await assert.rejects(authorizeSermonMedia(req, 'write'), { code: 'UNAUTHORIZED', status: 401 })
  assert.deepEqual(req.calls, [])
})
