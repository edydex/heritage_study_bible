export const churchWorkspaceLinks = [
  { href: '/admin', label: 'Workspace home' },
  { href: '/admin/plan-service', label: 'Plan a service' },
  { href: '/admin/live-translation', label: 'Live translation' },
  { href: '/admin/prepare-sermon', label: 'Prepare a sermon' },
  { href: '/admin/sermon-publications', label: 'Publish sermons' },
  { href: '/admin/collections/songs', label: 'Song library' },
  { href: '/admin/collections/sermons', label: 'Sermon library' },
  { href: '/admin/collections/media', label: 'Media library' },
] as const

export function isWorkspaceLinkActive(pathname: string, href: string) {
  return pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`))
}
