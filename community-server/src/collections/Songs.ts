import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'

export const Songs: CollectionConfig = {
  slug: 'songs',
  admin: { useAsTitle: 'title', group: 'Content' },
  access: { read: readPublishedOrMember, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  fields: [
    ...communityContentFields,
    { name: 'authors', type: 'text', hasMany: true },
    { name: 'lyrics', type: 'textarea', required: true },
    { name: 'chordSheet', type: 'textarea', admin: { description: 'ChordPro-compatible guitar chords.' } },
    { name: 'key', type: 'text' },
    { name: 'tempo', type: 'number', min: 1 },
    { name: 'choirScores', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'recordings', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'copyright', type: 'text' },
  ],
}
