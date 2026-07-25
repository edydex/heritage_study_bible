import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

export const Communities: CollectionConfig = {
  slug: 'communities',
  labels: { singular: 'Church settings', plural: 'Church settings' },
  admin: {
    useAsTitle: 'name',
    group: 'Setup',
    description: 'The public name, description, logo, time zone, and joining policy for this Heritage Community.',
    defaultColumns: ['name', 'website', 'timeZone', 'joinPolicy'],
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    create: isSystemAdmin,
    update: isSystemAdmin,
    delete: isSystemAdmin,
  },
  fields: [
    { name: 'name', label: 'Church/community name', type: 'text', required: true },
    {
      name: 'slug',
      label: 'Stable community ID',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'Set during installation. Heritage uses this ID to recognize the same church after updates.' },
    },
    { name: 'description', label: 'Short public description', type: 'textarea' },
    { name: 'website', label: 'Public server address', type: 'text', admin: { readOnly: true } },
    { name: 'logo', label: 'Church logo', type: 'upload', relationTo: 'media' },
    { name: 'timeZone', label: 'Time zone', type: 'text', defaultValue: 'UTC', required: true, admin: { description: 'For example: America/Los_Angeles.' } },
    {
      name: 'joinPolicy',
      label: 'Who may join?',
      type: 'select',
      defaultValue: 'invite',
      required: true,
      options: [
        { label: 'Only people listed in Member invitations (recommended)', value: 'invite' },
        { label: 'Anyone with an email address', value: 'open' },
      ],
      admin: { description: 'Invite-only prevents strangers from creating member accounts on a public server.' },
    },
    { name: 'allowDirectoryListing', label: 'Show a public member directory', type: 'checkbox', defaultValue: false },
    { name: 'contentServerEnabled', label: 'Publish church resources to Heritage', type: 'checkbox', defaultValue: true },
  ],
}
