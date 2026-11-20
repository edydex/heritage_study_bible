'use client'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import CalendarGrid from '../../packages/calendar-ui/CalendarGrid.jsx'
import { addDays, canonicalTimeZone, localDate, localDateTime, localToInstant, monthDays, timeZoneLabel } from '../../packages/calendar-core/index.js'
import { formatServiceDay } from '../lib/serving'
import { durationLabel, loadCalendarDefaults, type CalendarDefaults } from './calendarDefaults'
import ReminderSelect from './ReminderSelect'
import TimeZoneSelect from './TimeZoneSelect'
import { useWorkspaceText } from './useWorkspaceText'
import './EventsCalendar.css'

type Draft = {
  id?: number; title: string; allDay: boolean; startDate: string; startTime: string; endDate: string; endTime: string; timeZone: string
  visibility: string; recurrence: string; repeatInterval: number | string; repeatUntil: string; location: string; description: string; url: string
  rsvpEnabled: boolean; defaultReminderMinutes: number | null; hasSignUp?: boolean
}
type Occurrence = { id: number; date: string; title: string; startsAt: string; endsAt?: string | null; timeZone: string; recurring?: boolean
  cancelled?: boolean; changed?: boolean; allDay?: boolean; location?: string | null; note?: string | null }
type DateChange = { occurrence: Occurrence; cancelled: boolean; startTime: string; endTime: string; title: string; location: string; note: string; existing: boolean }
type Links = { public: { url: string; webcal: string }; members?: { url: string; webcal: string } }
type Dialog = { kind: 'event'; draft: Draft } | { kind: 'choose'; occurrence: Occurrence } | { kind: 'date'; change: DateChange } | null

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240]

async function api(path: string, options?: RequestInit) {
  const response = await fetch(`/api/${path}`, { cache: 'no-store', credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || value.errors?.[0]?.data?.errors?.map((error: any) => error.message).join(' ') || value.errors?.[0]?.message || 'Could not save the event.')
  return value
}

/** Local date and time of an instant in a time zone. */
function parts(instant: number | string, zone: string) {
  const local = localDateTime(instant, zone)
  return { date: local.slice(0, 10), time: local.slice(11) }
}

function instant(date: string, time: string, zone: string) {
  try { return Date.parse(localToInstant(`${date}T${time}`, zone)) } catch { return NaN }
}

async function copy(text: string, prompt: string) {
  try { await navigator.clipboard.writeText(text); return true } catch { window.prompt(prompt, text); return false }
}

export default function EventsCalendar() {
  const t = useWorkspaceText()
  const router = useRouter()
  const [month, setMonth] = useState(() => localDate(Date.now()).slice(0, 7))
  const [settings, setSettings] = useState<CalendarDefaults | null>(null)
  const [events, setEvents] = useState<Occurrence[]>([])
  const [dialog, setDialog] = useState<Dialog>(null)
  const [panel, setPanel] = useState<'settings' | 'subscribe' | null>(null)
  const [links, setLinks] = useState<Links | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const days = monthDays(month)
    const result = await api(`community/calendar?from=${days[0]}&to=${days.at(-1)}&includeCancelled=1`)
    setEvents(result.events)
  }, [month])
  useEffect(() => {
    void loadCalendarDefaults(true).then(value => value.communityId ? setSettings(value) : setError(t('Sign in as a church manager to change calendar settings.')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load().catch(reason => setError(reason.message)) }, [load])

  const run = async (work: () => Promise<string | void>) => {
    setBusy(true); setError('')
    try {
      const message = await work()
      if (message) setNotice(message)
      await load()
      router.refresh()
    } catch (reason) { setError(t((reason as Error).message || 'Could not save the event.')) } finally { setBusy(false) }
  }

  // New events start from the church defaults.
  function create(date: string) {
    if (!settings) return
    setError(''); setNotice(''); setPanel(null)
    const zone = settings.timeZone
    const start = instant(date, settings.defaultStartTime, zone)
    const end = Number.isFinite(start) ? parts(start + settings.defaultDurationMinutes * 60000, zone) : { date, time: '' }
    setDialog({ kind: 'event', draft: { title: '', allDay: false, startDate: date, startTime: settings.defaultStartTime, endDate: end.date, endTime: end.time,
      timeZone: zone, visibility: 'inherit', recurrence: 'none', repeatInterval: 1, repeatUntil: '', location: settings.defaultLocation, description: '', url: '',
      rsvpEnabled: true, defaultReminderMinutes: settings.defaultReminderMinutes } })
  }

  async function editSeries(id: number) {
    setBusy(true); setError(''); setNotice('')
    try {
      const doc = await api(`events/${id}?depth=0`)
      const zone = canonicalTimeZone(doc.timeZone) || settings?.timeZone || 'UTC'
      const start = parts(doc.startsAt, zone)
      const end = doc.endsAt ? parts(doc.allDay ? Date.parse(doc.endsAt) - 1 : doc.endsAt, zone) : { date: '', time: '' }
      setDialog({ kind: 'event', draft: { id: doc.id, title: doc.title, allDay: Boolean(doc.allDay), startDate: start.date, startTime: start.time,
        endDate: end.date, endTime: doc.allDay ? '' : end.time, timeZone: zone, visibility: doc.visibility || 'inherit', recurrence: doc.recurrence || 'none',
        repeatInterval: doc.repeatInterval || 1, repeatUntil: doc.repeatUntil || '', location: doc.location || '', description: doc.description || '',
        url: doc.url || '', rsvpEnabled: Boolean(doc.rsvpEnabled), defaultReminderMinutes: doc.defaultReminderMinutes ?? null,
        hasSignUp: Boolean(doc.registration?.enabled) } })
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }

  function select(event: Occurrence) {
    setError(''); setNotice('')
    if (event.recurring) setDialog({ kind: 'choose', occurrence: event })
    else void editSeries(event.id)
  }

  function updateDraft(change: Partial<Draft>) {
    setDialog(current => {
      if (current?.kind !== 'event') return current
      const before = current.draft
      const next = { ...before, ...change }
      // Moving the start moves the end with it, keeping the event's length.
      if (('startDate' in change || 'startTime' in change) && !before.allDay) {
        const oldStart = instant(before.startDate, before.startTime, before.timeZone)
        const oldEnd = before.endTime ? instant(before.endDate || before.startDate, before.endTime, before.timeZone) : NaN
        const newStart = instant(next.startDate, next.startTime, next.timeZone)
        if (Number.isFinite(oldStart) && Number.isFinite(oldEnd) && Number.isFinite(newStart) && oldEnd > oldStart) {
          const end = parts(newStart + oldEnd - oldStart, next.timeZone)
          next.endDate = end.date; next.endTime = end.time
        }
      }
      if ('startDate' in change && before.allDay && (!next.endDate || next.endDate < next.startDate)) next.endDate = next.startDate
      return { kind: 'event', draft: next }
    })
  }

  async function saveEvent(event: FormEvent) {
    event.preventDefault()
    if (dialog?.kind !== 'event') return
    const draft = dialog.draft
    const zone = draft.timeZone
    let startsAt: string, endsAt: string | null
    try {
      startsAt = localToInstant(`${draft.startDate}T${draft.allDay ? '00:00' : draft.startTime}`, zone)
      endsAt = draft.allDay ? localToInstant(`${addDays(draft.endDate && draft.endDate >= draft.startDate ? draft.endDate : draft.startDate, 1)}T00:00`, zone)
        : draft.endTime ? localToInstant(`${draft.endDate || draft.startDate}T${draft.endTime}`, zone) : null
    } catch {
      setError(t('That time does not exist on this date because the clocks change. Choose another time.')); return
    }
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) { setError(t('The end must be after the start.')); return }
    const data = { title: draft.title, allDay: draft.allDay, startsAt, endsAt, timeZone: zone, visibility: draft.visibility, recurrence: draft.recurrence,
      repeatInterval: Number(draft.repeatInterval) || 1, repeatUntil: draft.repeatUntil || null, location: draft.location, description: draft.description,
      url: draft.url, rsvpEnabled: draft.rsvpEnabled, defaultReminderMinutes: draft.defaultReminderMinutes,
      ...(draft.id ? {} : { community: settings?.communityId }) }
    await run(async () => {
      await api(draft.id ? `events/${draft.id}` : 'events', { method: draft.id ? 'PATCH' : 'POST', body: JSON.stringify(data) })
      setDialog(null)
      return t('Event saved.')
    })
  }

  async function openDateChange(occurrence: Occurrence) {
    setBusy(true); setError('')
    try {
      const doc = await api(`events/${occurrence.id}?depth=0`)
      const row = (doc.exceptions || []).find((item: { date: string }) => item.date === occurrence.date)
      const start = parts(occurrence.startsAt, occurrence.timeZone)
      const end = occurrence.endsAt ? parts(occurrence.endsAt, occurrence.timeZone) : null
      setDialog({ kind: 'date', change: { occurrence, existing: Boolean(row), cancelled: Boolean(row?.cancelled),
        startTime: row?.startTime || start.time, endTime: row?.endTime || end?.time || '', title: row?.title || '', location: row?.location || '', note: row?.note || '' } })
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }

  /** Replaces (or removes, when row is null) the change saved for one date. */
  const saveDate = (occurrence: Occurrence, row: Record<string, unknown> | null, message: string) => run(async () => {
    const doc = await api(`events/${occurrence.id}?depth=0`)
    const kept = (doc.exceptions || []).filter((item: { date: string }) => item.date !== occurrence.date)
    await api(`events/${occurrence.id}`, { method: 'PATCH', body: JSON.stringify({ exceptions: row ? [...kept, { date: occurrence.date, ...row }] : kept }) })
    setDialog(null)
    return message
  })

  async function submitDateChange(event: FormEvent) {
    event.preventDefault()
    if (dialog?.kind !== 'date') return
    const change = dialog.change
    const day = formatServiceDay(change.occurrence.date, t.language, true)
    if (change.endTime && change.startTime && change.endTime <= change.startTime) { setError(t('The end must be after the start.')); return }
    await saveDate(change.occurrence, change.cancelled ? { cancelled: true, note: change.note || null } : {
      cancelled: false, startTime: change.startTime || null, endTime: change.endTime || null,
      title: change.title || null, location: change.location || null, note: change.note || null,
    }, change.cancelled ? t('{date} is cancelled. Every other date stays the same.', { date: day }) : t('{date} was changed. Every other date stays the same.', { date: day }))
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    if (!settings) return
    await run(async () => {
      setSettings(await api('community/calendar/settings', { method: 'PUT', body: JSON.stringify(settings) }))
      await loadCalendarDefaults(true)
      setPanel(null)
      return t('Calendar defaults saved. Existing events keep their times.')
    })
  }

  async function openSubscribe() {
    setPanel(panel === 'subscribe' ? null : 'subscribe')
    if (!links) try { setLinks(await api('community/calendar/subscribe')) } catch (reason) { setError((reason as Error).message) }
  }

  async function resetMembersLink() {
    if (!window.confirm(t('Make a new members’ calendar link? Calendars subscribed with the old link stop updating.'))) return
    await run(async () => {
      const next = await api('community/calendar/subscribe/reset', { method: 'POST', body: '{}' })
      setLinks(next)
      return (await copy(next.members?.url || '', t('Copy this link:'))) ? t('New members’ link copied.') : undefined
    })
  }

  const copyLink = async (url: string) => {
    if (await copy(url, t('Copy this link:'))) setNotice(t('Link copied.'))
  }

  const field = (label: ReactNode, control: ReactNode, hint?: ReactNode) => <label>{label}{control}{hint && <small>{hint}</small>}</label>
  const draft = dialog?.kind === 'event' ? dialog.draft : null
  const change = dialog?.kind === 'date' ? dialog.change : null
  const setChange = (next: Partial<DateChange>) => setDialog(current => current?.kind === 'date' ? { kind: 'date', change: { ...current.change, ...next } } : current)
  const zoneHint = (zone: string) => t('Times are in {zone}.', { zone: timeZoneLabel(zone, t.language) })

  return <section className="heritage-events">
    <div className="church-calendar__toolbar">
      <h2>{t('Church calendar')}</h2>
      <button type="button" className="heritage-events__primary" disabled={!settings || busy} onClick={() => create(localDate(Date.now(), settings?.timeZone))}>{t('New event')}</button>
      <button type="button" disabled={!settings || busy} aria-expanded={panel === 'settings'} onClick={() => setPanel(panel === 'settings' ? null : 'settings')}>{t('Calendar settings')}</button>
      <button type="button" disabled={busy} aria-expanded={panel === 'subscribe'} onClick={() => void openSubscribe()}>{t('Subscribe')}</button>
    </div>
    <p className="heritage-events__hint">{t('Click a date to create an event, or an event to change it. Repeating events can be changed or cancelled for a single date.')}</p>

    {settings && panel === 'settings' && <form onSubmit={saveSettings} className="heritage-events__form heritage-events__panel">
      <h3>{t('Defaults for new events')}</h3>
      {field(t('Time zone'), <TimeZoneSelect value={settings.timeZone} required onChange={zone => setSettings({ ...settings, timeZone: zone })} />)}
      <div className="heritage-events__row">
        {field(t('Start time'), <input type="time" step={300} required value={settings.defaultStartTime} onChange={event => setSettings({ ...settings, defaultStartTime: event.target.value })} />)}
        {field(t('Length'), <select value={settings.defaultDurationMinutes} onChange={event => setSettings({ ...settings, defaultDurationMinutes: Number(event.target.value) })}>
          {[...new Set([...DURATIONS, settings.defaultDurationMinutes])].sort((a, b) => a - b).map(minutes => <option key={minutes} value={minutes}>{durationLabel(minutes, t)}</option>)}
        </select>)}
      </div>
      <div className="heritage-events__row">
        {field(t('Reminder'), <ReminderSelect value={settings.defaultReminderMinutes} onChange={minutes => setSettings({ ...settings, defaultReminderMinutes: minutes })} />)}
        {field(t('Who can see events marked “Church default”'), <select value={settings.defaultVisibility} onChange={event => setSettings({ ...settings, defaultVisibility: event.target.value as CalendarDefaults['defaultVisibility'] })}>
          <option value="members">{t('Members only')}</option><option value="public">{t('Public — everyone')}</option>
        </select>)}
      </div>
      {field(t('Location'), <input value={settings.defaultLocation} maxLength={300} placeholder={t('For example: Main hall, 123 Church St')} onChange={event => setSettings({ ...settings, defaultLocation: event.target.value })} />)}
      <p>{t('These apply to new events. Changing who can see “Church default” events applies right away; existing events keep their times.')}</p>
      <div className="heritage-events__actions"><button className="heritage-events__primary" disabled={busy}>{t('Save defaults')}</button>
        <button type="button" onClick={() => setPanel(null)}>{t('Close')}</button></div>
    </form>}

    {panel === 'subscribe' && <section className="heritage-events__panel heritage-events__subscribe">
      <h3>{t('Subscribe in a calendar app')}</h3>
      <p>{t('A subscribed calendar updates by itself: new events, changed times and cancelled dates show up on phones without downloading anything again.')}</p>
      {!links && <p role="status">{t('Loading…')}</p>}
      {links && <>
        <article>
          <h4>{t('Public calendar')}</h4>
          <p>{t('Public events only. Safe to put on the church website or share with anyone.')}</p>
          <div className="heritage-events__actions">
            <a className="heritage-events__primary" href={links.public.webcal}>{t('Open in calendar app')}</a>
            <button type="button" onClick={() => void copyLink(links.public.url)}>{t('Copy link')}</button>
          </div>
        </article>
        {links.members && <article>
          <h4>{t('Members’ calendar')}</h4>
          <p>{t('Every event, including members-only events. Share it only with church members, for example in the members’ group chat.')}</p>
          <div className="heritage-events__actions">
            <button type="button" className="heritage-events__primary" onClick={() => void copyLink(links.members!.url)}>{t('Copy link')}</button>
            <a href={links.members.webcal}>{t('Open in calendar app')}</a>
            <button type="button" disabled={busy} onClick={() => void resetMembersLink()}>{t('Make a new link')}</button>
          </div>
        </article>}
        <p className="heritage-events__hint">{t('Google Calendar: Other calendars → + → From URL, then paste the link. iPhone and Mac: tap Open in calendar app.')}</p>
      </>}
      <div className="heritage-events__actions"><button type="button" onClick={() => setPanel(null)}>{t('Close')}</button></div>
    </section>}

    <CalendarGrid month={month} onMonthChange={setMonth} events={events} timeZone={settings?.timeZone || 'UTC'} onDateSelect={create} onEventSelect={event => select(event as Occurrence)}
      busy={busy} defaultRecurring create showTimes locale={t.language} labels={{ previousMonth: t('Previous month'), nextMonth: t('Next month'), today: t('Today'),
        events: t('One-time events'), recurring: t('Repeating events'), loading: t('Loading…'), empty: t('No events match these filters this month.'),
        createEvent: t('create event'), viewEvents: t('view events'), eventCount: t('events'), cancelled: t('cancelled') }} />
    {notice && <p role="status" className="heritage-events__notice">{notice}</p>}
    {!dialog && error && <p role="alert">{error}</p>}

    {dialog && <div className="heritage-events__backdrop" onKeyDown={event => { if (event.key === 'Escape') setDialog(null) }}>
      <section role="dialog" aria-modal="true" className="heritage-events__dialog"
        aria-label={draft ? (draft.id ? t('Edit event') : t('New event')) : t('Change one date')}>

        {dialog.kind === 'choose' && <div className="heritage-events__form">
          <div className="church-calendar__toolbar"><h2>{dialog.occurrence.title}</h2><button type="button" onClick={() => setDialog(null)}>{t('Close')}</button></div>
          <p><strong>{formatServiceDay(dialog.occurrence.date, t.language, true)}</strong>
            {dialog.occurrence.cancelled ? ` — ${t('cancelled on this date')}` : !dialog.occurrence.allDay ? ` · ${parts(dialog.occurrence.startsAt, dialog.occurrence.timeZone).time}` : ''}</p>
          {dialog.occurrence.note && <p>{dialog.occurrence.note}</p>}
          <p>{t('This event repeats. What do you want to change?')}</p>
          <div className="heritage-events__choices">
            {dialog.occurrence.cancelled
              ? <button type="button" className="heritage-events__primary" disabled={busy} onClick={() => void saveDate(dialog.occurrence, null,
                t('{date} is back on the calendar.', { date: formatServiceDay(dialog.occurrence.date, t.language, true) }))}>{t('Restore this date')}</button>
              : <>
                <button type="button" className="heritage-events__primary" disabled={busy} onClick={() => void openDateChange(dialog.occurrence)}>{t('Change only this date')}</button>
                <button type="button" disabled={busy} onClick={() => {
                  if (window.confirm(t('Cancel {title} on {date} only? Every other date stays.', { title: dialog.occurrence.title, date: formatServiceDay(dialog.occurrence.date, t.language, true) }))) {
                    void saveDate(dialog.occurrence, { cancelled: true }, t('{date} is cancelled. Every other date stays the same.', { date: formatServiceDay(dialog.occurrence.date, t.language, true) }))
                  }
                }}>{t('Cancel only this date')}</button>
              </>}
            <button type="button" disabled={busy} onClick={() => void editSeries(dialog.occurrence.id)}>{t('Edit every date')}</button>
          </div>
          {error && <p role="alert">{error}</p>}
        </div>}

        {change && <form onSubmit={submitDateChange} className="heritage-events__form">
          <div className="church-calendar__toolbar"><h2>{t('Change one date')}</h2><button type="button" onClick={() => setDialog(null)}>{t('Close')}</button></div>
          <p><strong>{change.occurrence.title}</strong> — {formatServiceDay(change.occurrence.date, t.language, true)}. {t('Every other date stays the same.')}</p>
          <label className="heritage-events__check"><input type="checkbox" checked={change.cancelled} onChange={event => setChange({ cancelled: event.target.checked })} /> {t('Cancelled on this date')}</label>
          {!change.cancelled && <>
            {!change.occurrence.allDay && <div className="heritage-events__row">
              {field(t('Start time'), <input type="time" step={300} value={change.startTime} onChange={event => setChange({ startTime: event.target.value })} />)}
              {field(t('End time'), <input type="time" step={300} value={change.endTime} onChange={event => setChange({ endTime: event.target.value })} />)}
            </div>}
            <div className="heritage-events__row">
              {field(t('Different title (optional)'), <input value={change.title} placeholder={change.occurrence.title} onChange={event => setChange({ title: event.target.value })} />)}
              {field(t('Different place (optional)'), <input value={change.location} onChange={event => setChange({ location: event.target.value })} />)}
            </div>
          </>}
          {field(t('Note for this date (optional)'), <input value={change.note} maxLength={300} placeholder={t('For example: Christmas Eve service')} onChange={event => setChange({ note: event.target.value })} />)}
          {!change.occurrence.allDay && <p className="heritage-events__hint">{zoneHint(change.occurrence.timeZone)}</p>}
          {error && <p role="alert">{error}</p>}
          <div className="heritage-events__actions">
            <button className="heritage-events__primary" disabled={busy}>{busy ? t('Saving…') : t('Save this date')}</button>
            {change.existing && <button type="button" disabled={busy} onClick={() => void saveDate(change.occurrence, null, t('{date} is back to the usual time.', { date: formatServiceDay(change.occurrence.date, t.language, true) }))}>{t('Undo the change')}</button>}
          </div>
        </form>}

        {draft && <form onSubmit={saveEvent} className="heritage-events__form">
          <div className="church-calendar__toolbar"><h2>{draft.id ? t('Edit event') : t('New event')}</h2><button type="button" disabled={busy} onClick={() => setDialog(null)}>{t('Close')}</button></div>
          {draft.id && draft.recurrence !== 'none' && <p className="heritage-events__hint">{t('Changes here apply to every date of this repeating event.')}</p>}
          {field(t('Title'), <input autoFocus required value={draft.title} onChange={event => updateDraft({ title: event.target.value })} />)}
          <label className="heritage-events__check"><input type="checkbox" checked={draft.allDay} onChange={event => updateDraft({ allDay: event.target.checked })} /> {t('All day')}</label>
          <div className="heritage-events__row">
            {field(draft.allDay ? t('First day') : t('Date'), <input type="date" required value={draft.startDate} onChange={event => updateDraft({ startDate: event.target.value })} />)}
            {draft.allDay
              ? field(t('Last day'), <input type="date" min={draft.startDate} value={draft.endDate} onChange={event => updateDraft({ endDate: event.target.value })} />)
              : <div className="heritage-events__row">
                {field(t('Starts'), <input type="time" step={300} required value={draft.startTime} onChange={event => updateDraft({ startTime: event.target.value })} />)}
                {field(t('Ends'), <input type="time" step={300} value={draft.endTime} onChange={event => updateDraft({ endTime: event.target.value })} />)}
              </div>}
          </div>
          {!draft.allDay && draft.endTime && draft.endDate && draft.endDate !== draft.startDate &&
            field(t('Ends on'), <input type="date" min={draft.startDate} value={draft.endDate} onChange={event => updateDraft({ endDate: event.target.value })} />)}
          {!draft.allDay && draft.endTime && draft.endDate === draft.startDate && draft.endTime <= draft.startTime &&
            <button type="button" className="heritage-events__link" onClick={() => updateDraft({ endDate: addDays(draft.startDate, 1) })}>{t('Ends the next day')}</button>}
          {field(t('Time zone'), <TimeZoneSelect value={draft.timeZone} required onChange={zone => updateDraft({ timeZone: zone })} />)}
          <div className="heritage-events__row">
            {field(t('Repeats'), <select value={draft.recurrence} onChange={event => updateDraft({ recurrence: event.target.value })}>
              <option value="none">{t('Does not repeat')}</option><option value="weekly">{t('Every week')}</option><option value="monthly">{t('Every month')}</option>
            </select>)}
            {field(t('Who can see it?'), <select value={draft.visibility} onChange={event => updateDraft({ visibility: event.target.value })}>
              <option value="inherit">{t('Church default ({who})', { who: settings?.defaultVisibility === 'public' ? t('Public') : t('Members only') })}</option>
              <option value="public">{t('Public — everyone')}</option><option value="members">{t('Members only')}</option>
            </select>)}
          </div>
          {draft.recurrence !== 'none' && <div className="heritage-events__row">
            {field(draft.recurrence === 'weekly' ? t('Every how many weeks') : t('Every how many months'),
              <input type="number" min="1" max="52" required value={draft.repeatInterval} onChange={event => updateDraft({ repeatInterval: event.target.value })} />)}
            {field(t('Repeat until (optional)'), <input type="date" min={draft.startDate} value={draft.repeatUntil} onChange={event => updateDraft({ repeatUntil: event.target.value })} />)}
          </div>}
          <div className="heritage-events__row">
            {field(t('Location'), <input value={draft.location} onChange={event => updateDraft({ location: event.target.value })} />)}
            {field(t('Reminder'), <ReminderSelect value={draft.defaultReminderMinutes} onChange={minutes => updateDraft({ defaultReminderMinutes: minutes })} />,
              t('For members who add it to their phone calendar.'))}
          </div>
          <details><summary>{t('Description and options')}</summary>
            {field(t('Description'), <textarea rows={4} value={draft.description} onChange={event => updateDraft({ description: event.target.value })} />)}
            {field(t('Registration or event website (optional)'), <input placeholder="https://…" type="url" value={draft.url} onChange={event => updateDraft({ url: event.target.value })} />)}
            <label className="heritage-events__check"><input type="checkbox" checked={draft.rsvpEnabled} onChange={event => updateDraft({ rsvpEnabled: event.target.checked })} /> {t('Let members RSVP')}</label>
          </details>
          {draft.id && <a className="heritage-events__link" href={`/admin/collections/events/${draft.id}`}>{draft.hasSignUp ? t('Sign-up form and more options →') : t('Add a sign-up form or cancel the event →')}</a>}
          {error && <p role="alert">{error}</p>}
          <div className="heritage-events__actions"><button className="heritage-events__primary" disabled={busy}>{busy ? t('Saving…') : t('Save event')}</button></div>
        </form>}
      </section>
    </div>}
  </section>
}
