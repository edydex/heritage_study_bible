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
  admin: { useAsTitle: 'email' },
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
              ? { collection: 'users', ...user, systemRole: 'member' }
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
    update: ({ req }) => req.user?.systemRole === 'system-admin' ? true : { id: { equals: req.user?.id } },
    delete: ({ req }) => req.user?.systemRole === 'system-admin',
  },
  fields: [
    { name: 'displayName', type: 'text', required: true, defaultValue: 'Reader' },
    {
      name: 'systemRole',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'System administrator', value: 'system-admin' },
        { label: 'Member', value: 'member' },
      ],
      access: {
        create: canSetInitialSystemRole,
        update: isSystemAdminField,
      },
    },
    { name: 'magicLinkTokenHash', type: 'text', hidden: true, index: true, access: protectedCredentialFieldAccess },
    { name: 'magicLinkExpiresAt', type: 'date', hidden: true, index: true, access: protectedCredentialFieldAccess },
  ],
}
