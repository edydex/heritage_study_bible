import type { CollectionConfig, FieldAccess } from 'payload'
import { isSystemAdmin } from '@/access'

const systemAdminField: FieldAccess = ({ req }) => req.user?.systemRole === 'system-admin'
const protectedFieldAccess = {
  create: systemAdminField,
  read: systemAdminField,
  update: systemAdminField,
}

export const SyncShowDeviceGrants: CollectionConfig = {
  slug: 'syncshow-device-grants',
  admin: { hidden: true },
  access: {
    read: isSystemAdmin,
    create: () => false,
    update: () => false,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'community', type: 'relationship', relationTo: 'communities', required: true, index: true },
    { name: 'requestedEmail', type: 'email', required: true, index: true },
    { name: 'clientName', type: 'text', required: true },
    { name: 'deviceId', type: 'text', required: true, unique: true, index: true, hidden: true, access: protectedFieldAccess },
    { name: 'deviceSecretHash', type: 'text', required: true, unique: true, index: true, hidden: true, access: protectedFieldAccess },
    { name: 'userCodeHash', type: 'text', required: true, unique: true, index: true, hidden: true, access: protectedFieldAccess },
    { name: 'codeChallenge', type: 'text', required: true, hidden: true, access: protectedFieldAccess },
    { name: 'scopes', type: 'json', required: true, hidden: true, access: protectedFieldAccess },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Denied', value: 'denied' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Consumed', value: 'consumed' },
      ],
    },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'approvedBy', type: 'relationship', relationTo: 'users', index: true },
    { name: 'approvedAt', type: 'date' },
    { name: 'consumedAt', type: 'date' },
  ],
}
