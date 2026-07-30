import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

/**
 * Private authoritative publication pointers.
 *
 * Anonymous routes may serve only the exact checksummed bytes stored here.
 * The canonical published sermon source is retained even after later private
 * edits so the manager-approved audit root is never reconstructed from a
 * mutable Sermons row.
 */
export const SyncShowSermonPublications: CollectionConfig = {
  slug: 'syncshow-sermon-publications',
  admin: { hidden: true },
  access: {
    read: isSystemAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  indexes: [
    { fields: ['community', 'sermon'], unique: true },
    { fields: ['community', 'publicId'], unique: true },
  ],
  fields: [
    {
      name: 'community',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      hidden: true,
    },
    {
      name: 'sermon',
      type: 'relationship',
      relationTo: 'sermons',
      required: true,
      index: true,
      hidden: true,
    },
    {
      name: 'schemaVersion',
      type: 'number',
      required: true,
      min: 1,
      max: 1,
      hidden: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      index: true,
      hidden: true,
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      options: [{ label: 'Public', value: 'public' }],
      hidden: true,
    },
    {
      name: 'publicationVersion',
      type: 'number',
      required: true,
      min: 1,
      hidden: true,
    },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      hidden: true,
    },
    {
      name: 'withdrawnAt',
      type: 'date',
      hidden: true,
    },
    {
      name: 'syncId',
      type: 'text',
      required: true,
      index: true,
      hidden: true,
    },
    {
      name: 'publicId',
      type: 'text',
      required: true,
      index: true,
      hidden: true,
    },
    {
      name: 'publicRevision',
      type: 'text',
      required: true,
      hidden: true,
    },
    {
      name: 'publishedDocumentSource',
      type: 'textarea',
      required: true,
      hidden: true,
    },
    {
      name: 'selectedBodyEntryIds',
      type: 'json',
      required: true,
      hidden: true,
    },
    {
      name: 'selectedMediaIds',
      type: 'json',
      required: true,
      hidden: true,
    },
    {
      name: 'detailChecksum',
      type: 'text',
      required: true,
      hidden: true,
    },
    {
      name: 'detailSource',
      type: 'textarea',
      required: true,
      hidden: true,
    },
    {
      name: 'catalogItemChecksum',
      type: 'text',
      required: true,
      hidden: true,
    },
    {
      name: 'catalogItemSource',
      type: 'textarea',
      required: true,
      hidden: true,
    },
  ],
}
