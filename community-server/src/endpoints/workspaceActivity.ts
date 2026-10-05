import type { Endpoint, PayloadRequest, Where } from 'payload'
import { membershipCommunityIds } from '@/access'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { WORKSPACE_SCREENS } from '@/lib/workspaceActivity'

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } })
async function authority(req: PayloadRequest) {
  if (!req.user || (req.user as { _strategy?: string })._strategy !== 'local-jwt') return null
  const community = await getConfiguredCommunityId(req.payload)
  if (!community) return null
  if (req.user.systemRole === 'system-admin') return community
  const ids = await membershipCommunityIds(req, ['owner', 'admin', 'leader'])
  return ids.map(String).includes(String(community)) ? community : null
}

export async function recordWorkspaceActivity(req: PayloadRequest) {
  const community = await authority(req)
  if (!community || !req.user) return json({ error: 'Sign in to the church workspace.' }, 403)
  const expectedOrigin = new URL(req.payload.config.serverURL || req.url || 'http://localhost:3000').origin
  if (req.headers.get('origin') !== expectedOrigin) return json({ error: 'Use the church workspace.' }, 403)
  if (Number(req.headers.get('content-length') || 0) > 1024) return json({ error: 'Invalid activity.' }, 400)
  let data: unknown
  try { data = await req.json?.() } catch { return json({ error: 'Invalid activity.' }, 400) }
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || Object.keys(data).some(key => !['screen', 'kind'].includes(key))
    || !('screen' in data) || typeof data.screen !== 'string' || !Object.hasOwn(WORKSPACE_SCREENS, data.screen)
    || !('kind' in data) || !['navigation', 'heartbeat'].includes(String(data.kind))) return json({ error: 'Invalid activity.' }, 400)
  const where: Where = { and: [{ community: { equals: community } }, { user: { equals: req.user.id } }] }
  const find = () => req.payload.find({ collection: 'workspace-activity', where, depth: 0, limit: 1, overrideAccess: true })
  const now = new Date().toISOString()
  const activity = { screen: data.screen as keyof typeof WORKSPACE_SCREENS, lastActiveAt: now }
  const update = async (row: Awaited<ReturnType<typeof find>>['docs'][number]) => {
    // Heartbeats never change the most recently navigated screen. Multiple tabs
    // can be open, but only a real navigation establishes the current screen.
    await req.payload.update({ collection: 'workspace-activity', id: row.id, overrideAccess: true,
      data: data.kind === 'navigation' ? { ...activity, lastNavigationAt: now, navigationCount: row.navigationCount + 1 } : { lastActiveAt: now } })
  }
  const existing = (await find()).docs[0]
  if (existing) await update(existing)
  else {
    try { await req.payload.create({ collection: 'workspace-activity', overrideAccess: true,
      data: { community, user: req.user.id, ...activity, lastNavigationAt: now, navigationCount: 1 } }) }
    catch (error) { const row = (await find()).docs[0]; if (!row) throw error; await update(row) }
  }
  return json({ recorded: true })
}

export async function recentWorkspaceActivity(req: PayloadRequest) {
  const community = await authority(req)
  if (!community) return json({ error: 'Sign in to the church workspace.' }, 403)
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const rows = await req.payload.find({ collection: 'workspace-activity', overrideAccess: true, depth: 1, limit: 100, sort: '-lastActiveAt',
    where: { and: [{ community: { equals: community } }, { lastActiveAt: { greater_than_equal: since } }] } })
  return json({ since, checkedAt: new Date().toISOString(), items: rows.docs.map(row => ({
    user: typeof row.user === 'object' ? row.user.displayName || 'Church manager' : 'Church manager',
    screen: WORKSPACE_SCREENS[row.screen], lastNavigationAt: row.lastNavigationAt, lastActiveAt: row.lastActiveAt,
  })) })
}
export const workspaceActivityEndpoints: Endpoint[] = [
  { path: '/workspace/activity', method: 'post', handler: recordWorkspaceActivity },
  { path: '/workspace/activity', method: 'get', handler: recentWorkspaceActivity },
]
