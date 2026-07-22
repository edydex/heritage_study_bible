import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'
import { fillContentSlug } from '@/lib/contentAdmin'

export const Songs: CollectionConfig = {
  slug: 'songs',
  indexes: [{ fields: ['community', 'slug'], unique: true }],
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    description: 'Lyrics, authorship, musical details, choir scores, and recordings for congregational songs.',
    defaultColumns: ['title', 'key', 'status', 'updatedAt'],
    listSearchableFields: ['title', 'authors'],
    hideAPIURL: true,
  },
  access: { read: readPublishedOrMember, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  hooks: { beforeValidate: [fillContentSlug] },
  fields: [
    ...communityContentFields,
    { name: 'authors', label: 'Writers/authors', type: 'text', hasMany: true },
    { name: 'lyrics', type: 'textarea', required: true },
    { name: 'chordSheet', label: 'Chord sheet', type: 'textarea', admin: { description: 'Optional ChordPro-compatible guitar chords.' } },
    { name: 'key', type: 'text' },
    { name: 'tempo', label: 'Tempo (BPM)', type: 'number', min: 1 },
    { name: 'choirScores', label: 'Choir scores', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'recordings', label: 'Recordings', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'copyright', label: 'Copyright/permission note', type: 'text' },
  ],
}
