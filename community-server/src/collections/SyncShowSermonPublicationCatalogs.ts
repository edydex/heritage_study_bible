import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

/**
 * Transactionally materialized anonymous sermon catalogs.
 *
 * Every state-changing publication transaction replaces this exact bounded
 * source and checksum. Anonymous GET never scans manuscript or detail bytes.
 */
export const SyncShowSermonPublicationCatalogs: CollectionConfig = {
  slug: 'syncshow-sermon-publication-catalogs',
  admin: { hidden: true },
  access: {
    read: isSystemAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'community',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      unique: true,
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
      name: 'generation',
      type: 'number',
      required: true,
      min: 1,
      hidden: true,
    },
    {
      name: 'changedAt',
      type: 'date',
      required: true,
      hidden: true,
    },
    {
      name: 'checksum',
      type: 'text',
      required: true,
      hidden: true,
    },
    {
      name: 'source',
      type: 'textarea',
      required: true,
      hidden: true,
    },
    {
      name: 'passageIndexChecksum',
      type: 'text',
      required: true,
      hidden: true,
    },
    {
      name: 'passageIndexSource',
      type: 'textarea',
      required: true,
      hidden: true,
    },
  ],
}
