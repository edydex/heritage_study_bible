import type { CollectionConfig, FieldAccess } from 'payload'
import { communityAuthEnabled } from '@/lib/publicConfig'
import { hashOpaqueToken } from '@/lib/tokens'

const isSystemAdminField: FieldAccess = ({ req }) => req.user?.systemRole === 'system-admin'
const canSetInitialSystemRole: FieldAccess = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const existing = await req.payload.count({ collection: 'users', overrideAccess: true })
  return existing.totalDocs === 0
}

const protectedCredentialFieldAccess = {
  create: isSystemAdminField,
  read: isSystemAdminField,
  update: isSystemAdminField,
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Account', plural: 'Accounts' },
  admin: {
    useAsTitle: 'email',
    group: 'People',
    description: 'People who have signed in. Use Member invitations before their first sign-in; use Memberships to change an existing person’s church role.',
    defaultColumns: ['displayName', 'email', 'systemRole', 'updatedAt'],
    listSearchableFields: ['displayName', 'email'],
    hideAPIURL: true,
  },
  auth: {
    cookies: {
      sameSite: 'Lax',
      secure: (process.env.COMMUNITY_PUBLIC_URL || '').startsWith('https://'),
    },
    maxLoginAttempts: 10,
    tokenExpiration: 60 * 60 * 24,
    strategies: [
      {
        name: 'community-session',
        authenticate: async ({ headers, payload }) => {
          if (!communityAuthEnabled) return { user: null }
          const authorization = headers.get('authorization') || ''
          const token = authorization.startsWith('Community ') ? authorization.slice('Community '.length).trim() : ''
          if (!token) return { user: null }
          const result = await payload.find({
            collection: 'community-sessions',
            depth: 0,
            limit: 1,
            overrideAccess: true,
            where: {
              and: [
                { tokenHash: { equals: hashOpaqueToken(token) } },
                { expiresAt: { greater_than: new Date().toISOString() } },
                { revokedAt: { exists: false } },
              ],
            },
          })
          const session = result.docs[0]
          if (!session) return { user: null }
          const userID = typeof session.user === 'object' ? session.user.id : session.user
          const user = await payload.findByID({
            collection: 'users',
            id: userID,
            depth: 0,
            overrideAccess: true,
          })
          // Community bearer tokens are stored by the client and must never
          // inherit Payload's server-wide administrator role. Memberships
          // still grant owner/admin/leader permissions within their church.
          return {
            user: user
              ? { ...user, collection: 'users', systemRole: 'member' }
              : null,
          }
        },
      },
    ],
  },
  access: {
    create: async ({ req }) => {
      if (req.user?.systemRole === 'system-admin') return true
      const existing = await req.payload.count({ collection: 'users', overrideAccess: true })
      return existing.totalDocs === 0
    },
    read: ({ req }) => req.user?.systemRole === 'system-admin' ? true : { id: { equals: req.user?.id } },
    // Personal-account changes use the narrowly scoped, reverified account
    // endpoints. A bearer session must not gain Payload's generic user update
    // surface (which includes the auth collection's email and password fields).
    update: ({ req }) => req.user?.systemRole === 'system-admin',
    delete: ({ req }) => req.user?.systemRole === 'system-admin',
  },
  fields: [
    { name: 'displayName', label: 'Name', type: 'text', required: true, defaultValue: 'Reader' },
    {
      name: 'systemRole',
      label: 'Server access',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'System administrator', value: 'system-admin' },
        { label: 'Member', value: 'member' },
      ],
      admin: { description: 'Most people should be Members. Church roles are managed separately under Memberships.' },
      access: {
        create: canSetInitialSystemRole,
        update: isSystemAdminField,
      },
    },
    { name: 'magicLinkTokenHash', type: 'text', hidden: true, index: true, access: protectedCredentialFieldAccess },
    { name: 'magicLinkExpiresAt', type: 'date', hidden: true, index: true, access: protectedCredentialFieldAccess },
    {
      name: 'accountProtection',
      type: 'select',
      required: true,
      defaultValue: 'email',
      options: [
        { label: 'Email verification', value: 'email' },
        { label: 'Strict password protection', value: 'strict-password' },
      ],
      hidden: true,
      access: protectedCredentialFieldAccess,
    },
    { name: 'strictPasswordHash', type: 'textarea', hidden: true, access: protectedCredentialFieldAccess },
    { name: 'strictPasswordAlgorithm', type: 'text', hidden: true, access: protectedCredentialFieldAccess },
    { name: 'strictPasswordParams', type: 'json', hidden: true, access: protectedCredentialFieldAccess },
    {
      name: 'syncGeneration',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1,
      hidden: true,
      access: protectedCredentialFieldAccess,
    },
  ],
}
