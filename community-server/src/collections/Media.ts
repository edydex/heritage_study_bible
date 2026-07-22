import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember, updateRelationAsSystemAdmin } from '@/access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'File or image', plural: 'Files and images' },
  admin: {
    useAsTitle: 'filename',
    group: 'Content',
    description: 'Uploaded artwork, documents, audio, video, scores, and other files used by published resources.',
    defaultColumns: ['filename', 'status', 'updatedAt'],
    hideAPIURL: true,
  },
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
      label: 'Church',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    { name: 'status', label: 'Publishing status', type: 'select', defaultValue: 'published', options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }] },
    { name: 'alt', label: 'Description for screen readers', type: 'text' },
    { name: 'credit', label: 'Credit or attribution', type: 'text' },
  ],
}
