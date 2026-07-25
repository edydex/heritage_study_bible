import type { CollectionConfig } from 'payload'
import { isSystemAdmin, readCommunityMembership } from '@/access'

export const Memberships: CollectionConfig = {
  slug: 'memberships',
  labels: { singular: 'Membership', plural: 'Memberships' },
  admin: {
    useAsTitle: 'id',
    group: 'People',
    description: 'The role an existing account has in this church. New people should normally be added through Member invitations.',
    defaultColumns: ['user', 'role', 'joinedAt'],
    hideAPIURL: true,
  },
  indexes: [{ fields: ['community', 'user'], unique: true }],
  access: {
    read: readCommunityMembership,
    create: isSystemAdmin,
    update: isSystemAdmin,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'community', label: 'Church', type: 'relationship', relationTo: 'communities', required: true, index: true },
    { name: 'user', label: 'Person', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'role',
      label: 'Church role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'Owner', value: 'owner' },
        { label: 'Church administrator', value: 'admin' },
        { label: 'Group leader', value: 'leader' },
        { label: 'Member', value: 'member' },
      ],
    },
    { name: 'joinedAt', type: 'date', required: true, defaultValue: () => new Date().toISOString() },
  ],
}
