import type { CollectionConfig, PayloadRequest } from 'payload'
import { prepareCalendarEvent } from '@/lib/calendar'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { normalizeRegistrationSettings, validateRegistrationField } from '@/lib/eventRegistration'
import { createCommunityContent, manageCommunityContent, readMemberCommunityContent, updateRelationAsSystemAdmin } from '@/access'
import { canonicalTimeZone, validTimeOfDay } from '../../packages/calendar-core/index.js'

/** New events start from the church's calendar defaults. */
async function churchDefault<T>(req: PayloadRequest, pick: (church: Record<string, any>) => T, fallback: T) {
  const id = await getConfiguredCommunityId(req.payload)
  if (!id) return fallback
  try {
    return pick(await req.payload.findByID({ collection: 'communities', id, depth: 0, overrideAccess: true, req }) as Record<string, any>) ?? fallback
  } catch {
    return fallback
  }
}

const timeOfDay = (value: unknown) => value == null || value === '' || validTimeOfDay(value) || 'Enter a time such as 10:30 or 18:00.'

export const Events: CollectionConfig = {
  slug: 'events',
  labels: { singular: { en: 'Event', ru: 'Событие' }, plural: { en: 'Events', ru: 'События' } },
  admin: {
    useAsTitle: 'title',
    group: 'Community',
    description: {
      en: 'Click a calendar date to create an event. Set recurring services and choose who can see each event.',
      ru: 'Нажмите на дату в календаре, чтобы создать событие. Настройте регулярные служения и выберите, кто видит каждое событие.',
    },
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
    { name: 'calendarVersion', type: 'text', defaultValue: '1', admin: { hidden: true }, access: { create: () => false, update: () => false } },
    {
      name: 'community',
      label: { en: 'Church', ru: 'Церковь' },
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      defaultValue: async ({ req }) => getConfiguredCommunityId(req.payload),
      access: { update: updateRelationAsSystemAdmin },
      admin: { hidden: true },
    },
    { name: 'title', label: { en: 'Title', ru: 'Название' }, type: 'text', required: true },
    { name: 'allDay', label: { en: 'All day', ru: 'Весь день' }, type: 'checkbox', defaultValue: false },
    {
      type: 'row',
      fields: [
        { name: 'startsAt', label: { en: 'Starts', ru: 'Начало' }, type: 'date', required: true, index: true,
          admin: { date: { pickerAppearance: 'dayAndTime' }, components: { Field: '@/components/EventTimeField#default' } } },
        { name: 'endsAt', label: { en: 'Ends', ru: 'Окончание' }, type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' }, components: { Field: '@/components/EventTimeField#default' } } },
      ],
    },
    {
      name: 'timeZone', label: { en: 'Time zone', ru: 'Часовой пояс' }, type: 'text', required: true,
      defaultValue: async ({ req }) => churchDefault(req, church => canonicalTimeZone(church.timeZone) || null, 'America/Los_Angeles'),
      admin: { components: { Field: '@/components/TimeZoneField#default' } },
    },
    { name: 'location', label: { en: 'Location', ru: 'Место' }, type: 'text',
      defaultValue: async ({ req }) => churchDefault(req, church => church.calendarDefaultLocation || null, null) },
    { name: 'description', label: { en: 'Description', ru: 'Описание' }, type: 'textarea' },
    {
      name: 'visibility', label: { en: 'Who can see it?', ru: 'Кто видит?' }, type: 'select', required: true, defaultValue: 'inherit',
      options: [
        { label: { en: 'Church default', ru: 'Как в настройках церкви' }, value: 'inherit' },
        { label: { en: 'Public — everyone', ru: 'Все' }, value: 'public' },
        { label: { en: 'Members only', ru: 'Только члены церкви' }, value: 'members' },
      ],
      admin: { description: { en: 'For a recurring event, this applies to the entire series.', ru: 'Для повторяющегося события это относится ко всей серии.' } },
    },
    {
      name: 'recurrence', label: { en: 'Repeats', ru: 'Повторение' }, type: 'select', defaultValue: 'none',
      options: [
        { label: { en: 'Does not repeat', ru: 'Не повторяется' }, value: 'none' },
        { label: { en: 'Weekly', ru: 'Каждую неделю' }, value: 'weekly' },
        { label: { en: 'Monthly', ru: 'Каждый месяц' }, value: 'monthly' },
      ],
    },
    {
      type: 'row',
      admin: { condition: data => data.recurrence && data.recurrence !== 'none' },
      fields: [
        { name: 'repeatInterval', label: { en: 'Every (weeks or months)', ru: 'Каждые (недель или месяцев)' }, type: 'number', min: 1, max: 52, defaultValue: 1 },
        { name: 'repeatUntil', label: { en: 'Repeat until (optional)', ru: 'Повторять до (необязательно)' }, type: 'text',
          admin: { components: { Field: '@/components/DateOnlyField#default' } } },
      ],
    },
    {
      name: 'exceptions',
      label: { en: 'Changes to single dates', ru: 'Изменения в отдельные дни' },
      labels: { singular: { en: 'Date change', ru: 'Изменение' }, plural: { en: 'Date changes', ru: 'Изменения' } },
      type: 'array',
      maxRows: 200,
      admin: {
        condition: data => data.recurrence && data.recurrence !== 'none',
        initCollapsed: true,
        description: {
          en: 'Cancel one date, or give one date a different time, title or place. Every other date stays the same.',
          ru: 'Отмените один день или измените для него время, название или место. Остальные дни не меняются.',
        },
        components: { RowLabel: '@/components/EventExceptionRowLabel#default' },
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'date', label: { en: 'Date', ru: 'Дата' }, type: 'text', required: true,
              admin: { width: '40%', components: { Field: '@/components/DateOnlyField#default' } } },
            { name: 'cancelled', label: { en: 'Cancelled on this date', ru: 'В этот день отменено' }, type: 'checkbox', defaultValue: false,
              admin: { width: '60%', style: { alignSelf: 'end' } } },
          ],
        },
        {
          type: 'row',
          admin: { condition: (_data, siblingData) => !siblingData?.cancelled },
          fields: [
            { name: 'startTime', label: { en: 'New start time', ru: 'Новое время начала' }, type: 'text', validate: timeOfDay,
              admin: { width: '50%', components: { Field: '@/components/TimeOfDayField#default' } } },
            { name: 'endTime', label: { en: 'New end time', ru: 'Новое время окончания' }, type: 'text', validate: timeOfDay,
              admin: { width: '50%', components: { Field: '@/components/TimeOfDayField#default' } } },
          ],
        },
        {
          type: 'row',
          admin: { condition: (_data, siblingData) => !siblingData?.cancelled },
          fields: [
            { name: 'title', label: { en: 'Different title', ru: 'Другое название' }, type: 'text', admin: { width: '50%' } },
            { name: 'location', label: { en: 'Different place', ru: 'Другое место' }, type: 'text', admin: { width: '50%' } },
          ],
        },
        { name: 'note', label: { en: 'Note for this date', ru: 'Пояснение для этого дня' }, type: 'text', maxLength: 300,
          admin: { placeholder: 'Christmas Eve service' } },
      ],
    },
    {
      name: 'defaultReminderMinutes',
      label: { en: 'Reminder in members’ calendars', ru: 'Напоминание в календаре' },
      type: 'number', min: 0, max: 40320,
      defaultValue: async ({ req }) => churchDefault(req, church => church.calendarDefaultReminderMinutes ?? null, null),
      admin: { components: { Field: '@/components/ReminderField#default' } },
    },
    { name: 'url', label: { en: 'Registration or event website (optional)', ru: 'Сайт события или регистрации (необязательно)' }, type: 'text',
      admin: { description: { en: 'An external website for registration or more information. Use a complete https:// address, or leave blank. The church event details page is created automatically.', ru: 'Внешний сайт для регистрации или подробностей. Укажите полный адрес https:// или оставьте пустым. Страница события создаётся автоматически.' } } },
    { name: 'rsvpEnabled', label: { en: 'Let members RSVP', ru: 'Члены церкви могут ответить, придут ли' }, type: 'checkbox', defaultValue: true },
    { name: 'cancelled', label: { en: 'Event is cancelled', ru: 'Событие отменено' }, type: 'checkbox', defaultValue: false,
      admin: { description: { en: 'For a recurring event this cancels every date. To cancel one date, use Changes to single dates.', ru: 'Для повторяющегося события это отменяет все дни. Чтобы отменить один день, используйте «Изменения в отдельные дни».' } } },
    {
      name: 'registration',
      label: { en: 'Sign-up form', ru: 'Форма регистрации' },
      type: 'json',
      validate: (value: unknown, { data }: { data?: { recurrence?: unknown } }) => validateRegistrationField(value, data?.recurrence),
      hooks: { beforeChange: [({ value }) => value == null ? null : normalizeRegistrationSettings(value)] },
      admin: { components: { Field: '@/components/RegistrationSettingsField#default' } },
    },
    { name: 'registrationsPanel', type: 'ui', admin: { components: { Field: '@/components/EventRegistrationsPanel#default' } } },
  ],
}
