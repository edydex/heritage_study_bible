import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

export const SyncAccountEvents: CollectionConfig = {
  slug: 'sync-account-events',
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
    {
      name: 'eventType',
      type: 'select',
      required: true,
      options: [
        { label: 'Device connected', value: 'device-connected' },
        { label: 'Protection changed', value: 'protection-changed' },
        { label: 'Device revoked', value: 'device-revoked' },
      ],
    },
    { name: 'deviceId', type: 'text', index: true },
    { name: 'occurredAt', type: 'date', required: true, index: true },
  ],
}
