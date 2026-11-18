import type { CollectionConfig } from 'payload'
import { manageCommunityContent, updateRelationAsSystemAdmin } from '@/access'
import { REGISTRATION_STATUSES } from '@/lib/eventRegistration'

// Sign-ups from public event pages. Visitors never use this collection's API:
// they submit through /api/community/calendar/events/:id/registration, which
// validates against the event's form and enforces capacity. Church managers
// can read, mark paid, change status or delete.
export const EventRegistrations: CollectionConfig = {
  slug: 'event-registrations',
  labels: { singular: { en: 'Event sign-up', ru: 'Регистрация' }, plural: { en: 'Event sign-ups', ru: 'Регистрации' } },
  admin: {
    useAsTitle: 'name',
    group: 'Community',
    description: 'People who signed up on an event page. Mark payments here or from the event’s Sign-ups panel.',
    defaultColumns: ['name', 'event', 'status', 'partySize', 'paid', 'createdAt'],
    listSearchableFields: ['name', 'email', 'phone'],
    hideAPIURL: true,
  },
  access: {
    read: manageCommunityContent,
    create: () => false,
    update: manageCommunityContent,
    delete: manageCommunityContent,
  },
  defaultSort: ['-createdAt'],
  fields: [
    {
      name: 'community',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'confirmed',
      index: true,
      options: REGISTRATION_STATUSES.map(value => ({
        value,
        label: { confirmed: { en: 'Confirmed', ru: 'Подтверждена' }, waitlisted: { en: 'Waitlist', ru: 'Лист ожидания' }, cancelled: { en: 'Cancelled', ru: 'Отменена' } }[value],
      })),
    },
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'phone', type: 'text' },
    { name: 'partySize', label: { en: 'People', ru: 'Человек' }, type: 'number', required: true, min: 1, defaultValue: 1 },
    { name: 'answers', type: 'json', admin: { readOnly: true } },
    { name: 'amountDueCents', label: { en: 'Amount due (cents)', ru: 'К оплате (центы)' }, type: 'number', min: 0, admin: { readOnly: true } },
    { name: 'paid', type: 'checkbox', defaultValue: false },
    { name: 'paidNote', label: { en: 'Payment note', ru: 'Заметка об оплате' }, type: 'text', admin: { description: 'For example: Zelle on Nov 20, or cash at the door.' } },
    { name: 'user', label: { en: 'Signed-in member', ru: 'Участник' }, type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'language', type: 'text', admin: { readOnly: true } },
    { name: 'manageTokenHash', type: 'text', index: true, unique: true, hidden: true },
    { name: 'confirmationSentAt', type: 'date', admin: { readOnly: true } },
    { name: 'cancelledAt', type: 'date', admin: { readOnly: true } },
  ],
}
