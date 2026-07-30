import type { Access, CollectionBeforeChangeHook, CollectionConfig, FieldAccess, Where } from 'payload'
import { createCommunityContent, manageCommunityContent, membershipCommunityIds } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'
import { fillContentSlug } from '@/lib/contentAdmin'

const systemAdminField: FieldAccess = ({ req }) => req.user?.systemRole === 'system-admin'
const protectedSyncFieldAccess = {
  create: systemAdminField,
  read: systemAdminField,
  update: systemAdminField,
}
const schemaQueryableSelectionField: FieldAccess = () => true
const planningQueryableSyncFieldAccess = {
  create: systemAdminField,
  // Payload validates relationship filters before it applies collection-level
  // row access, in a schema-permissions context that does not expose the
  // authenticated user. These two non-secret identity flags therefore need to
  // be queryable at schema level so the service-plan picker can apply its
  // canonical/non-archived filter. Sermon rows remain tenant- and role-scoped
  // by readSermonsByPublicationOrManager, canonical rows remain private drafts,
  // and every write plus all source/revision fields stay system-admin-only.
  read: schemaQueryableSelectionField,
  update: systemAdminField,
}
const PRIVATE_SYNC_FIELDS = [
  'syncId',
  'syncVersion',
  'syncCurrentDocumentSource',
  'syncCurrentRevision',
  'syncArchived',
  'syncPublicationStatus',
  'syncVisibility',
  'syncSourceObjects',
  'syncChangedAt',
  'syncCreateIdempotencyKey',
  'syncCreateIdempotencyHash',
] as const

export function protectPrivateSermonState(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
  context: Record<string, unknown> = {},
) {
  const next = { ...data }
  const originalManaged = Boolean(originalDoc?.syncId)
  if (context.syncShowSermonMutation !== true) {
    for (const field of PRIVATE_SYNC_FIELDS) {
      if (originalDoc && Object.prototype.hasOwnProperty.call(originalDoc, field)) {
        next[field] = originalDoc[field]
      } else {
        delete next[field]
      }
    }
  }
  if (originalManaged || next.syncId) {
    // Canonical SyncShow records are private editorial state. The later,
    // separate publication transaction will own any public projection.
    next.status = 'draft'
  }
  return next
}

const keepPrivateSermonState: CollectionBeforeChangeHook = ({
  context,
  data,
  originalDoc,
}) => protectPrivateSermonState(
  data as Record<string, unknown>,
  originalDoc as unknown as Record<string, unknown> | undefined,
  context as Record<string, unknown>,
)

const manageLegacySermonsOnly: Access = async args => {
  const managed = await manageCommunityContent(args)
  if (!managed) return false
  const legacyOnly: Where = { syncId: { exists: false } }
  if (managed === true) return legacyOnly
  return { and: [managed, legacyOnly] }
}

export const readSermonsByPublicationOrManager: Access = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const memberCommunityIds = await membershipCommunityIds(req)
  const managerCommunityIds = await membershipCommunityIds(
    req,
    ['owner', 'admin', 'leader'],
  )
  const clauses: Where[] = [{
    and: [
      { status: { equals: 'published' } },
      { syncId: { exists: false } },
    ],
  }]
  if (memberCommunityIds.length) {
    // Preserve the existing member-visible editorial workflow for legacy
    // sermons, while the canonical SyncShow row remains manager-only.
    clauses.push({
      and: [
        { community: { in: memberCommunityIds } },
        { syncId: { exists: false } },
      ],
    })
  }
  if (managerCommunityIds.length) {
    clauses.push({ community: { in: managerCommunityIds } })
  }
  return { or: clauses }
}

export const Sermons: CollectionConfig = {
  slug: 'sermons',
  indexes: [
    { fields: ['community', 'slug'], unique: true },
    { fields: ['community', 'syncId'], unique: true },
    { fields: ['community', 'syncCreateIdempotencyKey'], unique: true },
  ],
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    description: 'Messages with a speaker, date, Scripture references, transcript, and optional recordings or files.',
    defaultColumns: ['title', 'speaker', 'preachedAt', 'status', 'updatedAt'],
    listSearchableFields: ['title', 'speaker', 'series'],
    hideAPIURL: true,
  },
  access: {
    read: readSermonsByPublicationOrManager,
    create: createCommunityContent,
    // SyncShow-managed rows are canonical private records. Keep Payload's
    // generic legacy form read-only so title/date/transcript fields cannot
    // silently drift away from the exact canonical document.
    update: manageLegacySermonsOnly,
    delete: manageLegacySermonsOnly,
  },
  hooks: {
    beforeValidate: [fillContentSlug],
    beforeChange: [keepPrivateSermonState],
  },
  fields: [
    ...communityContentFields,
    { name: 'speaker', label: 'Speaker', type: 'text', required: true },
    { name: 'preachedAt', label: 'Date preached', type: 'date', required: true },
    { name: 'scripture', label: 'Bible passages', type: 'text', hasMany: true, admin: { description: 'For example: John 3:16-21.' } },
    { name: 'transcript', label: 'Transcript', type: 'textarea' },
    { name: 'media', label: 'Recordings and files', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'series', label: 'Series', type: 'text' },
    {
      name: 'syncId',
      type: 'text',
      index: true,
      admin: { hidden: true },
      access: planningQueryableSyncFieldAccess,
    },
    {
      name: 'syncVersion',
      type: 'number',
      min: 1,
      hidden: true,
      access: protectedSyncFieldAccess,
    },
    {
      name: 'syncCurrentDocumentSource',
      type: 'textarea',
      hidden: true,
      access: protectedSyncFieldAccess,
    },
    {
      name: 'syncCurrentRevision',
      type: 'text',
      hidden: true,
      access: protectedSyncFieldAccess,
    },
    {
      name: 'syncArchived',
      type: 'checkbox',
      admin: { hidden: true },
      access: planningQueryableSyncFieldAccess,
    },
    {
      name: 'syncPublicationStatus',
      type: 'select',
      options: ['draft', 'ready', 'published', 'archived'],
      hidden: true,
      access: protectedSyncFieldAccess,
    },
    {
      name: 'syncVisibility',
      type: 'select',
      options: ['private', 'members', 'unlisted', 'public'],
      hidden: true,
      access: protectedSyncFieldAccess,
    },
    {
      name: 'syncSourceObjects',
      type: 'json',
      hidden: true,
      access: protectedSyncFieldAccess,
    },
    {
      name: 'syncChangedAt',
      type: 'date',
      index: true,
      hidden: true,
      access: protectedSyncFieldAccess,
    },
    {
      name: 'syncCreateIdempotencyKey',
      type: 'text',
      index: true,
      hidden: true,
      access: protectedSyncFieldAccess,
    },
    {
      name: 'syncCreateIdempotencyHash',
      type: 'text',
      hidden: true,
      access: protectedSyncFieldAccess,
    },
  ],
}
