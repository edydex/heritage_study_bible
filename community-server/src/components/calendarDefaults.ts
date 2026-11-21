'use client'

import { useEffect, useState } from 'react'

export type CalendarDefaults = {
  communityId: number; timeZone: string; defaultVisibility: 'members' | 'public'; defaultStartTime: string
  defaultDurationMinutes: number; defaultReminderMinutes: number | null; defaultLocation: string
}

const FALLBACK: CalendarDefaults = { communityId: 0, timeZone: 'America/Los_Angeles', defaultVisibility: 'members', defaultStartTime: '10:00',
  defaultDurationMinutes: 60, defaultReminderMinutes: 60, defaultLocation: '' }
let cached: Promise<CalendarDefaults> | null = null

export function loadCalendarDefaults(refresh = false) {
  if (!cached || refresh) {
    cached = fetch('/api/community/calendar/settings', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : FALLBACK).catch(() => FALLBACK)
  }
  return cached
}

/** The church's calendar defaults (time zone, start time, length, reminder, place) for new events. */
export function useCalendarDefaults() {
  const [defaults, setDefaults] = useState<CalendarDefaults>(FALLBACK)
  useEffect(() => { let live = true; void loadCalendarDefaults().then(value => { if (live) setDefaults(value) }); return () => { live = false } }, [])
  return defaults
}

/** Reminder choices, in minutes before the event; null means no reminder. */
export const REMINDER_CHOICES: Array<number | null> = [null, 0, 10, 15, 30, 60, 120, 1440, 2880, 10080]

export function reminderLabel(minutes: number | null, t: (value: string, variables?: Record<string, string | number>) => string) {
  if (minutes === null || minutes === undefined) return t('No reminder')
  if (minutes === 0) return t('At the start time')
  if (minutes % 10080 === 0) return t('{count} week(s) before', { count: minutes / 10080 })
  if (minutes % 1440 === 0) return t('{count} day(s) before', { count: minutes / 1440 })
  if (minutes % 60 === 0) return t('{count} hour(s) before', { count: minutes / 60 })
  return t('{count} minutes before', { count: minutes })
}

export function durationLabel(minutes: number, t: (value: string, variables?: Record<string, string | number>) => string) {
  if (minutes % 60 === 0) return t('{count} hour(s)', { count: minutes / 60 })
  if (minutes > 60) return t('{hours} h {minutes} min', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
  return t('{count} minutes', { count: minutes })
}
