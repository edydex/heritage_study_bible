import type { Where } from 'payload'

export function archivedSongLibraryView(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 12) return false
  const where = value as Record<string, any>
  return where.status?.equals === 'archived'
    || (Array.isArray(where.and) && where.and.some((part: unknown) => archivedSongLibraryView(part, depth + 1)))
}

export function songLibraryBaseFilter(where: unknown): Where {
  return { status: archivedSongLibraryView(where) ? { equals: 'archived' } : { not_equals: 'archived' } }
}

/** Replace only the library's active/archive condition; retain other filters. */
export function songLibraryViewWhere(value: unknown, archived: boolean): Where {
  const strip = (value: unknown, depth = 0): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 12) return null
    const where = { ...value } as Record<string, any>
    if (Object.keys(where).length === 1 && where.status && Object.keys(where.status).length === 1
      && (where.status.equals === 'archived' || where.status.not_equals === 'archived')) return null
    if (Array.isArray(where.and)) {
      const parts = where.and.map((part: unknown) => strip(part, depth + 1)).filter(Boolean)
      if (parts.length === 1 && Object.keys(where).length === 1) return parts[0]
      if (parts.length) where.and = parts
      else delete where.and
    }
    return Object.keys(where).length ? where : null
  }
  const remaining = strip(value) as Where | null
  const status = songLibraryBaseFilter(archived ? {status:{equals:'archived'}} : null)
  return remaining ? {and:[remaining,status]} : status
}
