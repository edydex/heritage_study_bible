import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'
import { fillContentSlug } from '@/lib/contentAdmin'

export const Sermons: CollectionConfig = {
  slug: 'sermons',
  indexes: [{ fields: ['community', 'slug'], unique: true }],
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    description: 'Messages with a speaker, date, Scripture references, transcript, and optional recordings or files.',
    defaultColumns: ['title', 'speaker', 'preachedAt', 'status', 'updatedAt'],
    listSearchableFields: ['title', 'speaker', 'series'],
    hideAPIURL: true,
  },
  access: { read: readPublishedOrMember, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  hooks: { beforeValidate: [fillContentSlug] },
  fields: [
    ...communityContentFields,
    { name: 'speaker', label: 'Speaker', type: 'text', required: true },
    { name: 'preachedAt', label: 'Date preached', type: 'date', required: true },
    { name: 'scripture', label: 'Bible passages', type: 'text', hasMany: true, admin: { description: 'For example: John 3:16-21.' } },
    { name: 'transcript', label: 'Transcript', type: 'textarea' },
    { name: 'media', label: 'Recordings and files', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'series', label: 'Series', type: 'text' },
  ],
}
