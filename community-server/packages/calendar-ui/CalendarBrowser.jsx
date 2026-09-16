'use client'
import { useEffect, useState } from 'react'
import CalendarGrid from './CalendarGrid.jsx'
import { localDate, monthDays, eventPagePath, formatEventTime, eventIncludesDate } from '../calendar-core/index.js'

async function defaultLoad(path) {
  const response = await fetch(`/api/${path}`, { cache: 'no-store', credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not load the calendar.')
  return result
}
export default function CalendarBrowser({ load = defaultLoad, eventHref = eventPagePath }) {
  const [month, setMonth] = useState(() => localDate(Date.now()).slice(0, 7))
  const [result, setResult] = useState({ events: [], timeZone: 'UTC' })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [filters, setFilters] = useState({ events: true, recurring: false })
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setBusy(true); setError(''); setSelected(null); setResult(value => ({ ...value, events: [] }))
    const days = monthDays(month)
    load(`community/calendar?from=${days[0]}&to=${days.at(-1)}`)
      .then(value => { if (active) setResult(value) })
      .catch(reason => { if (active) setError(reason.message || 'Could not load the calendar.') })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [month, load, refresh])
  const events = selected ? result.events.filter(event => (event.recurring ? filters.recurring : filters.events)).filter(event => event.instanceId === selected || eventIncludesDate(event, selected, result.timeZone)) : []
  return <div className="church-calendar-browser">
    <div className="church-calendar__toolbar"><h2>Calendar</h2><button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh</button></div>
    <CalendarGrid month={month} onMonthChange={setMonth} events={result.events} timeZone={result.timeZone} busy={busy} showEmpty={!error} onFilterChange={setFilters} selectedDate={selected} onDateSelect={setSelected} eventHref={eventHref} />
    {error && <p role="alert">{error}</p>}
    {!busy && !error && !result.authenticated && <p className="church-calendar__empty">Public events are shown. Church members can sign in through Heritage to see member events.</p>}
    {selected && <div className="church-calendar__details" aria-live="polite">
      {!events.length && <p>No events on this date.</p>}
      {events.map(event => <article key={event.instanceId}>
        <h3><a href={eventHref(event)}>{event.title} →</a></h3>
        <p>{formatEventTime(event.startsAt, event.timeZone)}</p>
      </article>)}
    </div>}
  </div>
}
