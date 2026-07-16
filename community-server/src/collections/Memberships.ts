import type { CollectionConfig } from 'payload'
import { isSystemAdmin, readCommunityMembership } from '@/access'

export const Memberships: CollectionConfig = {
  slug: 'memberships',
  admin: { useAsTitle: 'id' },
  indexes: [{ fields: ['community', 'user'], unique: true }],
  access: {
    read: readCommunityMembership,
    create: isSystemAdmin,
    update: isSystemAdmin,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'community', type: 'relationship', relationTo: 'communities', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: ['owner', 'admin', 'leader', 'member'],
    },
    { name: 'joinedAt', type: 'date', required: true, defaultValue: () => new Date().toISOString() },
  ],
}
