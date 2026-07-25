import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'
import { fillContentSlug } from '@/lib/contentAdmin'

export const Commentaries: CollectionConfig = {
  slug: 'commentaries',
  indexes: [{ fields: ['community', 'slug'], unique: true }],
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    description: 'Bible notes attached to a book, chapter, verse, or verse range.',
    defaultColumns: ['title', 'book', 'chapter', 'verseStart', 'status'],
    listSearchableFields: ['title', 'author', 'book'],
    hideAPIURL: true,
  },
  access: { read: readPublishedOrMember, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  hooks: { beforeValidate: [fillContentSlug] },
  fields: [
    ...communityContentFields,
    { name: 'author', type: 'text', required: true },
    { name: 'book', label: 'Bible book', type: 'text', required: true, index: true },
    { name: 'chapter', label: 'Chapter', type: 'number', min: 1, index: true },
    { name: 'verseStart', label: 'Starting verse', type: 'number', min: 1 },
    { name: 'verseEnd', label: 'Ending verse', type: 'number', min: 1 },
    { name: 'body', label: 'Commentary text', type: 'richText', required: true },
    { name: 'license', label: 'License or permission', type: 'text', admin: { position: 'sidebar' } },
  ],
}
