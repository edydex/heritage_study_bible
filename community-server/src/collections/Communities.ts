import type { CollectionConfig } from 'payload'
import { isSystemAdmin } from '@/access'
import { youtubeChannel, youtubeVideoId, publicTranslationUrl } from '@/lib/liveServiceConfig'

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
    {
      name: 'liveService',
      label: 'Live service',
      type: 'group',
      fields: [
        {
          name: 'youtubeChannelUrl', label: 'YouTube channel', type: 'text',
          admin: { description: 'The church channel, for example https://www.youtube.com/@wordoftruthbiblech.' },
          validate: (value: unknown) => value == null || value === '' || youtubeChannel(value) ? true : 'Enter a YouTube channel URL using its @handle or channel ID.',
        },
        {
          name: 'youtubeVideoUrl', label: 'Current service video', type: 'text',
          admin: { description: 'Paste the scheduled or current YouTube stream link. Clear it when no video should be embedded.' },
          validate: (value: unknown) => value == null || value === '' || youtubeVideoId(value) ? true : 'Enter a YouTube watch, live, or share URL for a specific video.',
        },
        {
          name: 'translationUrl', label: 'Live translation page', type: 'text',
          admin: { description: 'Use /translate for the integrated listener, or the public HTTPS address of your existing Multilinguum listener. Never enter a processor address or access token.' },
          validate: (value: unknown) => value == null || value === '' || publicTranslationUrl(value) ? true : 'Enter /translate or a public HTTPS listener URL without a query string, fragment, or credentials.',
        },
        {
          name: 'broadcastDelaySeconds', label: 'Broadcast delay (seconds)', type: 'number', defaultValue: 0, min: 0, max: 180,
          admin: { description: 'Measured delay from the church sound feed to the YouTube broadcast. This is a starting point for alignment; verify against the current stream.' },
        },
      ],
    },
  ],
}
