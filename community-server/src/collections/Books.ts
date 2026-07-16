import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'

export const Books: CollectionConfig = {
  slug: 'books',
  admin: { useAsTitle: 'title', group: 'Content' },
  access: { read: readPublishedOrMember, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  fields: [
    ...communityContentFields,
    { name: 'author', type: 'text', required: true },
    { name: 'publishedYear', type: 'number' },
    { name: 'body', type: 'richText' },
    { name: 'files', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'license', type: 'text' },
  ],
}
