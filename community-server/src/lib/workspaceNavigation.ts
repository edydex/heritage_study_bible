export type WorkspacePath = '/admin' | '/admin/live-translation' | '/admin/plan-service' | '/admin/prepare-sermon' | '/admin/sermon-publications'
type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>

/** Return only to a known workspace page, retaining its selected service/sermon. */
export function workspaceSignInHref(path: WorkspacePath, searchParams?: SearchParams): string {
  const query = new URLSearchParams()
  const key = path === '/admin/live-translation' ? 'service' : path === '/admin/sermon-publications' ? 'sermon' : undefined
  const value = key ? searchParams?.[key] : undefined
  if (key && value !== undefined) {
    for (const item of typeof value === 'string' ? [value] : value) query.append(key, item)
  }
  const destination = `${path}${query.size ? `?${query}` : ''}`
  return `/admin/login?redirect=${encodeURIComponent(destination)}`
}

/** Authentication remains Payload's responsibility; API role checks still apply. */
export function workspaceSignInRedirect(user: unknown, path: WorkspacePath, searchParams?: SearchParams): string | null {
  return user ? null : workspaceSignInHref(path, searchParams)
}

export class TranslationAccessError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export function translationAccessProblem(cause: unknown): { message: string; signInRequired: boolean } {
  return {
    message: cause instanceof Error ? cause.message : 'Live translation is unavailable.',
    signInRequired: cause instanceof TranslationAccessError && cause.status === 401,
  }
}
