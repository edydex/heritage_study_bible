export type WorkspaceService = {
  syncId: string; title: string; serviceDate: string; changedAt: string; status: 'planning' | 'ready' | 'archived' | 'cancelled'
}
export type WorkspaceIdentity = { workspaceUserId?: number | string; workspaceCommunityId?: number | string }
type RecentStorage = Pick<Storage, 'getItem' | 'setItem'>
function recentKey(identity: WorkspaceIdentity) {
  return identity.workspaceUserId && identity.workspaceCommunityId
    ? `heritage-workspace-recent:${identity.workspaceCommunityId}:${identity.workspaceUserId}` : null
}
export function openedWorkspaceServices(storage: RecentStorage, identity: WorkspaceIdentity): string[] {
  const key = recentKey(identity)
  if (!key) return []
  try {
    const value = JSON.parse(storage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter(id => typeof id === 'string' && /^[\w.:-]{1,128}$/.test(id)).slice(0,8) : []
  } catch { return [] }
}
export function rememberWorkspaceService(storage: RecentStorage, identity: WorkspaceIdentity, syncId: string) {
  const key = recentKey(identity)
  if (!key || !/^[\w.:-]{1,128}$/.test(syncId)) return
  try { storage.setItem(key, JSON.stringify([syncId, ...openedWorkspaceServices(storage,identity).filter(id => id !== syncId)].slice(0,8))) } catch { /* Planning also works with browser storage disabled. */ }
}
export function workspaceHomeServices(services: WorkspaceService[], opened: string[]) {
  const active = services.filter(service => ['planning','ready'].includes(service.status)).sort((a,b) =>
    (Date.parse(b.changedAt) || 0) - (Date.parse(a.changedAt) || 0) || b.syncId.localeCompare(a.syncId))
  const visited = [...new Set(opened)].map(id => active.find(service => service.syncId === id)).filter((value): value is WorkspaceService => Boolean(value))
  const continued = visited[0] || active[0] || null
  const ordered = [...visited, ...active.filter(service => !visited.some(recent => recent.syncId === service.syncId))]
  return { continued, personal: Boolean(visited[0]), recent: ordered.filter(service => service.syncId !== continued?.syncId).slice(0,3) }
}
export const workspaceServiceHref = (syncId: string) => `/admin/plan-service?service=${encodeURIComponent(syncId)}`
