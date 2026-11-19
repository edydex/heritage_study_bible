import type { CollectionConfig, Field } from 'payload'
import { churchPeopleEditorField, createChurchPeople, manageChurchPeople, readChurchPeople, updateRelationAsSystemAdmin } from '@/access'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import {
  GENDER_LABELS, GENDERS, HOUSEHOLD_ROLE_LABELS, HOUSEHOLD_ROLES, NAME_LIMIT, PERSON_STATUS_LABELS, PERSON_STATUSES,
  personFullName, validateDateOnly,
} from '@/lib/peopleProfiles'

const ru = {
  member: 'Член церкви', attender: 'Постоянный посетитель', visitor: 'Гость', inactive: 'Неактивен',
  head: 'Глава семьи', spouse: 'Супруг(а)', child: 'Ребёнок', other: 'Другое', male: 'Мужской', female: 'Женский',
} as Record<string, string>

const dateOnly = (name: string, en: string, ruLabel: string): Field => ({
  name, type: 'text', label: { en, ru: ruLabel },
  validate: (value: unknown) => validateDateOnly(value),
  admin: { components: { Field: '@/components/DateOnlyField#default' } },
})

const trimmed = ({ value }: { value?: unknown }) => typeof value === 'string' ? value.trim() || null : value

export const People: CollectionConfig = {
  slug: 'people',
  labels: { singular: { en: 'Person', ru: 'Человек' }, plural: { en: 'People', ru: 'Люди' } },
  admin: {
    useAsTitle: 'fullName',
    group: 'People',
    defaultColumns: ['fullName', 'status', 'household', 'email', 'phone'],
    listSearchableFields: ['fullName', 'firstName', 'lastName', 'email', 'phone'],
    hideAPIURL: true,
    description: {
      en: 'Everyone in the church directory, including children and visitors who never sign in.',
      ru: 'Все люди церкви, включая детей и гостей, у которых нет учётной записи.',
    },
    components: { views: { list: { Component: '@/components/PeopleListRedirect' } } },
  },
  defaultSort: ['lastName', 'firstName'],
  // One profile per account in each church; profiles without an account are unlimited.
  indexes: [{ fields: ['community', 'user'], unique: true }],
  access: { read: readChurchPeople, create: createChurchPeople, update: manageChurchPeople, delete: manageChurchPeople },
  fields: [
    {
      name: 'community', label: { en: 'Church', ru: 'Церковь' }, type: 'relationship', relationTo: 'communities',
      required: true, index: true, defaultValue: async ({ req }) => req?.payload ? getConfiguredCommunityId(req.payload) : null,
      access: { update: updateRelationAsSystemAdmin }, admin: { hidden: true },
    },
    {
      type: 'row', fields: [
        { name: 'firstName', label: { en: 'First name', ru: 'Имя' }, type: 'text', required: true, maxLength: NAME_LIMIT, hooks: { beforeChange: [trimmed] } },
        { name: 'lastName', label: { en: 'Last name', ru: 'Фамилия' }, type: 'text', maxLength: NAME_LIMIT, hooks: { beforeChange: [trimmed] } },
        {
          name: 'preferredName', label: { en: 'Goes by', ru: 'Как обращаться' }, type: 'text', maxLength: NAME_LIMIT, hooks: { beforeChange: [trimmed] },
          admin: { description: { en: 'Optional, for example "Sasha" for Alexander.', ru: 'Необязательно, например «Саша» для Александра.' } },
        },
      ],
    },
    {
      name: 'fullName', label: { en: 'Name', ru: 'Имя' }, type: 'text', index: true, admin: { hidden: true },
      hooks: { beforeChange: [({ siblingData, originalDoc }) => personFullName({ ...originalDoc, ...siblingData })] },
    },
    {
      type: 'row', fields: [
        {
          name: 'status', label: { en: 'Status', ru: 'Статус' }, type: 'select', required: true, defaultValue: 'member',
          options: PERSON_STATUSES.map(value => ({ value, label: { en: PERSON_STATUS_LABELS[value], ru: ru[value] } })),
        },
        {
          name: 'gender', label: { en: 'Gender', ru: 'Пол' }, type: 'select',
          options: GENDERS.map(value => ({ value, label: { en: GENDER_LABELS[value], ru: ru[value] } })),
        },
      ],
    },
    {
      type: 'row', fields: [
        {
          name: 'household', label: { en: 'Household', ru: 'Семья' }, type: 'relationship', relationTo: 'households', index: true,
          admin: { description: { en: 'Family members share one address and home phone. Use “+” to create a new household.', ru: 'Члены семьи используют общий адрес и домашний телефон. Нажмите «+», чтобы создать новую семью.' } },
        },
        {
          name: 'householdRole', label: { en: 'Role in household', ru: 'Роль в семье' }, type: 'select',
          options: HOUSEHOLD_ROLES.map(value => ({ value, label: { en: HOUSEHOLD_ROLE_LABELS[value], ru: ru[value] } })),
          admin: { condition: data => Boolean(data?.household) },
        },
      ],
    },
    {
      type: 'row', fields: [
        { name: 'email', label: { en: 'Email', ru: 'Электронная почта' }, type: 'email', hooks: { beforeChange: [({ value }) => typeof value === 'string' ? value.trim().toLowerCase() || null : value] } },
        { name: 'phone', label: { en: 'Mobile phone', ru: 'Мобильный телефон' }, type: 'text', maxLength: 40, hooks: { beforeChange: [trimmed] } },
      ],
    },
    {
      type: 'row', fields: [
        dateOnly('birthDate', 'Birth date', 'Дата рождения'),
        dateOnly('memberSince', 'Member since', 'Член церкви с'),
        dateOnly('baptismDate', 'Baptism date', 'Дата крещения'),
      ],
    },
    { name: 'account', type: 'ui', admin: { components: { Field: '@/components/PersonAccountNotice#default' } } },
    {
      // Linked automatically when someone joins the church with this email
      // address. Never grants permissions: church roles stay on memberships.
      name: 'user', type: 'relationship', relationTo: 'users', index: true, admin: { hidden: true },
      access: { create: updateRelationAsSystemAdmin, update: updateRelationAsSystemAdmin },
    },
    {
      name: 'notes', label: { en: 'Private notes', ru: 'Личные заметки' }, type: 'textarea', maxLength: 4000,
      access: { read: churchPeopleEditorField, create: churchPeopleEditorField, update: churchPeopleEditorField },
      admin: { description: { en: 'Only church owners and administrators can see these notes. They are never exported.', ru: 'Эти заметки видят только владелец и администраторы церкви. Они не попадают в экспорт.' } },
    },
  ],
}
