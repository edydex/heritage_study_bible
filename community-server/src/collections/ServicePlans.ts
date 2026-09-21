import type { CollectionConfig, FieldAccess, FilterOptions, Where } from 'payload'
import {
  createCommunityContent,
  manageCommunityContent,
  updateRelationAsSystemAdmin,
} from '@/access'
import { CANONICAL_BIBLE_BOOKS } from '@/lib/syncshow/BibleRange'
import { prepareCommunityServicePlanFields } from '@/lib/syncshow/CommunityServicePlanEditor'

const denyClientWrite: FieldAccess = () => false
const lifecycleOptions = [
  {
    label: 'Draft — still being prepared',
    value: 'draft',
  },
  {
    label: 'Ready — reviewed for the service team',
    value: 'ready',
  },
  {
    label: 'Archived — completed or retained for history',
    value: 'archived',
  },
  {
    label: 'Cancelled — service will not take place',
    value: 'cancelled',
  },
]

const technicalFieldAccess = {
  create: denyClientWrite,
  update: denyClientWrite,
}

const canonicalSermonsForPlan: FilterOptions = ({ data }) => {
  const rawCommunity = data?.community
  const rawId = rawCommunity && typeof rawCommunity === 'object' && 'id' in rawCommunity
    ? rawCommunity.id
    : rawCommunity
  const communityId = Number(rawId)
  if (!Number.isSafeInteger(communityId) || communityId < 1) return false
  const where: Where = {
    and: [
      { syncId: { exists: true } },
      { syncArchived: { not_equals: true } },
      { community: { equals: communityId } },
    ],
  }
  return where
}

export const ServicePlans: CollectionConfig = {
  slug: 'service-plans',
  labels: {
    singular: 'Service plan',
    plural: 'Service plans',
  },
  indexes: [
    { fields: ['community', 'syncId'], unique: true },
    // Payload does not allow its implicit `id` in a configured compound
    // index. The endpoint still uses id as the deterministic tie-breaker.
    { fields: ['community', 'changedAt'] },
  ],
  admin: {
    useAsTitle: 'title',
    group: 'Planning',
    description: 'The ordered service outline SyncShow volunteers can open without changing it.',
    defaultColumns: [
      'title',
      'serviceDate',
      'startTime',
      'status',
      'changedAt',
    ],
    listSearchableFields: ['title'],
    hideAPIURL: true,
  },
  access: {
    read: manageCommunityContent,
    create: createCommunityContent,
    update: manageCommunityContent,
    // Archived and cancelled states preserve the stable identity SyncShow has
    // already seen. Plans are therefore never physically deleted.
    delete: () => false,
  },
  hooks: {
    beforeValidate: [prepareCommunityServicePlanFields],
  },
  fields: [
    {
      name: 'community',
      label: 'Church',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    {
      name: 'status',
      label: 'Planning status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: lifecycleOptions,
      admin: {
        position: 'sidebar',
        description: 'Ready means every selected song and sermon pin was checked against its current SyncShow revision.',
      },
    },
    {
      name: 'serviceDate',
      label: 'Service date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MMMM d, yyyy',
        },
      },
    },
    {
      name: 'startTime',
      label: 'Local start time',
      type: 'text',
      required: true,
      admin: {
        placeholder: '10:30',
        description: 'Use the venue’s local 24-hour time as HH:mm.',
      },
      validate: (value: unknown) => (
        /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))
          ? true
          : 'Enter local venue time as HH:mm, for example 10:30 or 18:00.'
      ),
    },
    {
      name: 'title',
      label: 'Service title',
      type: 'text',
      required: true,
      maxLength: 200,
      admin: {
        placeholder: 'Sunday Morning Service',
      },
    },
    {
      name: 'teamNotes',
      label: 'Notes for the service team',
      type: 'textarea',
      maxLength: 4000,
      defaultValue: '',
      admin: {
        description: 'Optional reminders such as communion, sound check, or volunteer handoff notes.',
      },
    },
    {
      name: 'entries',
      label: 'Order of service',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 500,
      labels: {
        singular: 'Service item',
        plural: 'Service items',
      },
      admin: {
        description: 'Add items in service order. Drag rows to reorder them.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'entryId',
          type: 'text',
          hidden: true,
          access: technicalFieldAccess,
        },
        {
          name: 'kind',
          label: 'Item type',
          type: 'select',
          required: true,
          options: [
            { label: 'Section heading', value: 'section' },
            { label: 'Song', value: 'song' },
            { label: 'Scripture reading', value: 'scripture' },
            { label: 'Sermon', value: 'sermon' },
          ],
        },
        {
          name: 'title',
          label: 'Display title',
          type: 'text',
          required: true,
          maxLength: 200,
          admin: {
            description: 'The label volunteers will see in SyncShow.',
          },
        },
        {
          name: 'song',
          type: 'relationship',
          relationTo: 'songs',
          admin: {
            condition: (_data, siblingData) => (
              (siblingData as Record<string, unknown> | undefined)?.kind === 'song'
            ),
            description: 'The saved plan pins this song’s exact current SyncShow version.',
          },
        },
        {
          name: 'sermon',
          type: 'relationship',
          relationTo: 'sermons',
          filterOptions: canonicalSermonsForPlan,
          admin: {
            condition: (_data, siblingData) => (
              (siblingData as Record<string, unknown> | undefined)?.kind === 'sermon'
            ),
            description: 'Only canonical SyncShow sermons can be used in a Ready plan.',
          },
        },
        {
          name: 'scripture',
          label: 'Scripture passage',
          type: 'group',
          admin: {
            condition: (_data, siblingData) => (
              (siblingData as Record<string, unknown> | undefined)?.kind === 'scripture'
            ),
          },
          fields: [
            {
              name: 'bookId',
              label: 'Book',
              type: 'select',
              required: true,
              options: CANONICAL_BIBLE_BOOKS.map(book => ({
                label: book.name,
                value: book.id,
              })),
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'startChapter',
                  label: 'Start chapter',
                  type: 'number',
                  required: true,
                  min: 1,
                },
                {
                  name: 'startVerse',
                  label: 'Start verse',
                  type: 'number',
                  required: true,
                  min: 1,
                },
                {
                  name: 'endChapter',
                  label: 'End chapter',
                  type: 'number',
                  required: true,
                  min: 1,
                },
                {
                  name: 'endVerse',
                  label: 'End verse',
                  type: 'number',
                  required: true,
                  min: 1,
                },
              ],
            },
            {
              name: 'translationId',
              label: 'Bible translation ID',
              type: 'text',
              required: true,
              defaultValue: 'BSB',
              maxLength: 32,
              admin: {
                description: 'For example BSB, ESV, KJV, or the church’s configured translation ID.',
              },
            },
            {
              name: 'sermonReading',
              label: 'Sermon reading link',
              type: 'group',
              admin: {
                description: 'Optionally link this congregational reading to the exact sermon later in this service. Leave both fields empty for an unrelated Scripture item.',
              },
              fields: [
                {
                  name: 'sermon',
                  label: 'Sermon later in this service',
                  type: 'relationship',
                  relationTo: 'sermons',
                  filterOptions: canonicalSermonsForPlan,
                  index: true,
                  admin: {
                    description: 'The saved plan resolves this relationship to one later sermon row by its stable row ID.',
                  },
                },
                {
                  name: 'referenceId',
                  label: 'Confirmed primary reference ID',
                  type: 'text',
                  maxLength: 128,
                  admin: {
                    description: 'Usually leave blank: a sermon with one confirmed primary passage is selected automatically. Enter its stable reference ID only when the sermon has several confirmed primary passages.',
                  },
                  validate: (value: unknown) => (
                    value === undefined
                    || value === null
                    || value === ''
                    || /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(String(value))
                      ? true
                      : 'Use the stable confirmed-primary reference ID shown on the sermon record.'
                  ),
                },
              ],
            },
          ],
        },
        {
          name: 'resolvedSyncId',
          type: 'text',
          hidden: true,
          access: technicalFieldAccess,
        },
        {
          name: 'resolvedSyncVersion',
          type: 'number',
          hidden: true,
          access: technicalFieldAccess,
        },
        {
          name: 'resolvedRevision',
          type: 'text',
          hidden: true,
          access: technicalFieldAccess,
        },
      ],
    },
    {
      name: 'syncId',
      type: 'text',
      required: true,
      index: true,
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'syncVersion',
      type: 'number',
      required: true,
      min: 1,
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'revision',
      type: 'text',
      required: true,
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'documentSource',
      type: 'textarea',
      required: true,
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'changedAt',
      type: 'date',
      required: true,
      index: true,
      hidden: true,
      access: technicalFieldAccess,
    },
  ],
}
