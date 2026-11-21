import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, updateRelationAsSystemAdmin } from '@/access'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { POSITION_NAME_LIMIT, TEAM_NAME_LIMIT } from '@/lib/serving'
import { prepareTeam } from '@/lib/servingHooks'

// A serving team (worship, sound and slides, greeters, children) with the
// positions it fills at each service and the people who can serve on it.
export const Teams: CollectionConfig = {
  slug: 'teams',
  labels: { singular: { en: 'Team', ru: 'Команда' }, plural: { en: 'Teams', ru: 'Команды' } },
  admin: {
    useAsTitle: 'name',
    group: 'People',
    defaultColumns: ['name', 'positions', 'members'],
    hideAPIURL: true,
    description: {
      en: 'Positions are the places to fill at each service, for example Vocals, Guitar or Sound. Team members are the people you can schedule.',
      ru: 'Роли — это места, которые нужно заполнить на каждом служении, например вокал, гитара или звук. Участники команды — люди, которых можно назначать.',
    },
    components: { views: { list: { Component: '@/components/ServingListRedirect#TeamsListRedirect' } } },
  },
  defaultSort: ['name'],
  access: { read: manageCommunityContent, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  hooks: { beforeChange: [prepareTeam] },
  fields: [
    {
      name: 'community', type: 'relationship', relationTo: 'communities', required: true, index: true,
      defaultValue: async ({ req }) => getConfiguredCommunityId(req.payload),
      access: { update: updateRelationAsSystemAdmin },
      admin: { hidden: true },
    },
    { name: 'name', label: { en: 'Team name', ru: 'Название команды' }, type: 'text', required: true, maxLength: TEAM_NAME_LIMIT,
      admin: { placeholder: 'Worship' } },
    { name: 'description', label: { en: 'Notes for the team (optional)', ru: 'Заметки для команды (необязательно)' }, type: 'textarea', maxLength: 1000 },
    {
      name: 'positions',
      label: { en: 'Positions', ru: 'Роли' },
      labels: { singular: { en: 'Position', ru: 'Роль' }, plural: { en: 'Positions', ru: 'Роли' } },
      type: 'array',
      minRows: 1,
      maxRows: 30,
      required: true,
      admin: { initCollapsed: false, components: { RowLabel: '@/components/PositionRowLabel#default' } },
      fields: [{
        type: 'row',
        fields: [
          { name: 'name', label: { en: 'Position', ru: 'Роль' }, type: 'text', required: true, maxLength: POSITION_NAME_LIMIT,
            admin: { placeholder: 'Guitar', width: '70%' } },
          { name: 'needed', label: { en: 'People needed', ru: 'Сколько человек' }, type: 'number', required: true, min: 1, max: 20,
            defaultValue: 1, admin: { width: '30%' } },
        ],
      }],
    },
    {
      name: 'members',
      label: { en: 'Team members', ru: 'Участники команды' },
      type: 'relationship',
      relationTo: 'people',
      hasMany: true,
      filterOptions: ({ data }) => data?.community ? { community: { equals: typeof data.community === 'object' ? data.community.id : data.community } } : true,
      admin: { description: { en: 'Add people from the church directory.', ru: 'Добавьте людей из списка церкви.' } },
    },
  ],
}
