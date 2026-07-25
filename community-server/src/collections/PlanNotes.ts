import type { CollectionConfig } from 'payload'
import { createMemberCommunityContent, readSharedPlanNotes, updateRelationAsSystemAdmin } from '@/access'
import { validateRelatedCommunity } from '@/lib/communityRelationships'

export const PlanNotes: CollectionConfig = {
  slug: 'plan-notes',
  admin: { hidden: true },
  access: {
    read: readSharedPlanNotes,
    create: createMemberCommunityContent,
    update: ({ req }) => req.user?.systemRole === 'system-admin' ? true : { author: { equals: req.user?.id } },
    delete: ({ req }) => req.user?.systemRole === 'system-admin' ? true : { author: { equals: req.user?.id } },
  },
  hooks: {
    beforeValidate: [async ({ data, originalDoc, req }) => {
      await Promise.all([
        validateRelatedCommunity({
          currentCollection: 'plan-notes',
          data,
          originalDoc,
          relatedCollection: 'plan-cohorts',
          relationField: 'cohort',
          req,
        }),
        validateRelatedCommunity({
          currentCollection: 'plan-notes',
          data,
          originalDoc,
          relatedCollection: 'reading-plans',
          relationField: 'plan',
          req,
        }),
      ])
      return data
    }],
    beforeChange: [({ data, operation, req }) => {
      if (operation === 'create' && req.user && req.user.systemRole !== 'system-admin') return { ...data, author: req.user.id }
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
      name: 'cohort',
      type: 'relationship',
      relationTo: 'plan-cohorts',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    {
      name: 'plan',
      type: 'relationship',
      relationTo: 'reading-plans',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    { name: 'day', type: 'number', required: true, min: 1, index: true },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'shared',
      options: [
        { label: 'Shared with cohort', value: 'shared' },
        { label: 'Private', value: 'private' },
        { label: 'Leaders only', value: 'leaders' },
      ],
    },
    { name: 'body', type: 'textarea', required: true },
  ],
}
