import type { CollectionBeforeValidateHook } from 'payload'

export function slugifyContentTitle(value: unknown) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export const fillContentSlug: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const currentSlug = String(data.slug ?? originalDoc?.slug ?? '').trim()
  if (currentSlug) return { ...data, slug: currentSlug }
  return { ...data, slug: slugifyContentTitle(data.title ?? originalDoc?.title) }
}
