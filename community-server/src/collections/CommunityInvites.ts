import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'
import { sendInvitationEmail } from '@/lib/communityInvitationEmail'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'

const invitationRoles = [
  { label: 'Member', value: 'member' },
  { label: 'Church leader — workspace access', value: 'leader' },
  { label: 'Church administrator — workspace access', value: 'admin' },
]

export const CommunityInvites: CollectionConfig = {
  slug: 'community-invites',
  labels: { singular: 'Invitation', plural: 'Invitations' },
  admin: {
    useAsTitle: 'email',
    group: 'People',
    description: 'Invite a member to Heritage, or invite a leader/administrator to the church workspace. Save to send the email; no separate account creation is needed.',
    defaultColumns: ['email', 'role', 'active', 'emailSentAt', 'acceptedAt'],
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
    afterChange: [sendInvitationEmail],
  },
  fields: [
    {
      name: 'community',
      label: 'Church',
      type: 'relationship',
      relationTo: 'communities',
      defaultValue: async ({ req }) => req?.payload ? getConfiguredCommunityId(req.payload) : null,
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
      admin: { description: 'Members receive a Heritage join link. Leaders and church administrators receive a workspace password-setup link for service planning, songs and sermons. This does not grant server-wide administration or reduce an existing role.' },
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
      name: 'sendEmailNow',
      label: 'Email this invitation now',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Save to send. Select again and save to resend. Member join links last 15 minutes; workspace password-setup links last 24 hours. For an accepted invitation, reactivate it to send again.',
      },
    },
    {
      name: 'emailSentAt',
      label: 'Invitation email sent',
      type: 'date',
      admin: { readOnly: true, date: { displayFormat: 'MMM d, yyyy h:mm a' } },
    },
    {
      name: 'acceptedAt',
      label: 'Joined on',
      type: 'date',
      admin: { readOnly: true, date: { displayFormat: 'MMM d, yyyy h:mm a' } },
    },
  ],
}
