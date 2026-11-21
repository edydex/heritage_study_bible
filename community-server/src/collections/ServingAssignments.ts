import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, updateRelationAsSystemAdmin } from '@/access'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { ASSIGNMENT_STATUSES, NOTE_LIMIT } from '@/lib/serving'
import { prepareServingAssignment } from '@/lib/servingHooks'

// One person in one position on one date of a calendar service. Managers
// schedule from the Serving screen; volunteers answer through their private link.
export const ServingAssignments: CollectionConfig = {
  slug: 'serving-assignments',
  labels: { singular: { en: 'Serving assignment', ru: 'Назначение' }, plural: { en: 'Serving schedule', ru: 'График служения' } },
  admin: {
    useAsTitle: 'position',
    group: 'People',
    defaultColumns: ['date', 'event', 'team', 'position', 'person', 'status'],
    hideAPIURL: true,
    components: { views: { list: { Component: '@/components/ServingListRedirect#default' } } },
  },
  defaultSort: ['date', 'id'],
  indexes: [{ fields: ['event', 'date', 'team', 'positionId', 'person'], unique: true }],
  access: { read: manageCommunityContent, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  hooks: { beforeChange: [prepareServingAssignment] },
  fields: [
    {
      name: 'community', type: 'relationship', relationTo: 'communities', required: true, index: true,
      defaultValue: async ({ req }) => getConfiguredCommunityId(req.payload),
      access: { update: updateRelationAsSystemAdmin },
      admin: { hidden: true },
    },
    { name: 'event', label: { en: 'Service', ru: 'Служение' }, type: 'relationship', relationTo: 'events', required: true, index: true },
    { name: 'date', label: { en: 'Date', ru: 'Дата' }, type: 'text', required: true, index: true,
      validate: (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) || 'Enter the date as YYYY-MM-DD.' },
    { name: 'team', label: { en: 'Team', ru: 'Команда' }, type: 'relationship', relationTo: 'teams', required: true, index: true },
    { name: 'positionId', type: 'text', required: true, admin: { hidden: true } },
    { name: 'position', label: { en: 'Position', ru: 'Роль' }, type: 'text', required: true, admin: { readOnly: true } },
    { name: 'person', label: { en: 'Person', ru: 'Человек' }, type: 'relationship', relationTo: 'people', required: true, index: true },
    {
      name: 'status', label: { en: 'Answer', ru: 'Ответ' }, type: 'select', required: true, defaultValue: 'pending', index: true,
      options: ASSIGNMENT_STATUSES.map(value => ({ value, label: {
        pending: { en: 'No answer yet', ru: 'Нет ответа' }, accepted: { en: 'Accepted', ru: 'Согласен(а)' }, declined: { en: 'Declined', ru: 'Отказ' },
      }[value] })),
    },
    { name: 'note', label: { en: 'Note from the volunteer', ru: 'Комментарий' }, type: 'text', maxLength: NOTE_LIMIT },
    { name: 'requestedAt', label: { en: 'Request sent', ru: 'Запрос отправлен' }, type: 'date', admin: { readOnly: true } },
    { name: 'respondedAt', label: { en: 'Answered', ru: 'Ответ получен' }, type: 'date', admin: { readOnly: true } },
    { name: 'scheduledBy', label: { en: 'Scheduled by', ru: 'Назначил(а)' }, type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
