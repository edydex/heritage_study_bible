import type { CollectionConfig } from 'payload'
import { isAuthenticated, updateRelationAsSystemAdmin } from '@/access'

export const EncryptedSync: CollectionConfig = {
  slug: 'encrypted-sync',
  admin: { hidden: true },
  indexes: [{ fields: ['user', 'deviceId'], unique: true }],
  access: {
    read: ({ req }) => ({ user: { equals: req.user?.id } }),
    create: isAuthenticated,
    update: ({ req }) => ({ user: { equals: req.user?.id } }),
    delete: ({ req }) => ({ user: { equals: req.user?.id } }),
  },
  hooks: {
    beforeChange: [({ data, operation, req }) => {
      if (operation === 'create' && req.user && req.user.systemRole !== 'system-admin') return { ...data, user: req.user.id }
      return data
    }],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    { name: 'deviceId', type: 'text', required: true, index: true },
    { name: 'schemaVersion', type: 'number', required: true, min: 1 },
    { name: 'keyId', type: 'text', required: true },
    { name: 'salt', type: 'text', required: true },
    { name: 'iv', type: 'text', required: true },
    { name: 'ciphertext', type: 'textarea', required: true },
    { name: 'contentHash', type: 'text', required: true },
  ],
}
