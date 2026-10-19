import type { CollectionBeforeChangeHook, CollectionConfig, FieldAccess } from 'payload'
import { isSystemAdmin, manageCommunityContent, updateRelationAsSystemAdmin } from '@/access'

const systemAdminField: FieldAccess = ({ req }) => req.user?.systemRole === 'system-admin'
const protectedFieldAccess = {
  create: systemAdminField,
  read: systemAdminField,
  update: systemAdminField,
}

export function preserveManagerRevocation(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
  systemRole: unknown,
) {
  if (systemRole === 'system-admin' || !originalDoc?.revokedAt) return data
  return { ...data, revokedAt: originalDoc.revokedAt }
}

const keepRevocationOneWay: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => operation === 'update'
  ? preserveManagerRevocation(
      data as Record<string, unknown>,
      originalDoc as unknown as Record<string, unknown> | undefined,
      req.user?.systemRole,
    )
  : data

export const SyncShowConnections: CollectionConfig = {
  slug: 'syncshow-connections',
  labels: { singular: 'SyncShow connection', plural: 'SyncShow connections' },
  admin: {
    useAsTitle: 'clientName',
    group: 'Integrations',
    description: 'Approved SyncShow installations. Revoke a connection to stop its scoped song and sermon access.',
    defaultColumns: ['clientName', 'user', 'expiresAt', 'revokedAt', 'lastUsedAt'],
    hideAPIURL: true,
  },
  access: {
    read: manageCommunityContent,
    create: () => false,
    update: manageCommunityContent,
    delete: () => false,
  },
  hooks: { beforeChange: [keepRevocationOneWay] },
  fields: [
    {
      name: 'community',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    {
      name: 'user',
      label: 'Approved by',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: protectedFieldAccess,
    },
    {
      name: 'grant',
      type: 'relationship',
      relationTo: 'syncshow-device-grants',
      required: true,
      unique: true,
      hidden: true,
      access: protectedFieldAccess,
    },
    { name: 'clientName', label: 'Installation', type: 'text', required: true },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true, hidden: true, access: protectedFieldAccess },
    { name: 'scopes', type: 'json', required: true, hidden: true, access: protectedFieldAccess },
    {
      name: 'expiresAt',
      label: 'Expires',
      type: 'date',
      required: true,
      index: true,
      access: protectedFieldAccess,
      admin: { readOnly: true },
    },
    { name: 'revokedAt', label: 'Revoked', type: 'date', index: true },
    {
      name: 'lastUsedAt',
      label: 'Last used',
      type: 'date',
      access: protectedFieldAccess,
      admin: { readOnly: true },
    },
  ],
}
