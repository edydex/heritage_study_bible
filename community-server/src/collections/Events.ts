import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readMemberCommunityContent, updateRelationAsSystemAdmin } from '@/access'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: { useAsTitle: 'title', group: 'Community' },
  access: {
    read: readMemberCommunityContent,
    create: createCommunityContent,
    update: manageCommunityContent,
    delete: manageCommunityContent,
  },
  fields: [
    {
      name: 'community',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'startsAt', type: 'date', required: true, index: true },
    { name: 'endsAt', type: 'date' },
    { name: 'timeZone', type: 'text', defaultValue: 'UTC', required: true },
    { name: 'location', type: 'text' },
    { name: 'url', type: 'text' },
    { name: 'rsvpEnabled', type: 'checkbox', defaultValue: true },
    { name: 'defaultReminderMinutes', type: 'number', min: 0, defaultValue: 60 },
    { name: 'cancelled', type: 'checkbox', defaultValue: false },
  ],
}
