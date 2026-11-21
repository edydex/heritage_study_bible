'use client'

import { FieldDescription, FieldError, FieldLabel, useField, useFormFields } from '@payloadcms/ui'
import { mergeFieldStyles } from '@payloadcms/ui/shared'
import type { DateFieldClientProps } from 'payload'
import { useState } from 'react'
import { addDays, canonicalTimeZone, localDate, localDateTime, localToInstant, timeZoneLabel } from '../../packages/calendar-core/index.js'
import { useCalendarDefaults } from './calendarDefaults'
import { useMounted } from './useMounted'
import { useWorkspaceText } from './useWorkspaceText'

const valid = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))

/**
 * Start or end of an event as a date and a clock time in the event's own time
 * zone (not the browser's). All-day events show dates only; their end is
 * stored as the midnight after the last day.
 */
export default function EventTimeField({ field, path, readOnly }: DateFieldClientProps) {
  const t = useWorkspaceText()
  const defaults = useCalendarDefaults()
  const mounted = useMounted()
  const { value, setValue, showError, errorMessage, disabled } = useField<string | null>({ path })
  const prefix = path.includes('.') ? `${path.slice(0, path.lastIndexOf('.'))}.` : ''
  const name = path.slice(prefix.length)
  const isStart = name === 'startsAt'
  const zoneValue = useFormFields(([fields]) => fields[`${prefix}timeZone`]?.value as string | undefined)
  const allDay = Boolean(useFormFields(([fields]) => fields[`${prefix}allDay`]?.value))
  const startsAt = useFormFields(([fields]) => fields[`${prefix}startsAt`]?.value as string | undefined)
  const endsAt = useFormFields(([fields]) => fields[`${prefix}endsAt`]?.value as string | undefined)
  const dispatch = useFormFields(([, dispatchFields]) => dispatchFields)
  const [problem, setProblem] = useState('')
  const zone = canonicalTimeZone(zoneValue) || defaults.timeZone
  const locked = Boolean(readOnly || disabled)
  const id = `field-${path.replace(/\./g, '__')}`

  const shown = valid(value) ? (allDay && !isStart ? localDate(Date.parse(value) - 1, zone) : localDate(value, zone)) : ''
  const shownTime = valid(value) && !allDay ? localDateTime(value, zone).slice(11) : ''

  const setEnd = (next: string | null) => dispatch({ type: 'UPDATE', path: `${prefix}endsAt`, value: next })
  const update = (date: string, time: string) => {
    setProblem('')
    if (!date) {
      setValue(null)
      return
    }
    try {
      let next: string
      if (allDay) next = localToInstant(`${isStart ? date : addDays(date, 1)}T00:00`, zone)
      else next = localToInstant(`${date}T${time || (isStart ? defaults.defaultStartTime : valid(startsAt) ? localDateTime(startsAt, zone).slice(11) : defaults.defaultStartTime)}`, zone)
      setValue(next)
      if (isStart) {
        // Moving the start moves the end with it, keeping the event's length.
        const oldStart = valid(startsAt) ? Date.parse(startsAt) : NaN
        const oldEnd = valid(endsAt) ? Date.parse(endsAt) : NaN
        const length = Number.isFinite(oldStart) && Number.isFinite(oldEnd) && oldEnd > oldStart ? oldEnd - oldStart
          : allDay ? 0 : defaults.defaultDurationMinutes * 60000
        if (allDay) {
          const days = length ? Math.max(1, Math.round(length / 86400000)) : 1
          setEnd(localToInstant(`${addDays(date, days)}T00:00`, zone))
        } else if (length) setEnd(new Date(Date.parse(next) + length).toISOString())
      }
    } catch {
      setProblem(t('That time does not exist on this date because the clocks change. Choose another time.'))
    }
  }

  const label = allDay ? (isStart ? t('First day') : t('Last day')) : field.label
  return <div className={['field-type', 'date-time-field', 'heritage-event-time', showError && 'error', locked && 'read-only'].filter(Boolean).join(' ')} style={mergeFieldStyles(field)}>
    <FieldLabel htmlFor={id} label={label} path={path} required={field.required} />
    <div className="field-type__wrap">
      <FieldError path={path} showError={showError} message={errorMessage} />
      <div className="heritage-event-time__inputs">
        <input id={id} type="date" value={shown} disabled={locked} min="1900-01-01" max="9999-12-31"
          aria-label={t('Date')} onChange={event => update(event.target.value, shownTime)} />
        {!allDay && <input type="time" step={300} value={shownTime} disabled={locked || !shown} aria-label={t('Time')}
          onChange={event => update(shown, event.target.value)} />}
        {!isStart && !locked && valid(value) && <button type="button" className="heritage-event-time__clear" onClick={() => setValue(null)}>{t('Clear')}</button>}
      </div>
      {problem && <p className="heritage-event-time__problem" role="alert">{problem}</p>}
    </div>
    <FieldDescription description={isStart && !allDay && mounted ? t('In {zone}', { zone: timeZoneLabel(zone, t.language) }) : field.admin?.description} path={path} />
  </div>
}
