// Only coarse screen names reach the activity store. URLs, document IDs, search
// queries and user-authored text never become activity properties.
export const WORKSPACE_SCREENS = {
  home: 'Workspace home', planner: 'Service Planner', sermon: 'Sermon preparation',
  publication: 'Sermon publication', songs: 'Song library', people: 'People',
  translation: 'Live translation', media: 'Media library', scripture: 'Bible translations',
  library: 'Resource library', account: 'Account',
} as const
export type WorkspaceScreen = keyof typeof WORKSPACE_SCREENS
export const WORKSPACE_IDLE_MS = 5 * 60 * 1000
export function workspaceScreen(pathname: string): WorkspaceScreen | null {
  if (!/^\/admin(?:\/|$)/.test(pathname)) return null
  if (/^\/admin\/(login|logout|forgot|reset|create-first-user)(\/|$)/.test(pathname)) return null
  if (pathname === '/admin' || pathname === '/admin/') return 'home'
  if (pathname.startsWith('/admin/plan-service')) return 'planner'
  if (pathname.startsWith('/admin/prepare-sermon')) return 'sermon'
  if (pathname.startsWith('/admin/sermon-publications')) return 'publication'
  if (pathname.startsWith('/admin/collections/songs')) return 'songs'
  if (pathname.startsWith('/admin/people') || pathname.startsWith('/admin/collections/memberships')) return 'people'
  if (pathname.startsWith('/admin/live-translation')) return 'translation'
  if (pathname.startsWith('/admin/collections/media')) return 'media'
  if (pathname.startsWith('/admin/bible-translations')) return 'scripture'
  if (pathname.startsWith('/admin/account')) return 'account'
  return 'library'
}
export function workspaceIsActive(visible: boolean, lastInteraction: number, now: number) {
  return visible && now - lastInteraction >= 0 && now - lastInteraction < WORKSPACE_IDLE_MS
}
