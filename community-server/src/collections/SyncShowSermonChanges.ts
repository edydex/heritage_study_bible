import { createHash } from 'node:crypto'
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
  FieldAccess,
} from 'payload'
import { isSystemAdmin } from '@/access'
import {
  parseSermonDocument,
  serializeSermonDocument,
} from '@/lib/syncshow/SermonDocument'

const systemAdminField: FieldAccess = ({ req }) => req.user?.systemRole === 'system-admin'
const protectedFieldAccess = {
  create: systemAdminField,
  read: systemAdminField,
  update: systemAdminField,
}
type UnknownRecord = Record<string, unknown>

export function validateSermonChangeAuthority(data: UnknownRecord) {
  const syncId = typeof data.syncId === 'string' ? data.syncId : ''
  const revision = typeof data.revision === 'string' ? data.revision : ''
  const documentSource = typeof data.documentSource === 'string'
    ? data.documentSource
    : ''
  if (!syncId || !/^[0-9a-f]{64}$/.test(revision) || !documentSource) {
    throw new Error('The sermon change authority is invalid.')
  }

  let document
  try {
    document = parseSermonDocument(documentSource)
  } catch {
    throw new Error('The sermon change authority is invalid.')
  }
  if (
    document.id !== syncId
    || serializeSermonDocument(document) !== documentSource
    || createHash('sha256').update(documentSource, 'utf8').digest('hex')
      !== revision
    || (document.publication.status === 'archived') !== (data.archived === true)
  ) {
    throw new Error('The sermon change authority is invalid.')
  }
  return data
}

export const protectSermonChangeAuthority: CollectionBeforeChangeHook = ({
  data,
  operation,
  context,
}) => {
  if (operation !== 'create') {
    throw new Error('The sermon change journal is append-only and immutable.')
  }
  if (
    (context as UnknownRecord | undefined)?.syncShowSermonChangeMutation
      !== true
  ) {
    throw new Error('Sermon change rows may only be created by the internal sync transaction.')
  }
  return validateSermonChangeAuthority(data as UnknownRecord)
}

export const rejectSermonChangeDeletion: CollectionBeforeDeleteHook = () => {
  throw new Error('The sermon change journal is append-only and immutable.')
}

/**
 * Append-only private change journal for authenticated SyncShow cursors.
 *
 * Payload's numeric collection id is the global monotonic sequence. Keeping
 * change events separate from the mutable sermon row prevents a late update
 * from moving behind an already-issued cursor.
 */
export const SyncShowSermonChanges: CollectionConfig = {
  slug: 'syncshow-sermon-changes',
  admin: { hidden: true },
  access: {
    read: isSystemAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [protectSermonChangeAuthority],
    beforeDelete: [rejectSermonChangeDeletion],
  },
  indexes: [
    { fields: ['sermon', 'syncVersion'], unique: true },
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
      name: 'sermon',
      type: 'relationship',
      relationTo: 'sermons',
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
    {
      name: 'revision',
      type: 'text',
      required: true,
      hidden: true,
      access: protectedFieldAccess,
    },
    {
      name: 'documentSource',
      type: 'textarea',
      required: true,
      hidden: true,
      access: protectedFieldAccess,
    },
    {
      name: 'archived',
      type: 'checkbox',
      required: true,
      hidden: true,
      access: protectedFieldAccess,
    },
    {
      name: 'changedAt',
      type: 'date',
      required: true,
      hidden: true,
      access: protectedFieldAccess,
    },
  ],
}
