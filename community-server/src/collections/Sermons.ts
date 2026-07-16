import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'

export const Sermons: CollectionConfig = {
  slug: 'sermons',
  admin: { useAsTitle: 'title', group: 'Content' },
  access: { read: readPublishedOrMember, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  fields: [
    ...communityContentFields,
    { name: 'speaker', type: 'text', required: true },
    { name: 'preachedAt', type: 'date', required: true },
    { name: 'scripture', type: 'text', hasMany: true },
    { name: 'transcript', type: 'textarea' },
    { name: 'media', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'series', type: 'text' },
  ],
}
