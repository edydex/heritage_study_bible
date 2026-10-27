import assert from 'node:assert/strict'
import test from 'node:test'
import { workspaceScreen, workspaceIsActive, WORKSPACE_IDLE_MS } from '../src/lib/workspaceActivity'
import { recordWorkspaceActivity, recentWorkspaceActivity } from '../src/endpoints/workspaceActivity'

test('activity contains coarse screens, never document IDs or search text', () => {
  assert.equal(workspaceScreen('/admin/collections/songs/12'), 'songs')
  assert.equal(workspaceScreen('/admin/plan-service'), 'planner')
  assert.equal(workspaceScreen('/admin/login'), null)
  assert.equal(workspaceScreen('/admin/reset/secret'), null)
  assert.equal(workspaceScreen('/administrator'), null)
  assert.equal(workspaceIsActive(true, 1000, 1000 + WORKSPACE_IDLE_MS - 1), true)
  assert.equal(workspaceIsActive(true, 1000, 1000 + WORKSPACE_IDLE_MS), false)
  assert.equal(workspaceIsActive(false, 1000, 2000), false)
})

function fixture(body: unknown) {
  const writes: unknown[] = []
  const req = {
    user: { id: 1, systemRole: 'system-admin', _strategy: 'local-jwt' },
    headers: new Headers({ origin: 'http://127.0.0.1:4295' }),
    json: async () => body,
    payload: { config: { serverURL: 'http://127.0.0.1:4295' },
      find: async ({ collection }: { collection: string }) => ({ docs: collection === 'communities' ? [{ id: 7 }] : [] }),
      create: async (args: unknown) => { writes.push(args); return {} },
    },
  }
  return { req, writes }
}

test('activity accepts only local workspace managers and server timestamps', async () => {
  const { req, writes } = fixture({ screen: 'songs', kind: 'navigation' })
  assert.equal((await recordWorkspaceActivity(req as never)).status, 200)
  assert.equal(writes.length, 1)
  const data = (writes[0] as any).data
  assert.equal(data.user, 1)
  assert.equal(data.community, 7)
  assert.equal(data.screen, 'songs')
  assert.ok(Math.abs(Date.now() - Date.parse(data.lastActiveAt)) < 1000)
  for (const body of [
    { screen: 'songs', kind: 'navigation', url: '/admin/songs?secret' },
    { screen: 'songs', kind: 'navigation', user: 9 },
    { screen: '__proto__', kind: 'navigation' },
  ]) {
    const invalid = fixture(body)
    assert.equal((await recordWorkspaceActivity(invalid.req as never)).status, 400)
    assert.equal(invalid.writes.length, 0)
  }
  req.headers.set('origin', 'https://foreign.example')
  assert.equal((await recordWorkspaceActivity(req as never)).status, 403)
  req.user._strategy = 'api-key'
  assert.equal((await recentWorkspaceActivity(req as never)).status, 403)
})
