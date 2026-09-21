import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

export const SyncRecords: CollectionConfig = {
  slug: 'sync-records',
  admin: { hidden: true },
  lockDocuments: false,
  indexes: [
    { fields: ['user', 'recordType', 'recordId'], unique: true },
    { fields: ['user', 'serverRevision'] },
  ],
  access: {
    create: () => false,
    read: isSystemAdmin,
    update: () => false,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'recordType', type: 'text', required: true, index: true },
    { name: 'recordId', type: 'text', required: true, index: true },
    { name: 'schemaVersion', type: 'number', required: true, min: 1 },
    { name: 'serverRevision', type: 'number', required: true, min: 1, unique: true, index: true },
    { name: 'originDeviceId', type: 'text', required: true, index: true },
    { name: 'deleted', type: 'checkbox', required: true, defaultValue: false },
    { name: 'clientUpdatedAt', type: 'date' },
    { name: 'keyId', type: 'text', required: true },
    { name: 'iv', type: 'text', required: true },
    { name: 'authTag', type: 'text', required: true },
    { name: 'ciphertext', type: 'textarea', required: true },
    { name: 'contentHash', type: 'text', required: true, index: true },
  ],
}
