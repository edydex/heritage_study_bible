import type { CollectionConfig } from 'payload'
import { prepareCalendarEvent } from '@/lib/calendar'
import { createCommunityContent, manageCommunityContent, readMemberCommunityContent, updateRelationAsSystemAdmin } from '@/access'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    group: 'Community',
    description: 'Click a calendar date to create an event. Set recurring services and choose who can see each event.',
    components: { beforeList: ['@/components/EventsCalendar#default'] },
    defaultColumns: ['title', 'startsAt', 'recurrence', 'visibility', 'location'],
    listSearchableFields: ['title', 'location'],
    hideAPIURL: true,
  },
  access: {
    read: readMemberCommunityContent,
    create: createCommunityContent,
    update: manageCommunityContent,
    delete: manageCommunityContent,
  },
  hooks: { beforeValidate: [prepareCalendarEvent] },
  defaultSort: ['startsAt', 'title', 'id'],
  fields: [
    {
      name: 'community',
      label: 'Church',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'startsAt', label: 'Starts', type: 'date', required: true, index: true },
    { name: 'endsAt', label: 'Ends', type: 'date' },
    { name: 'timeZone', label: 'Time zone', type: 'text', required: true, admin: { description: 'Use America/Los_Angeles for Pacific time, including daylight saving. PST and PDT are converted automatically.' } },
    { name: 'visibility', type: 'select', required: true, defaultValue: 'inherit', options: [{ label: 'Church default', value: 'inherit' }, { label: 'Public — everyone', value: 'public' }, { label: 'Members only', value: 'members' }], admin: { description: 'For a recurring event, this applies to the entire series.' } },
    { name: 'recurrence', label: 'Repeats', type: 'select', defaultValue: 'none', options: [{label: 'Does not repeat', value: 'none'}, {label: 'Weekly', value: 'weekly'}, {label: 'Monthly', value: 'monthly'}] },
    { name: 'repeatInterval', label: 'Every (weeks or months)', type: 'number', min: 1, max: 52, defaultValue: 1, admin: { condition: data => data.recurrence && data.recurrence !== 'none' } },
    { name: 'repeatUntil', label: 'Repeat until (optional)', type: 'text', admin: { description: 'Last date, inclusive, in YYYY-MM-DD format. Leave blank to keep repeating.', condition: data => data.recurrence && data.recurrence !== 'none' } },
    { name: 'location', type: 'text' },
    { name: 'url', label: 'Registration or event website (optional)', type: 'text', admin: { description: 'An external website for registration or more information. Use a complete https:// address, or leave blank. The church event details page is created automatically.' } },
    { name: 'rsvpEnabled', label: 'Let members RSVP', type: 'checkbox', defaultValue: true },
    { name: 'defaultReminderMinutes', label: 'Default reminder (minutes before)', type: 'number', min: 0, defaultValue: 60 },
    { name: 'cancelled', label: 'Event is cancelled', type: 'checkbox', defaultValue: false },
  ],
}
