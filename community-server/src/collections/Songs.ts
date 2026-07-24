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
    description: 'Bilingual song listings, lyrics, chords, files, and a plain-language rights record.',
    defaultColumns: ['title', 'russianTitle', 'rightsStatus', 'status', 'updatedAt'],
    listSearchableFields: ['title', 'russianTitle', 'alternateTitles', 'authors'],
    components: { beforeList: ['@/components/SongListGuide'] },
    hideAPIURL: true,
  },
  access: { read: readPublishedOrMember, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  hooks: { beforeValidate: [fillContentSlug] },
  fields: [
    ...communityContentFields.filter(field => (
      'name' in field && ['community', 'status', 'slug'].includes(String(field.name))
    )),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Listing',
          description: 'The information people use to find this song.',
          fields: [
            ...communityContentFields.filter(field => (
              'name' in field && ['title', 'description'].includes(String(field.name))
            )),
            { name: 'russianTitle', label: 'Russian title', type: 'text' },
            {
              name: 'alternateTitles',
              label: 'Other titles people may search',
              type: 'text',
              hasMany: true,
              admin: { description: 'Optional. Add one alternate title per row.' },
            },
            { name: 'authors', label: 'Writers/authors', type: 'text', hasMany: true },
          ],
        },
        {
          label: 'English',
          description: 'English words and the chord sheet, when your church is permitted to publish them.',
          fields: [
            { name: 'lyrics', label: 'English lyrics', type: 'textarea' },
            {
              name: 'chordSheet',
              label: 'English chord sheet',
              type: 'textarea',
              admin: { description: 'Optional ChordPro-compatible guitar chords.' },
            },
          ],
        },
        {
          label: 'Russian',
          description: 'A translation has its own source. Record what your church knows; Heritage does not block publication.',
          fields: [
            { name: 'russianLyrics', label: 'Russian lyrics', type: 'textarea' },
            {
              name: 'russianChordSheet',
              label: 'Russian chord sheet',
              type: 'textarea',
              admin: { description: 'Optional ChordPro-compatible guitar chords.' },
            },
          ],
        },
        {
          label: 'Music & files',
          fields: [
            { name: 'key', label: 'Usual key', type: 'text' },
            { name: 'tempo', label: 'Tempo (BPM)', type: 'number', min: 1 },
            { name: 'choirScores', label: 'Choir scores', type: 'upload', relationTo: 'media', hasMany: true },
            { name: 'recordings', label: 'Recordings', type: 'upload', relationTo: 'media', hasMany: true },
          ],
        },
        {
          label: 'Rights & source',
          description: 'Keep the church’s source and permission notes here. These fields inform people; they do not prevent publishing.',
          fields: [
            {
              name: 'rightsStatus',
              label: 'What does the church know about this version?',
              type: 'select',
              required: true,
              defaultValue: 'needs-review',
              index: true,
              options: [
                { label: 'Needs review', value: 'needs-review' },
                { label: 'Listing only — no words or music included', value: 'metadata-only' },
                { label: 'Public domain', value: 'public-domain' },
                { label: 'Covered by our church license', value: 'licensed' },
                { label: 'Direct permission received', value: 'permission-granted' },
                { label: 'Community/oral translation — explain below', value: 'community-translation' },
                { label: 'Mixed — explain below', value: 'mixed' },
              ],
              admin: { description: 'Informational only. Choosing an option does not block or unlock publishing.' },
            },
            { name: 'ccliNumber', label: 'CCLI song number', type: 'text' },
            { name: 'license', label: 'License or permission name', type: 'text' },
            { name: 'copyright', label: 'Copyright notice (if known)', type: 'textarea' },
            {
              name: 'rightsNotes',
              label: 'Source / translator / permission notes',
              type: 'textarea',
              admin: { description: 'For example: who translated it, where the church received it, or why it is believed to be public domain.' },
            },
            { name: 'sourceUrl', label: 'Song/source information URL', type: 'text' },
            { name: 'permissionUrl', label: 'License or permission evidence URL', type: 'text' },
          ],
        },
      ],
    },
  ],
}
