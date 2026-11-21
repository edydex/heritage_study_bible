'use client'
import { useState } from 'react'
import { localDate, calendarWeeks, eventIncludesDate, shiftMonth, canonicalTimeZone } from '../calendar-core/index.js'
import './calendar.css'

const ENGLISH = { previousMonth: 'Previous month', nextMonth: 'Next month', today: 'Today', events: 'Events', recurring: 'Recurring', loading: 'Loading…',
  empty: 'No events match these filters this month.', createEvent: 'create event', viewEvents: 'view events', eventCount: 'events', cancelled: 'cancelled' }
const ENGLISH_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startTime(event, timeZone, locale) {
  try { return new Date(event.startsAt).toLocaleTimeString(locale || 'en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).replace(/\s?([AP])M$/i, (_, half) => half.toLowerCase()) } catch { return '' }
}

export default function CalendarGrid({ month, onMonthChange, events = [], timeZone = 'UTC', onDateSelect, onEventSelect, eventHref, selectedDate, busy = false, defaultRecurring = false, create = false, onFilterChange, showEmpty = true, locale, labels, showTimes = false }) {
  const text = { ...ENGLISH, ...labels }
  // 2026-11-01 is a Sunday; the weekday names follow the chosen language.
  const weekdays = locale ? Array.from({ length: 7 }, (_, day) => new Date(Date.UTC(2026, 10, 1 + day, 12)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })) : ENGLISH_DAYS
  timeZone = canonicalTimeZone(timeZone) || 'UTC'
  const [showEvents, setShowEvents] = useState(true)
  const [showRecurring, setShowRecurring] = useState(defaultRecurring)
  const visible = events.filter(event => event.recurring ? showRecurring : showEvents)
  const weeks = calendarWeeks(month, visible, timeZone)
  const heading = new Date(`${month}-15T12:00:00Z`).toLocaleDateString(locale || 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return <section className="church-calendar" aria-label="Church calendar" aria-busy={busy}>
    <div className="church-calendar__toolbar">
      <button type="button" aria-label={text.previousMonth} onClick={() => onMonthChange(shiftMonth(month, -1))}>‹</button>
      <h3 aria-live="polite">{heading}</h3>
      <button type="button" aria-label={text.nextMonth} onClick={() => onMonthChange(shiftMonth(month, 1))}>›</button>
      <button type="button" onClick={() => onMonthChange(localDate(Date.now(), timeZone).slice(0, 7))}>{text.today}</button>
    </div>
    <div className="church-calendar__filters">
      <label><input type="checkbox" checked={showEvents} onChange={event => { setShowEvents(event.target.checked); onFilterChange?.({ events: event.target.checked, recurring: showRecurring }) }} /> {text.events}</label>
      <label><input type="checkbox" checked={showRecurring} onChange={event => { setShowRecurring(event.target.checked); onFilterChange?.({ events: showEvents, recurring: event.target.checked }) }} /> {text.recurring}</label>
      <small>{timeZone.replaceAll('_', ' ')}{busy ? ` · ${text.loading}` : ''}</small>
    </div>
    <div className="church-calendar__weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
    <div className="church-calendar__grid">
      {weeks.map(week => <div key={week.dates[0]} className="church-calendar__week" style={{ gridTemplateRows: `2.75rem repeat(${Math.max(1, week.lanes)}, minmax(1.8rem, auto)) minmax(.4rem, 1fr)` }}>
        {week.dates.map((date, column) => {
        const matches = visible.filter(event => eventIncludesDate(event, date, timeZone))
        return <div key={date} className="church-calendar__day" style={{ gridColumn: column + 1, gridRow: '1 / -1' }} data-outside={date.slice(0, 7) !== month || undefined} data-selected={selectedDate === date || undefined}>
          <button type="button" className="church-calendar__date" aria-label={`${date}, ${create ? text.createEvent : text.viewEvents}${matches.length ? `, ${matches.length} ${text.eventCount}` : ''}`} onClick={() => onDateSelect?.(date)}>{Number(date.slice(8))}</button>
        </div>
        })}
        {week.entries.map(({ event, start, end, lane, continuesBefore, continuesAfter }) => {
          const Tag = eventHref ? 'a' : 'button'
          return <Tag key={event.instanceId} {...(eventHref ? { href: eventHref(event) } : { type: 'button', onClick: () => onEventSelect?.(event) })} className="church-calendar__event" style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: lane + 2 }} data-continues-before={continuesBefore || undefined} data-continues-after={continuesAfter || undefined} data-cancelled={event.cancelled || undefined} data-changed={event.changed || undefined} title={event.cancelled ? `${event.title} (${text.cancelled})` : event.title}>{continuesBefore && <span aria-hidden="true">‹ </span>}{showTimes && !event.allDay && !continuesBefore && <span className="church-calendar__time">{startTime(event, timeZone, locale)} </span>}{event.title}{continuesAfter && <span aria-hidden="true"> ›</span>}</Tag>
        })}
      </div>)}
    </div>
    {!busy && showEmpty && !visible.length && <p className="church-calendar__empty">{text.empty}</p>}
  </section>
}
