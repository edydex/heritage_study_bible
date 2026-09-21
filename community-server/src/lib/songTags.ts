import type { CollectionBeforeChangeHook, CollectionBeforeOperationHook } from 'payload'

export const SONG_TAGS = ['choir', 'communal', 'solo'] as const
export const normalizeSongTags = (value: unknown) => SONG_TAGS.filter(tag => Array.isArray(value) && value.includes(tag))

export const prepareSongTags: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const tags = normalizeSongTags(data.tags ?? originalDoc?.tags)
  return { ...data, tags, tagSortKey: tags.join(',') || '~' }
}

export const sortSongLibrary: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation !== 'read') return args
  const request = args as typeof args & { sort?: string | string[] }
  const sort = Array.isArray(request.sort) ? request.sort : request.sort ? request.sort.split(',') : ['title']
  const fields = sort.map(field => field === 'tags' ? 'tagSortKey' : field === '-tags' ? '-tagSortKey' : field)
  if (!fields.some(field => field.replace(/^-/, '') === 'title')) fields.push('title')
  if (!fields.some(field => field.replace(/^-/, '') === 'id')) fields.push('id')
  request.sort = fields
  return args
}
