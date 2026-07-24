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
          description: 'A translation has its own rights. Add it when your church has confirmed it may publish it.',
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
          label: 'Rights',
          description: 'A useful record for the church. Heritage does not make the publishing decision for you.',
          fields: [
            {
              name: 'rightsStatus',
              label: 'How may the church use this?',
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
                { label: 'Mixed — explain below', value: 'mixed' },
              ],
              admin: { description: 'Informational only. This does not block publishing.' },
            },
            { name: 'ccliNumber', label: 'CCLI song number', type: 'text' },
            { name: 'license', label: 'License or permission name', type: 'text' },
            { name: 'copyright', label: 'Copyright notice', type: 'textarea' },
            { name: 'rightsNotes', label: 'What the church checked', type: 'textarea' },
            { name: 'sourceUrl', label: 'Song/source information URL', type: 'text' },
            { name: 'permissionUrl', label: 'License or permission evidence URL', type: 'text' },
          ],
        },
      ],
    },
  ],
}
