import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'

export const Commentaries: CollectionConfig = {
  slug: 'commentaries',
  admin: { useAsTitle: 'title', group: 'Content' },
  access: { read: readPublishedOrMember, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  fields: [
    ...communityContentFields,
    { name: 'author', type: 'text', required: true },
    { name: 'book', type: 'text', required: true, index: true },
    { name: 'chapter', type: 'number', min: 1, index: true },
    { name: 'verseStart', type: 'number', min: 1 },
    { name: 'verseEnd', type: 'number', min: 1 },
    { name: 'body', type: 'richText', required: true },
    { name: 'license', type: 'text' },
  ],
}
