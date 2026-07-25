import type { Field } from 'payload'
import { updateRelationAsSystemAdmin } from '@/access'

export const communityContentFields: Field[] = [
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
    label: 'Publishing status',
    type: 'select',
    required: true,
    defaultValue: 'draft',
    index: true,
    options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
      { label: 'Archived', value: 'archived' },
    ],
    admin: { position: 'sidebar', description: 'Drafts stay in the admin. Published items appear in the public Heritage catalog.' },
  },
  { name: 'title', type: 'text', required: true },
  {
    name: 'slug',
    label: 'Web address name',
    type: 'text',
    required: true,
    index: true,
    admin: { position: 'sidebar', description: 'Filled automatically from the title when left blank. Change it only if the public link needs a different short name.' },
  },
  { name: 'description', label: 'Short description', type: 'textarea' },
]
