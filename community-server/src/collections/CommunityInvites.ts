import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'

const invitationRoles = [
  { label: 'Member', value: 'member' },
  { label: 'Leader permissions', value: 'leader' },
  { label: 'Content administrator permissions', value: 'admin' },
]

export const CommunityInvites: CollectionConfig = {
  slug: 'community-invites',
  labels: { singular: 'Member invitation', plural: 'Member invitations' },
  admin: {
    useAsTitle: 'email',
    group: 'People',
    description: 'Allow an email address to join this church in Heritage. The invitation is used automatically when that person requests a sign-in link.',
    defaultColumns: ['email', 'role', 'active', 'acceptedAt'],
    listSearchableFields: ['email', 'displayName'],
    hideAPIURL: true,
  },
  indexes: [{ fields: ['community', 'email'], unique: true }],
  access: {
    read: isSystemAdmin,
    create: isSystemAdmin,
    update: isSystemAdmin,
    delete: isSystemAdmin,
  },
  hooks: {
    beforeValidate: [({ data }) => data
      ? { ...data, email: String(data.email || '').trim().toLowerCase() }
      : data],
  },
  fields: [
    {
      name: 'community',
      label: 'Church',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      admin: { description: 'The church this person may join.' },
    },
    {
      name: 'email',
      label: 'Email address',
      type: 'email',
      required: true,
      index: true,
    },
    {
      name: 'displayName',
      label: 'Name',
      type: 'text',
      admin: { description: 'Optional. The member can change their display name later.' },
    },
    {
      name: 'role',
      label: 'What may this person do?',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: invitationRoles,
      admin: { description: 'This sets Community API permissions. It does not create a separate web-admin password; manage admin logins under Users.' },
    },
    {
      name: 'active',
      label: 'Invitation is active',
      type: 'checkbox',
      defaultValue: true,
      required: true,
      index: true,
    },
    {
      name: 'acceptedAt',
      label: 'Joined on',
      type: 'date',
      admin: { readOnly: true, date: { displayFormat: 'MMM d, yyyy h:mm a' } },
    },
  ],
}
