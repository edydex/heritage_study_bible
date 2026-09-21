import type { CollectionConfig, FieldAccess } from 'payload'
import { manageCommunityContent } from '@/access'

const immutableFieldAccess = {
  update: () => false,
}
const systemAdminField: FieldAccess =
  ({ req }) => req.user?.systemRole === 'system-admin'
const privateFieldAccess = {
  create: systemAdminField,
  read: systemAdminField,
  update: systemAdminField,
}

/**
 * Append-only evidence for each exact member-sharing decision.
 *
 * The active redacted receipt is copied onto the song in the same database
 * transaction so member reads can fail closed without exposing this review,
 * actor, connection, audit, or idempotency material.
 */
export const SyncShowSongMemberShares: CollectionConfig = {
  slug: 'syncshow-song-member-shares',
  labels: {
    singular: 'Song member-sharing receipt',
    plural: 'Song member-sharing receipts',
  },
  admin: {
    useAsTitle: 'receiptId',
    group: 'Integrations',
    description:
      'Immutable exact-family reviews authorizing lyrics for signed-in Community members.',
    defaultColumns: [
      'songSyncId',
      'visibility',
      'publishAt',
      'confirmedAt',
    ],
    hideAPIURL: true,
  },
  access: {
    read: manageCommunityContent,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  indexes: [
    {
      fields: ['community', 'songSyncId', 'receiptVersion'],
      unique: true,
    },
  ],
  fields: [
    {
      name: 'community',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: immutableFieldAccess,
    },
    {
      name: 'song',
      type: 'relationship',
      relationTo: 'songs',
      required: true,
      index: true,
      access: immutableFieldAccess,
    },
    {
      name: 'schemaVersion',
      type: 'number',
      required: true,
      min: 1,
      max: 1,
      hidden: true,
      access: immutableFieldAccess,
    },
    {
      name: 'receiptId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'receiptVersion',
      type: 'number',
      required: true,
      min: 1,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'songSyncId',
      type: 'text',
      required: true,
      index: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'previousSongSyncVersion',
      type: 'number',
      required: true,
      min: 1,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'songSyncVersion',
      type: 'number',
      required: true,
      min: 2,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'familyRevision',
      type: 'text',
      required: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'reviewRevision',
      type: 'text',
      required: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      options: [
        { label: 'Members now', value: 'public' },
        { label: 'Members on schedule', value: 'scheduled-public' },
      ],
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'publishAt',
      type: 'date',
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'timeZone',
      type: 'text',
      required: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'validThrough',
      type: 'date',
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'reviewedAt',
      type: 'date',
      required: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'confirmedAt',
      type: 'date',
      required: true,
      index: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'requestRevision',
      type: 'text',
      required: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'receiptRevision',
      type: 'text',
      required: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'reviewSource',
      type: 'textarea',
      required: true,
      hidden: true,
      access: privateFieldAccess,
    },
    {
      name: 'auditSource',
      type: 'textarea',
      required: true,
      hidden: true,
      access: privateFieldAccess,
    },
    {
      name: 'idempotencyKeyHash',
      type: 'text',
      required: true,
      unique: true,
      hidden: true,
      access: privateFieldAccess,
    },
    {
      name: 'requestHash',
      type: 'text',
      required: true,
      hidden: true,
      access: privateFieldAccess,
    },
  ],
}
