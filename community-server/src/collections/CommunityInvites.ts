import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'
import { sendInvitationEmail } from '@/lib/communityInvitationEmail'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { workspaceLanguageOptions } from '@/lib/workspaceLanguage'

const invitationRoles = [
  { label: { en: 'Member', ru: 'Участник' }, value: 'member' },
  { label: { en: 'Church leader — workspace access', ru: 'Руководитель церкви — рабочая область' }, value: 'leader' },
  { label: { en: 'Church administrator — workspace access', ru: 'Администратор церкви — рабочая область' }, value: 'admin' },
]

export const CommunityInvites: CollectionConfig = {
  slug: 'community-invites',
  labels: { singular: { en: 'Invitation', ru: 'Приглашение' }, plural: { en: 'Invitations', ru: 'Приглашения' } },
  admin: {
    useAsTitle: 'email',
    group: 'People',
    description: { en: 'Choose a church role and language, then save to send an invitation. Workspace invitations let leaders and church administrators choose their own password.', ru: 'Выберите роль и язык, затем сохраните приглашение, чтобы отправить письмо. Руководители и администраторы церкви сами создадут пароль для рабочей области.' },
    defaultColumns: ['email', 'role', 'active', 'emailSentAt', 'acceptedAt', 'preferredLanguage'],
    listSearchableFields: ['email', 'displayName'],
    hideAPIURL: true,
    components: { views: { list: { Component: '@/components/PeopleListRedirect' } } },
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
    { name: 'invitationGuide', type: 'ui', admin: { components: { Field: '@/components/InvitationGuide' } } },
    {
      name: 'community',
      label: { en: 'Church', ru: 'Церковь' },
      type: 'relationship',
      relationTo: 'communities',
      defaultValue: async ({ req }) => req?.payload ? getConfiguredCommunityId(req.payload) : null,
      required: true,
      index: true,
      admin: { description: { en: 'The church this person may join.', ru: 'Церковь, к которой присоединится этот человек.' } },
    },
    {
      name: 'email',
      label: { en: 'Email address', ru: 'Электронная почта' },
      type: 'email',
      required: true,
      index: true,
    },
    {
      name: 'displayName',
      label: { en: 'Name', ru: 'Имя' },
      type: 'text',
      admin: { description: { en: 'Optional. The member can change their display name later.', ru: 'Необязательно. Человек сможет изменить имя позднее.' } },
    },
    {
      name: 'role',
      label: { en: 'What may this person do?', ru: 'Какие права предоставить?' },
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: invitationRoles,
      admin: { description: { en: 'Members receive a Heritage join link. Leaders and church administrators receive a workspace password-setup link for service planning, songs and sermons. This does not grant server-wide administration or reduce an existing role.', ru: 'Участники получают ссылку для подключения к Heritage. Руководители и администраторы церкви получают ссылку для создания пароля и доступа к подготовке богослужений, песням и проповедям. Приглашение не предоставляет права администратора сервера и не снижает существующие права.' } },
    },
    {
      name: 'preferredLanguage', label: { en: 'Invitation and workspace language', ru: 'Язык приглашения и рабочей области' },
      type: 'select', defaultValue: 'en', options: workspaceLanguageOptions,
      admin: { description: { en: 'The email, password setup and menus use this language. The recipient can change it in My account. Existing accounts keep their current language.', ru: 'Этот язык используется в письме, при создании пароля и в меню. Получатель сможет изменить его в своей учётной записи. У существующих учётных записей язык сохраняется.' } },
    },
    {
      name: 'active',
      label: { en: 'Invitation is active', ru: 'Приглашение действует' },
      type: 'checkbox',
      defaultValue: true,
      required: true,
      index: true,
    },
    {
      name: 'sendEmailNow',
      label: { en: 'Email this invitation now', ru: 'Отправить приглашение сейчас' },
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: { en: 'Save to send. Select again and save to resend. Member join links last 15 minutes; workspace password-setup links last 24 hours. For an accepted invitation, reactivate it to send again.', ru: 'Сохраните, чтобы отправить письмо. Выберите снова и сохраните для повторной отправки. Ссылка участника действует 15 минут, ссылка для создания пароля — 24 часа. Для повторной отправки принятого приглашения включите его снова.' },
      },
    },
    {
      name: 'emailSentAt',
      label: { en: 'Invitation email sent', ru: 'Письмо отправлено' },
      type: 'date',
      admin: { readOnly: true, date: { displayFormat: 'MMM d, yyyy h:mm a' } },
    },
    {
      name: 'acceptedAt',
      label: { en: 'Invitation accepted', ru: 'Приглашение принято' },
      type: 'date',
      admin: { readOnly: true, date: { displayFormat: 'MMM d, yyyy h:mm a' } },
    },
  ],
}
