import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, updateRelationAsSystemAdmin } from '@/access'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { NOTE_LIMIT } from '@/lib/serving'
import { prepareServingBlockout } from '@/lib/servingHooks'

// Dates someone cannot serve. Managers add them; volunteers add their own
// through their private serving link.
export const ServingBlockouts: CollectionConfig = {
  slug: 'serving-blockouts',
  labels: { singular: { en: 'Away dates', ru: 'Отсутствие' }, plural: { en: 'Away dates', ru: 'Отсутствия' } },
  admin: {
    useAsTitle: 'startDate',
    group: 'People',
    defaultColumns: ['person', 'startDate', 'endDate', 'reason'],
    hideAPIURL: true,
    components: { views: { list: { Component: '@/components/ServingListRedirect#AwayListRedirect' } } },
  },
  defaultSort: ['startDate', 'id'],
  access: { read: manageCommunityContent, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  hooks: { beforeChange: [prepareServingBlockout] },
  fields: [
    {
      name: 'community', type: 'relationship', relationTo: 'communities', required: true, index: true,
      defaultValue: async ({ req }) => getConfiguredCommunityId(req.payload),
      access: { update: updateRelationAsSystemAdmin },
      admin: { hidden: true },
    },
    { name: 'person', label: { en: 'Person', ru: 'Человек' }, type: 'relationship', relationTo: 'people', required: true, index: true },
    { name: 'startDate', label: { en: 'First day', ru: 'Первый день' }, type: 'text', required: true, index: true,
      admin: { components: { Field: '@/components/DateOnlyField#default' } } },
    { name: 'endDate', label: { en: 'Last day', ru: 'Последний день' }, type: 'text', required: true, index: true,
      admin: { components: { Field: '@/components/DateOnlyField#default' } } },
    { name: 'reason', label: { en: 'Note (optional)', ru: 'Комментарий (необязательно)' }, type: 'text', maxLength: NOTE_LIMIT },
  ],
}
