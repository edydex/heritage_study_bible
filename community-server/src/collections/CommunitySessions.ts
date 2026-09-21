import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

export const CommunitySessions: CollectionConfig = {
  slug: 'community-sessions',
  admin: { hidden: true },
  access: {
    read: isSystemAdmin,
    create: () => false,
    update: () => false,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'revokedAt', type: 'date', index: true },
    { name: 'deviceId', type: 'text', index: true },
    { name: 'deviceName', type: 'text' },
    { name: 'platform', type: 'text' },
    { name: 'emailVerifiedAt', type: 'date', index: true },
    { name: 'lastUsedAt', type: 'date', index: true },
    {
      name: 'syncGeneration',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1,
      index: true,
    },
  ],
}
