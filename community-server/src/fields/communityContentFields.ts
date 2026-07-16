import type { Field } from 'payload'
import { updateRelationAsSystemAdmin } from '@/access'

export const communityContentFields: Field[] = [
  {
    name: 'community',
    type: 'relationship',
    relationTo: 'communities',
    required: true,
    index: true,
    access: { update: updateRelationAsSystemAdmin },
  },
  {
    name: 'status',
    type: 'select',
    required: true,
    defaultValue: 'draft',
    index: true,
    options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
      { label: 'Archived', value: 'archived' },
    ],
  },
  { name: 'title', type: 'text', required: true },
  { name: 'slug', type: 'text', required: true, index: true },
  { name: 'description', type: 'textarea' },
]
