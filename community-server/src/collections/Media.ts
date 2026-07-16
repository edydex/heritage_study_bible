import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember, updateRelationAsSystemAdmin } from '@/access'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: { staticDir: 'media' },
  access: {
    read: readPublishedOrMember,
    create: createCommunityContent,
    update: manageCommunityContent,
    delete: manageCommunityContent,
  },
  fields: [
    {
      name: 'community',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    { name: 'status', type: 'select', defaultValue: 'published', options: ['draft', 'published'] },
    { name: 'alt', type: 'text' },
    { name: 'credit', type: 'text' },
  ],
}
