import type { CollectionConfig } from 'payload'
import { createMemberCommunityContent, updateRelationAsSystemAdmin } from '@/access'
import { validateRelatedCommunity } from '@/lib/communityRelationships'

export const EventRsvps: CollectionConfig = {
  slug: 'event-rsvps',
  admin: { useAsTitle: 'id', group: 'Community' },
  indexes: [{ fields: ['event', 'user'], unique: true }],
  access: {
    read: ({ req }) => req.user?.systemRole === 'system-admin' ? true : { user: { equals: req.user?.id } },
    create: createMemberCommunityContent,
    update: ({ req }) => req.user?.systemRole === 'system-admin' ? true : { user: { equals: req.user?.id } },
    delete: ({ req }) => req.user?.systemRole === 'system-admin' ? true : { user: { equals: req.user?.id } },
  },
  hooks: {
    beforeValidate: [async ({ data, originalDoc, req }) => {
      await validateRelatedCommunity({
        currentCollection: 'event-rsvps',
        data,
        originalDoc,
        relatedCollection: 'events',
        relationField: 'event',
        req,
      })
      return data
    }],
    beforeChange: [({ data, operation, req }) => {
      if (operation === 'create' && req.user && req.user.systemRole !== 'system-admin') return { ...data, user: req.user.id }
      return data
    }],
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
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    { name: 'response', type: 'select', required: true, options: ['going', 'maybe', 'not-going'] },
    { name: 'guests', type: 'number', min: 0, defaultValue: 0 },
    { name: 'note', type: 'textarea' },
  ],
}
