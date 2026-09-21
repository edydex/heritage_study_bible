import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

export const SyncDevices: CollectionConfig = {
  slug: 'sync-devices',
  admin: { hidden: true },
  lockDocuments: false,
  indexes: [{ fields: ['user', 'deviceId'], unique: true }],
  access: {
    create: () => false,
    read: isSystemAdmin,
    update: () => false,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'deviceId', type: 'text', required: true, index: true },
    { name: 'friendlyName', type: 'text', required: true },
    { name: 'platform', type: 'text', required: true },
    { name: 'firstConnectedAt', type: 'date', required: true },
    { name: 'lastSyncedAt', type: 'date', index: true },
    { name: 'revokedAt', type: 'date', index: true },
  ],
}
