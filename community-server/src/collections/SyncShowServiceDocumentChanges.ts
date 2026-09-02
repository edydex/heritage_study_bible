import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
  FieldAccess,
} from 'payload'
import { isSystemAdmin } from '@/access'

type UnknownRecord = Record<string, unknown>

const systemAdminField: FieldAccess = ({ req }) =>
  req.user?.systemRole === 'system-admin'
const protectedFieldAccess = {
  create: systemAdminField,
  read: systemAdminField,
  update: systemAdminField,
}

export const protectServiceDocumentChange: CollectionBeforeChangeHook = ({
  data,
  operation,
  context,
}) => {
  if (operation !== 'create'
    || (context as UnknownRecord | undefined)?.serviceDocumentChange !== true) {
    throw new Error('Service-document changes are append-only internal records.')
  }
  return data
}

export const rejectServiceDocumentChangeDeletion: CollectionBeforeDeleteHook = () => {
  throw new Error('Service-document changes are append-only and immutable.')
}

export const SyncShowServiceDocumentChanges: CollectionConfig = {
  slug: 'syncshow-service-document-changes',
  admin: { hidden: true },
  access: {
    read: isSystemAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [protectServiceDocumentChange],
    beforeDelete: [rejectServiceDocumentChangeDeletion],
  },
  indexes: [
    { fields: ['serviceDocument', 'syncVersion'], unique: true },
  ],
  fields: [
    {
      name: 'community',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      hidden: true,
      access: protectedFieldAccess,
    },
    {
      name: 'serviceDocument',
      type: 'relationship',
      relationTo: 'service-documents' as never,
      required: true,
      index: true,
      hidden: true,
      access: protectedFieldAccess,
    },
    {
      name: 'syncId',
      type: 'text',
      required: true,
      index: true,
      hidden: true,
      access: protectedFieldAccess,
    },
    {
      name: 'syncVersion',
      type: 'number',
      required: true,
      min: 1,
      hidden: true,
      access: protectedFieldAccess,
    },
    ...['revision', 'status', 'title', 'serviceDate'].map(name => ({
      name,
      type: 'text' as const,
      required: true,
      hidden: true,
      access: protectedFieldAccess,
    })),
    {
      name: 'documentSource',
      type: 'textarea',
      required: true,
      hidden: true,
      access: protectedFieldAccess,
    },
    {
      name: 'changedAt',
      type: 'date',
      required: true,
      index: true,
      hidden: true,
      access: protectedFieldAccess,
    },
  ],
}
