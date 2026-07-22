import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'
import { fillContentSlug } from '@/lib/contentAdmin'

export const Books: CollectionConfig = {
  slug: 'books',
  indexes: [{ fields: ['community', 'slug'], unique: true }],
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    description: 'Readable books and study resources, with optional downloadable files.',
    defaultColumns: ['title', 'author', 'publishedYear', 'status', 'updatedAt'],
    listSearchableFields: ['title', 'author'],
    hideAPIURL: true,
  },
  access: { read: readPublishedOrMember, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  hooks: { beforeValidate: [fillContentSlug] },
  fields: [
    ...communityContentFields,
    { name: 'author', type: 'text', required: true },
    { name: 'publishedYear', label: 'Year published', type: 'number' },
    { name: 'body', label: 'Book text', type: 'richText' },
    { name: 'files', label: 'Downloadable files', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'license', label: 'License or permission', type: 'text', admin: { position: 'sidebar' } },
  ],
}
