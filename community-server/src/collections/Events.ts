import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readMemberCommunityContent, updateRelationAsSystemAdmin } from '@/access'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    group: 'Community',
    description: 'Church calendar items shown to signed-in members, with optional RSVP buttons and reminders.',
    defaultColumns: ['title', 'startsAt', 'location', 'rsvpEnabled', 'cancelled'],
    listSearchableFields: ['title', 'location'],
    hideAPIURL: true,
  },
  access: {
    read: readMemberCommunityContent,
    create: createCommunityContent,
    update: manageCommunityContent,
    delete: manageCommunityContent,
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
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'startsAt', label: 'Starts', type: 'date', required: true, index: true },
    { name: 'endsAt', label: 'Ends', type: 'date' },
    { name: 'timeZone', label: 'Time zone', type: 'text', defaultValue: 'UTC', required: true, admin: { description: 'For example: America/Los_Angeles.' } },
    { name: 'location', type: 'text' },
    { name: 'url', type: 'text' },
    { name: 'rsvpEnabled', label: 'Let members RSVP', type: 'checkbox', defaultValue: true },
    { name: 'defaultReminderMinutes', label: 'Default reminder (minutes before)', type: 'number', min: 0, defaultValue: 60 },
    { name: 'cancelled', label: 'Event is cancelled', type: 'checkbox', defaultValue: false },
  ],
}
