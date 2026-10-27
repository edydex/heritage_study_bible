import type { CollectionConfig, FieldAccess } from 'payload'
import { markCommunitySessionUser } from '@/lib/communitySession'
import { communityAuthEnabled } from '@/lib/publicConfig'
import { hashOpaqueToken } from '@/lib/tokens'
import { acceptWorkspaceInvitations } from '@/lib/workspaceInvitation'
import { communityPublicConfig } from '@/lib/publicConfig'
import { workspaceLanguageOptions, workspaceLanguageURL, workspacePasswordEmail } from '@/lib/workspaceLanguage'

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
  labels: { singular: { en: 'Account', ru: 'Учётная запись' }, plural: { en: 'Accounts', ru: 'Учётные записи' } },
  admin: {
    useAsTitle: 'email',
    group: 'People',
    description: { en: 'Add people from People → Invite person. They receive a link and choose their own password. These account details are for existing accounts.', ru: 'Добавляйте людей через «Люди → Пригласить». Они получат ссылку и сами создадут пароль. Здесь находятся настройки существующих учётных записей.' },
    defaultColumns: ['displayName', 'email', 'systemRole', 'updatedAt'],
    listSearchableFields: ['displayName', 'email'],
    hideAPIURL: true,
    components: { views: { list: { Component: '@/components/PeopleListRedirect' } } },
  },
  auth: {
    forgotPassword: {
      generateEmailSubject: args => workspacePasswordEmail({ name: communityPublicConfig.name, url: '', language: args?.user?.preferredLanguage }).subject,
      generateEmailHTML: args => workspacePasswordEmail({ name: communityPublicConfig.name,
        url: workspaceLanguageURL(`${communityPublicConfig.publicUrl}/admin/reset/${encodeURIComponent(args?.token || '')}`, args?.user?.preferredLanguage),
        language: args?.user?.preferredLanguage }).html,
    },
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
          const authenticatedUser = user
            ? { ...user, collection: 'users' as const, systemRole: 'member' as const }
            : null
          return {
            user: authenticatedUser
              ? markCommunitySessionUser(authenticatedUser, session.id)
              : null,
          }
        },
      },
    ],
  },
  hooks: { afterLogin: [acceptWorkspaceInvitations] },
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
    { name: 'localizationPreference', type: 'ui', admin: { components: { Field: '@/components/WorkspaceLocalization#AccountLocalizationPreference' } } },
    { name: 'preferredLanguage', type: 'select', defaultValue: 'en', options: workspaceLanguageOptions,
      admin: { hidden: true } },
    { name: 'presentationPreference', type: 'ui', admin: { components: { Field: '@/components/PresentationAccessibility#PersonalPresentationPreference' } } },
    { name: 'displayName', label: { en: 'Name', ru: 'Имя' }, type: 'text', required: true, defaultValue: 'Reader' },
    {
      name: 'systemRole',
      label: { en: 'Server access', ru: 'Доступ к серверу' },
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: { en: 'System administrator', ru: 'Администратор сервера' }, value: 'system-admin' },
        { label: { en: 'Member', ru: 'Участник' }, value: 'member' },
      ],
      admin: { description: { en: 'Most people should be Members. Change church roles from People.', ru: 'Большинству людей достаточно доступа «Участник». Роли в церкви изменяются на странице «Люди».' } },
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
