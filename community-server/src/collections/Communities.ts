import type { CollectionConfig } from 'payload'
import { isSystemAdmin, isAuthenticated } from '@/access'

export const Communities: CollectionConfig = {
  slug: 'communities',
  admin: { useAsTitle: 'name' },
  access: {
    read: () => true,
    create: isSystemAdmin,
    update: isSystemAdmin,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'description', type: 'textarea' },
    { name: 'website', type: 'text' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'timeZone', type: 'text', defaultValue: 'UTC', required: true },
    { name: 'allowDirectoryListing', type: 'checkbox', defaultValue: false },
    { name: 'contentServerEnabled', type: 'checkbox', defaultValue: true },
  ],
}
