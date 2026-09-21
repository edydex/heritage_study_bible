'use client'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import CalendarGrid from '../../packages/calendar-ui/CalendarGrid.jsx'
import { localDate, localDateTime, localToInstant, monthDays } from '../../packages/calendar-core/index.js'
import './EventsCalendar.css'

async function api(path: string, options?: RequestInit) {
  const response = await fetch(`/api/${path}`, { cache: 'no-store', credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || value.errors?.[0]?.data?.errors?.map((error: any) => error.message).join(' ') || value.errors?.[0]?.message || 'Could not save the event.')
  return value
}
export default function EventsCalendar() {
  const router = useRouter()
  const [month, setMonth] = useState(() => localDate(Date.now()).slice(0, 7))
  const [settings, setSettings] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [draft, setDraft] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const load = useCallback(async () => {
    const days = monthDays(month)
    const result = await api(`community/calendar?from=${days[0]}&to=${days.at(-1)}`)
    setEvents(result.events)
  }, [month])
  useEffect(() => { api('community/calendar/settings').then(setSettings).catch(error => setError(error.message)) }, [])
  useEffect(() => { load().catch(error => setError(error.message)) }, [load])
  function create(date: string) {
    if (!settings) return
    setError(''); setNotice('')
    setDraft({ title: '', start: `${date}T10:00`, end: `${date}T11:00`, timeZone: settings.timeZone, visibility: 'inherit', recurrence: 'none', repeatInterval: 1, repeatUntil: '', location: '', description: '', url: '', rsvpEnabled: true })
  }
  async function edit(event: any) {
    setBusy(true); setError('')
    try {
      const doc = await api(`events/${event.id}?depth=0`)
      setDraft({ ...doc, start: localDateTime(doc.startsAt, doc.timeZone), end: doc.endsAt ? localDateTime(doc.endsAt, doc.timeZone) : '', repeatUntil: doc.repeatUntil || '' })
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const data = { community: settings.communityId, title: draft.title, startsAt: localToInstant(draft.start, draft.timeZone), endsAt: draft.end ? localToInstant(draft.end, draft.timeZone) : null,
        timeZone: draft.timeZone, visibility: draft.visibility, recurrence: draft.recurrence, repeatInterval: Number(draft.repeatInterval), repeatUntil: draft.repeatUntil || null,
        location: draft.location, description: draft.description, url: draft.url, rsvpEnabled: draft.rsvpEnabled }
      await api(draft.id ? `events/${draft.id}` : 'events', { method: draft.id ? 'PATCH' : 'POST', body: JSON.stringify(data) })
      setDraft(null); setNotice('Event saved.'); await load(); router.refresh()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  async function saveSettings(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      setSettings(await api('community/calendar/settings', { method: 'PUT', body: JSON.stringify(settings) }))
      setShowSettings(false); setNotice('Calendar defaults saved. Existing event times stay as scheduled.'); await load(); router.refresh()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  const field = (key: string, value: any) => setDraft((current: any) => ({ ...current, [key]: value }))
  return <section className="heritage-events">
    <div className="church-calendar__toolbar"><h2>Church calendar</h2><button type="button" disabled={!settings || busy} onClick={() => create(localDate(Date.now(), settings.timeZone))}>New event</button><button type="button" disabled={!settings || busy} onClick={() => setShowSettings(!showSettings)}>Calendar settings</button></div>
    <p>Click a date to create an event, or an event to edit it.</p>
    {settings && showSettings && <form onSubmit={saveSettings} className="heritage-events__form">
      <label>Default time zone<input required list="church-time-zones" value={settings.timeZone} onChange={event => setSettings({ ...settings, timeZone: event.target.value })} /></label>
      <label>Default visibility<select value={settings.defaultVisibility} onChange={event => setSettings({ ...settings, defaultVisibility: event.target.value })}><option value="members">Members only</option><option value="public">Public — everyone</option></select></label>
      <p>This changes the visibility of events using “Church default”. Events with their own visibility keep it. The time zone is used for new events.</p>
      <button disabled={busy}>Save defaults</button>
    </form>}
    <datalist id="church-time-zones">{['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/Moscow', 'UTC'].map(zone => <option key={zone} value={zone} />)}</datalist>
    <CalendarGrid month={month} onMonthChange={setMonth} events={events} timeZone={settings?.timeZone || 'UTC'} onDateSelect={create} onEventSelect={edit} busy={busy} defaultRecurring create />
    {notice && <p role="status">{notice}</p>}
    {!draft && error && <p role="alert">{error}</p>}
    {draft && <div className="heritage-events__backdrop"><section role="dialog" aria-modal="true" aria-label={draft.id ? 'Edit event' : 'New event'} className="heritage-events__dialog">
      <form onSubmit={save} className="heritage-events__form">
        <div className="church-calendar__toolbar"><h2>{draft.id ? 'Edit event' : 'New event'}</h2><button type="button" disabled={busy} onClick={() => setDraft(null)}>Close</button></div>
        {draft.id && draft.recurrence !== 'none' && <p>Changes apply to this whole recurring series.</p>}
        <label>Title<input autoFocus required value={draft.title} onChange={event => field('title', event.target.value)} /></label>
        <div className="heritage-events__row"><label>Starts<input required type="datetime-local" value={draft.start} onChange={event => field('start', event.target.value)} /></label><label>Ends<input type="datetime-local" value={draft.end} onChange={event => field('end', event.target.value)} /></label></div>
        <label>Time zone<input required list="church-time-zones" value={draft.timeZone} onChange={event => field('timeZone', event.target.value)} /></label>
        <div className="heritage-events__row"><label>Who can see it?<select value={draft.visibility} onChange={event => field('visibility', event.target.value)}><option value="inherit">Church default ({settings.defaultVisibility === 'public' ? 'Public' : 'Members only'})</option><option value="public">Public — everyone</option><option value="members">Members only</option></select></label><label>Repeats<select value={draft.recurrence} onChange={event => field('recurrence', event.target.value)}><option value="none">Does not repeat</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div>
        {draft.recurrence !== 'none' && <div className="heritage-events__row"><label>Every {draft.recurrence === 'weekly' ? 'weeks' : 'months'}<input type="number" min="1" max="52" required value={draft.repeatInterval} onChange={event => field('repeatInterval', event.target.value)} /></label><label>Repeat until (optional)<input type="date" value={draft.repeatUntil} onChange={event => field('repeatUntil', event.target.value)} /></label></div>}
        <label>Location<input value={draft.location || ''} onChange={event => field('location', event.target.value)} /></label>
        <details><summary>Description and options</summary><label>Description<textarea rows={4} value={draft.description || ''} onChange={event => field('description', event.target.value)} /></label><label>Registration or event website (optional)<input placeholder="https://…" type="url" value={draft.url || ''} onChange={event => field('url', event.target.value)} /></label><p>Add an external registration or information website, or leave blank. The event details page is created automatically.</p><label><input type="checkbox" checked={Boolean(draft.rsvpEnabled)} onChange={event => field('rsvpEnabled', event.target.checked)} /> Let members RSVP</label></details>
        {error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Saving…' : 'Save event'}</button>
      </form>
    </section></div>}
  </section>
}
