import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

export const CommunityAuthChallenges: CollectionConfig = {
  slug: 'community-auth-challenges',
  admin: { hidden: true },
  lockDocuments: false,
  access: {
    create: () => false,
    read: isSystemAdmin,
    update: () => false,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'emailHash', type: 'text', required: true, index: true },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
    {
      name: 'purpose',
      type: 'select',
      required: true,
      options: [
        { label: 'Sign in', value: 'sign-in' },
        { label: 'Reverify email', value: 'reverify' },
      ],
    },
    { name: 'flow', type: 'select', required: true, options: ['community', 'sync'] },
    { name: 'deviceId', type: 'text', required: true, index: true },
    { name: 'deviceName', type: 'text', required: true },
    { name: 'platform', type: 'text', required: true },
    { name: 'requiresPassword', type: 'checkbox', required: true, defaultValue: false },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'failedAttempts', type: 'number', required: true, min: 0, defaultValue: 0 },
    { name: 'consumedAt', type: 'date', index: true },
    { name: 'supersededAt', type: 'date', index: true },
  ],
}
