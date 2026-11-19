import type { CollectionConfig } from 'payload'
import { createChurchPeople, manageChurchPeople, readChurchPeople, updateRelationAsSystemAdmin } from '@/access'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'

const text = (name: string, en: string, ru: string, maxLength = 120) => ({
  name, type: 'text' as const, label: { en, ru }, maxLength,
  hooks: { beforeChange: [({ value }: { value?: unknown }) => typeof value === 'string' ? value.trim() || null : value] },
})

export const Households: CollectionConfig = {
  slug: 'households',
  labels: { singular: { en: 'Household', ru: 'Семья' }, plural: { en: 'Households', ru: 'Семьи' } },
  admin: {
    useAsTitle: 'name',
    group: 'People',
    defaultColumns: ['name', 'phone', 'updatedAt'],
    hideAPIURL: true,
    description: {
      en: 'A family or anyone living together. Add each person from the list below.',
      ru: 'Семья или люди, живущие вместе. Добавьте каждого человека в списке ниже.',
    },
    components: { views: { list: { Component: '@/components/HouseholdsListRedirect' } } },
  },
  defaultSort: 'name',
  access: { read: readChurchPeople, create: createChurchPeople, update: manageChurchPeople, delete: manageChurchPeople },
  fields: [
    {
      name: 'community', label: { en: 'Church', ru: 'Церковь' }, type: 'relationship', relationTo: 'communities',
      required: true, index: true, defaultValue: async ({ req }) => req?.payload ? getConfiguredCommunityId(req.payload) : null,
      access: { update: updateRelationAsSystemAdmin }, admin: { hidden: true },
    },
    {
      type: 'row', fields: [
        { ...text('name', 'Household name', 'Название семьи'), required: true,
          admin: { description: { en: 'For example: The Petrov family.', ru: 'Например: семья Петровых.' } } },
        text('phone', 'Home phone', 'Домашний телефон', 40),
      ],
    },
    {
      name: 'address', label: { en: 'Address', ru: 'Адрес' }, type: 'group',
      fields: [
        { type: 'row', fields: [text('street', 'Street address', 'Улица и дом', 200), text('unit', 'Apartment, unit or line 2', 'Квартира или доп. строка')] },
        { type: 'row', fields: [text('city', 'City', 'Город'), text('region', 'State / region', 'Штат / область'), text('postalCode', 'ZIP / postal code', 'Индекс', 20)] },
        text('country', 'Country', 'Страна'),
      ],
    },
    {
      name: 'members', label: { en: 'People in this household', ru: 'Члены семьи' }, type: 'join', collection: 'people', on: 'household',
      defaultSort: 'fullName', defaultLimit: 50,
      admin: { defaultColumns: ['fullName', 'householdRole', 'status', 'phone', 'email'], allowCreate: true },
    },
  ],
}
