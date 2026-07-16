import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readMemberCommunityContent, updateRelationAsSystemAdmin } from '@/access'
import { validateRelatedCommunity } from '@/lib/communityRelationships'

export const PlanCohorts: CollectionConfig = {
  slug: 'plan-cohorts',
  admin: { useAsTitle: 'name', group: 'Community' },
  access: {
    read: readMemberCommunityContent,
    create: createCommunityContent,
    update: manageCommunityContent,
    delete: manageCommunityContent,
  },
  hooks: {
    beforeValidate: [async ({ data, originalDoc, req }) => {
      await validateRelatedCommunity({
        currentCollection: 'plan-cohorts',
        data,
        originalDoc,
        relatedCollection: 'reading-plans',
        relationField: 'plan',
        req,
      })
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
      name: 'plan',
      type: 'relationship',
      relationTo: 'reading-plans',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'startsOn', type: 'date', required: true },
    { name: 'endsOn', type: 'date' },
    {
      name: 'defaultNoteVisibility',
      type: 'select',
      defaultValue: 'shared',
      required: true,
      options: [
        { label: 'Shared with cohort', value: 'shared' },
        { label: 'Private', value: 'private' },
        { label: 'Leaders only', value: 'leaders' },
      ],
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
