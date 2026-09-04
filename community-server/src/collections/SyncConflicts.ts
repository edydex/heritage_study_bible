import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

export const SyncConflicts: CollectionConfig = {
  slug: 'sync-conflicts',
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
    { name: 'recordType', type: 'text', required: true, index: true },
    { name: 'recordId', type: 'text', required: true, index: true },
    { name: 'schemaVersion', type: 'number', required: true, min: 1 },
    { name: 'baseRevision', type: 'number', required: true, min: 0 },
    { name: 'serverRevision', type: 'number', required: true, min: 0 },
    { name: 'originDeviceId', type: 'text', required: true },
    { name: 'deleted', type: 'checkbox', required: true, defaultValue: false },
    { name: 'clientUpdatedAt', type: 'date' },
    { name: 'serverRecordMissing', type: 'checkbox', required: true, defaultValue: false },
    { name: 'keyId', type: 'text', required: true },
    { name: 'iv', type: 'text', required: true },
    { name: 'authTag', type: 'text', required: true },
    { name: 'ciphertext', type: 'textarea', required: true },
    { name: 'contentHash', type: 'text', required: true },
    { name: 'resolvedAt', type: 'date', index: true },
  ],
}
