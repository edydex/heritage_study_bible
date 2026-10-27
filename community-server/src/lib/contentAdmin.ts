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

/** A Russian-only song still needs a usable address without a made-up title. */
export function slugifySongTitle(value: unknown) {
  const letters: Record<string, string> = {
    а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'yo', ж:'zh', з:'z', и:'i', й:'y',
    к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
    х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya',
  }
  return slugifyContentTitle(String(value || '').toLowerCase().replace(/[а-яё]/g, letter => letters[letter]))
}

export const fillSongSlug: CollectionBeforeValidateHook = ({data, originalDoc}) => {
  if (!data) return data
  const currentSlug = String(data.slug ?? originalDoc?.slug ?? '').trim()
  return { ...data, slug: currentSlug || slugifySongTitle(data.title ?? originalDoc?.title ?? data.russianTitle) }
}

export const fillContentSlug: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const currentSlug = String(data.slug ?? originalDoc?.slug ?? '').trim()
  if (currentSlug) return { ...data, slug: currentSlug }
  return { ...data, slug: slugifyContentTitle(data.title ?? originalDoc?.title) }
}
