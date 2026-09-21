import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

export const CommunityAuthRateLimits: CollectionConfig = {
  slug: 'community-auth-rate-limits',
  admin: { hidden: true },
  lockDocuments: false,
  access: {
    create: () => false,
    read: isSystemAdmin,
    update: () => false,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'bucketHash', type: 'text', required: true, unique: true, index: true },
    { name: 'attempts', type: 'number', required: true, min: 0, defaultValue: 0 },
    { name: 'resetAt', type: 'date', required: true, index: true },
  ],
}
