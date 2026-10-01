import typography from '../../packages/service-core/node/services/project/SlideTypography.js'
import type { CollectionConfig, Field } from 'payload'
import { captureSongPublicationIntent, prepareSongPublication, withdrawSongPublicLinks } from '@/lib/songPublication'
import { createCommunityContent, manageCommunityContent, readSongsByVisibility } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'
import { fillContentSlug } from '@/lib/contentAdmin'
import { assignSongCommunity } from '@/lib/songEditor'
import { prepareSongTags, sortSongLibrary } from '@/lib/songTags'
import { normalizeSyncDocuments } from '@/lib/syncShowProtocol'
import {
  enforceSongMemberSharingMutation,
  prepareSongSyncFields,
} from '@/lib/syncShowSongHooks'

export const Songs: CollectionConfig = {
  slug: 'songs',
  // List cells need the archive state even when this column is not displayed.
  forceSelect: { status: true },
  indexes: [
    { fields: ['community', 'slug'], unique: true },
    { fields: ['community', 'syncId'], unique: true },
  ],
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    description: { en: 'Start with the titles, lyrics and authors. Chords and other details are optional.', ru: 'Начните с названий, текста и авторов. Аккорды и остальные сведения — по желанию.' },
    defaultColumns: ['title', 'russianTitle', 'tags', 'defaultSongLanguage', 'songbookVisibility', 'updatedAt'],
    listSearchableFields: ['title', 'russianTitle', 'alternateTitles', 'authors'],
    components: { beforeList: ['@/components/SongListGuide'] },
    hideAPIURL: true,
  },
  defaultSort: ['title', 'id'],
  access: {
    read: readSongsByVisibility,
    create: createCommunityContent,
    update: manageCommunityContent,
    // Sync clients and administrators archive or make a song private. Hard
    // deletion would make offline conflict resolution ambiguous.
    delete: () => false,
  },
  hooks: {
    beforeOperation: [captureSongPublicationIntent, sortSongLibrary],
    beforeChange: [prepareSongTags, prepareSongPublication],
    afterChange: [withdrawSongPublicLinks],
    beforeValidate: [
      assignSongCommunity,
      fillContentSlug,
      enforceSongMemberSharingMutation,
      prepareSongSyncFields,
    ],
  },
  fields: [
    {name:'projectionStyle',type:'json',label:'Saved slide layout',admin:{hidden:true,description:'Font size and alignment reused when adding this song to a service.'},
      validate:(value:any)=>{try {if(value)typography.normalizeTextStyle(value);return true}catch{return 'Choose a valid font size and alignment in Service Planner.'}}},
    {
      name: 'tagSortKey', type: 'text', hidden: true, index: true,
      access: { create: () => false, update: () => false },
    },
    {
      name: 'songbookVisibility', label: 'Songbook publication', type: 'select',
      required: true, defaultValue: 'private', index: true,
      options: [
        { label: 'Published', value: 'published' },
        { label: 'Unlisted', value: 'unlisted' },
        { label: 'Private', value: 'private' },
      ],
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/SongPublicationField',
          Cell: '@/components/SongPublicationCell',
        },
        description: 'Published: church website and Heritage Songs. Unlisted: direct link only. Private: church workspace only.',
      },
    },
    {
      name: 'songbookContent', type: 'json', hidden: true,
      access: { create: () => false, update: () => false },
    },
    ...communityContentFields.filter(field => 'name' in field && ['community', 'slug'].includes(String(field.name))).map((field): Field => {
      if (field.type === 'relationship' && field.name === 'community') return { ...field, admin: { ...field.admin, hidden: true } } as Field
      return { ...field, admin: { ...field.admin, components: { Field: '@/components/SongSlugField' } } } as Field
    }),
    {
      name: 'status', label: 'Archive state', type: 'select', required: true, defaultValue: 'draft', index: true,
      options: [{ label: 'Active', value: 'draft' }, { label: 'Active (member sharing)', value: 'published' }, { label: 'Archived', value: 'archived' }],
      admin: { hidden: true, disableListColumn: true, disableBulkEdit: true },
    },
    {
      name: 'syncId',
      label: 'Sync identity',
      type: 'text',
      required: true,
      index: true,
      access: { update: () => false },
      admin: {
        hidden: true, disableListColumn: true, disableBulkEdit: true,
      },
    },
    {
      name: 'visibility',
      label: 'Retired member visibility',
      type: 'select',
      required: true,
      defaultValue: 'private',
      index: true,
      options: [
        { label: 'Private — church managers only', value: 'private' },
        { label: 'Public to signed-in church members', value: 'public' },
        { label: 'Scheduled — private until the set time', value: 'scheduled-public' },
      ],
      admin: {
        hidden: true, disableListColumn: true, disableBulkEdit: true,
      },
    },
    {
      name: 'publishAt',
      label: 'Become visible at',
      type: 'date',
      index: true,
      admin: { hidden: true, disableListColumn: true, disableBulkEdit: true },
      validate: (value, { siblingData }) => (
        (siblingData as Record<string, unknown> | undefined)?.visibility !== 'scheduled-public'
          || (value && Number.isFinite(Date.parse(String(value))))
          ? true
          : 'Choose a valid publication time for a scheduled song.'
      ),
    },
    {
      name: 'syncVersion',
      label: 'Sync version',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 1,
      index: true,
      admin: { hidden: true, disableListColumn: true, disableBulkEdit: true },
    },
    {
      name: 'syncDocuments',
      type: 'json',
      required: true,
      defaultValue: [],
      admin: { hidden: true },
      validate: value => {
        try {
          normalizeSyncDocuments(value)
          return true
        } catch (error) {
          return error instanceof Error ? error.message : 'Invalid SyncShow song documents.'
        }
      },
    },
    {
      name: 'memberShareReceiptId',
      type: 'text',
      index: true,
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareReceiptVersion',
      type: 'number',
      min: 1,
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberSharePreviousSongSyncVersion',
      type: 'number',
      min: 1,
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareSongSyncVersion',
      type: 'number',
      min: 2,
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareFamilyRevision',
      type: 'text',
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareReviewRevision',
      type: 'text',
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareVisibility',
      type: 'text',
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberSharePublishAt',
      type: 'date',
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareTimeZone',
      type: 'text',
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareValidThrough',
      type: 'date',
      index: true,
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareReviewedAt',
      type: 'date',
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareConfirmedAt',
      type: 'date',
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareRequestRevision',
      type: 'text',
      hidden: true,
      access: { update: () => false },
    },
    {
      name: 'memberShareReceiptRevision',
      type: 'text',
      hidden: true,
      access: { update: () => false },
    },
    {
      type: 'row', admin: { className: 'heritage-song-title-row' }, fields: [
        { name: 'russianTitle', label: { en: 'Russian title', ru: 'Название на русском' }, type: 'text', admin: { width: '50%', components: { Cell: '@/components/SongTitleCell' } } },
        { name: 'title', label: { en: 'English title', ru: 'Название на английском' }, type: 'text', required: true, admin: { width: '50%', components: { Cell: '@/components/SongTitleCell' } } },
      ],
    },
    {
      type: 'row', admin: { className: 'heritage-song-lyrics-row' }, fields: [
        { name: 'russianLyrics', label: { en: 'Russian lyrics', ru: 'Текст на русском' }, type: 'textarea', admin: { width: '50%', description: { en: 'Blank lines separate slides. Write Припев above its words; repeat it later with Припев on its own.', ru: 'Пустая строка разделяет слайды. Напишите «Припев» перед его словами; для повтора укажите «Припев» отдельно.' }, components: { Field: '@/components/SongLyricsField' } } },
        { name: 'lyrics', label: { en: 'English lyrics', ru: 'Текст на английском' }, type: 'textarea', admin: { width: '50%', description: { en: 'Blank lines separate slides. Write Chorus above its words; repeat it later with Chorus on its own.', ru: 'Пустая строка разделяет слайды. Напишите «Chorus» перед его словами; для повтора укажите «Chorus» отдельно.' }, components: { Field: '@/components/SongLyricsField' } } },
      ],
    },
    { name: 'authors', label: { en: 'Authors', ru: 'Авторы' }, type: 'text', hasMany: true, admin: { placeholder: { en: 'Type a name, then press Enter', ru: 'Введите имя и нажмите Enter' } } },
    {
      type: 'row', admin: { components: { Field: '@/components/SongChordsRow' } }, fields: [
        { name: 'russianChordSheet', label: { en: 'Russian chord sheet', ru: 'Аккорды на русском' }, type: 'textarea', admin: { width: '50%', components: { Field: '@/components/SongLyricsField' } } },
        { name: 'chordSheet', label: { en: 'English chord sheet', ru: 'Аккорды на английском' }, type: 'textarea', admin: { width: '50%', components: { Field: '@/components/SongLyricsField' } } },
      ],
    },
    {
      type: 'collapsible', label: { en: 'More', ru: 'Ещё' }, admin: { initCollapsed: true, className: 'heritage-song-more' }, fields: [
        { name: 'description', label: 'Short description', type: 'textarea' },
        { name: 'alternateTitles', label: 'Other titles people may search', type: 'text', hasMany: true },
        { name: 'defaultSongLanguage', label: 'Default song language', type: 'select', required: true, defaultValue: 'ru',
          options: [{ label: 'Russian', value: 'ru' }, { label: 'English', value: 'en' }],
          admin: { components: { Cell: '@/components/SongLanguageCell' }, description: 'The primary language when adding this song to a service. You can change it per service.' } },
        { name: 'tags', label: 'Tags', type: 'select', hasMany: true, index: true,
          options: [{ label: 'Solo', value: 'solo' }, { label: 'Choir', value: 'choir' }, { label: 'Communal', value: 'communal' }] },
        { type: 'row', fields: [
          { name: 'key', label: 'Usual key', type: 'text', admin: { width: '50%' } },
          { name: 'tempo', label: 'Tempo (BPM)', type: 'number', min: 1, admin: { width: '50%' } },
        ] },
        { name: 'choirScores', label: 'Choir scores', type: 'upload', relationTo: 'media', hasMany: true },
        { name: 'recordings', label: 'Recordings', type: 'upload', relationTo: 'media', hasMany: true },
        { type: 'collapsible', label: 'Source & permission notes', admin: { initCollapsed: true }, fields: [
          { name: 'rightsStatus', label: 'What does the church know about this version?', type: 'select', required: true, defaultValue: 'needs-review', index: true,
            options: [
              { label: 'Needs review', value: 'needs-review' },
              { label: 'Listing only — no words or music included', value: 'metadata-only' },
              { label: 'Public domain', value: 'public-domain' },
              { label: 'Covered by our church license', value: 'licensed' },
              { label: 'Direct permission received', value: 'permission-granted' },
              { label: 'Community/oral translation — explain below', value: 'community-translation' },
              { label: 'Mixed — explain below', value: 'mixed' },
            ], admin: { description: 'Optional context for your church. These notes do not block publication.' } },
          { name: 'ccliNumber', label: 'CCLI song number', type: 'text' },
          { name: 'license', label: 'License or permission name', type: 'text' },
          { name: 'copyright', label: 'Copyright notice (if known)', type: 'textarea' },
          { name: 'rightsNotes', label: 'Source / translator / permission notes', type: 'textarea' },
          { name: 'sourceUrl', label: 'Song/source information URL', type: 'text' },
          { name: 'permissionUrl', label: 'License or permission evidence URL', type: 'text' },
        ] },
      ],
    },
  ],
}
