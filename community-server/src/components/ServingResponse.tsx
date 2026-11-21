'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { formatServiceDay, formatServiceTime } from '../lib/serving'
import { usePublicLanguage } from './eventRegistrationText'
import { servingServerMessage, servingText } from './servingText'

type Assignment = {
  id: number; date: string; startsAt: string | null; timeZone: string; title: string; location: string | null; cancelled: boolean
  team: string; position: string; status: 'pending' | 'accepted' | 'declined'; note: string | null
}
type Summary = { churchName: string; name: string; assignments: Assignment[]; away: Array<{ id: number; startDate: string; endDate: string; reason: string | null }> }

async function call(path: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/community/serving/${path}`, { method: 'POST', credentials: 'omit', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || '')
  return value as Summary
}

// The private token lives in the URL fragment, which browsers never send to
// the server or in Referer headers; this page posts it explicitly.
export default function ServingResponse() {
  const [language, setLanguage, languages] = usePublicLanguage()
  const text = servingText(language)
  const [token, setToken] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [declining, setDeclining] = useState<number | null>(null)
  const [changing, setChanging] = useState<number[]>([])
  const [note, setNote] = useState('')
  const [away, setAway] = useState({ startDate: '', endDate: '', reason: '' })

  useEffect(() => {
    const value = window.location.hash.slice(1)
    setToken(value)
    if (!value) { setError(text.invalid); return }
    call('me', { token: value }).then(setSummary).catch(reason => setError(reason instanceof Error && reason.message ? reason.message : text.failed))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async (path: string, body: Record<string, unknown>) => {
    setBusy(true); setError('')
    try {
      setSummary(await call(path, { token, ...body }))
      return true
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : text.failed)
      return false
    } finally {
      setBusy(false)
    }
  }

  const respond = async (item: Assignment, answer: 'accepted' | 'declined', comment = '') => {
    if (await send('respond', { assignmentId: item.id, answer, note: comment })) {
      setDeclining(null); setNote(''); setChanging(list => list.filter(id => id !== item.id))
    }
  }

  const addAway = async (event: FormEvent) => {
    event.preventDefault()
    if (await send('away', { startDate: away.startDate, endDate: away.endDate || away.startDate, reason: away.reason })) {
      setAway({ startDate: '', endDate: '', reason: '' })
    }
  }

  const today = new Date().toLocaleDateString('en-CA')
  const groups: Array<{ key: string; items: Assignment[] }> = []
  for (const item of summary?.assignments || []) {
    const key = `${item.date}|${item.startsAt}|${item.title}`
    const group = groups.find(entry => entry.key === key)
    if (group) group.items.push(item)
    else groups.push({ key, items: [item] })
  }
  const when = (item: Assignment) => item.startsAt ? formatServiceTime(item.startsAt, item.timeZone, language) : formatServiceDay(item.date, language, true)
  const range = (row: { startDate: string; endDate: string }) => row.startDate === row.endDate ? formatServiceDay(row.startDate, language, true)
    : `${formatServiceDay(row.startDate, language)} – ${formatServiceDay(row.endDate, language)}`
  const status = { pending: text.waiting, accepted: text.accepted, declined: text.declined }

  return <section className="serving-page">
    <div className="serving-page__languages" role="group" aria-label="Language">
      {languages.map(code => <button key={code} type="button" aria-pressed={code === language} onClick={() => setLanguage(code)}>
        {servingText(code).languageName}</button>)}
    </div>
    <p className="eyebrow">{summary?.churchName || ''}</p>
    <h1>{text.title}</h1>
    {!summary && !error && <p role="status">{text.loading}</p>}
    {error && <p role="alert" className="serving-page__error">{servingServerMessage(error, language)}</p>}
    {summary && <>
      <p className="serving-page__intro">{text.hello(summary.name)} {text.intro(summary.churchName)}</p>
      {groups.length === 0 && <p className="serving-page__empty">{text.none}</p>}
      {groups.map(({ key, items }) => <article key={key} className="serving-page__service">
        <header>
          <h2>{items[0].title}</h2>
          <p>{when(items[0])}{items[0].location ? ` · ${items[0].location}` : ''}</p>
        </header>
        {items.map(item => {
          const open = item.status === 'pending' || changing.includes(item.id)
          return <div key={item.id} className={`serving-page__role serving-page__role--${item.status}`}>
            <div className="serving-page__role-name">
              <strong>{item.position}</strong>
              {item.team && <span>{item.team}</span>}
            </div>
            <span className="serving-page__status">{status[item.status]}</span>
            {item.note && <p className="serving-page__note">{text.yourNote}: “{item.note}”</p>}
            {item.cancelled ? <p className="serving-page__note">{text.cancelled}</p>
              : declining === item.id ? <form className="serving-page__decline" onSubmit={event => { event.preventDefault(); void respond(item, 'declined', note) }}>
                <label>{text.noteLabel}
                  <textarea maxLength={300} rows={2} value={note} placeholder={text.notePlaceholder} onChange={event => setNote(event.target.value)} />
                </label>
                <div className="serving-page__actions">
                  <button type="submit" className="button button--primary" disabled={busy}>{busy ? text.saving : text.sendDecline}</button>
                  <button type="button" className="button" disabled={busy} onClick={() => setDeclining(null)}>{text.back}</button>
                </div>
              </form>
              : open ? <div className="serving-page__actions">
                <button type="button" className="button button--primary" disabled={busy || item.status === 'accepted'}
                  onClick={() => void respond(item, 'accepted')}>{busy ? text.saving : text.accept}</button>
                <button type="button" className="button" disabled={busy || item.status === 'declined'}
                  onClick={() => { setDeclining(item.id); setNote('') }}>{text.decline}</button>
              </div>
              : <button type="button" className="serving-page__change" onClick={() => setChanging(list => [...list, item.id])}>{text.change}</button>}
          </div>
        })}
      </article>)}

      <section className="serving-page__away">
        <h2>{text.awayTitle}</h2>
        <p>{text.awayIntro}</p>
        {summary.away.length === 0 ? <p className="serving-page__empty">{text.awayNone}</p> : <ul>
          {summary.away.map(row => <li key={row.id}>
            <span>{range(row)}{row.reason ? ` — ${row.reason}` : ''}</span>
            <button type="button" className="serving-page__change" disabled={busy} onClick={() => void send('away/remove', { id: row.id })}>{text.remove}</button>
          </li>)}
        </ul>}
        <form className="serving-page__away-form" onSubmit={event => void addAway(event)}>
          <label>{text.firstDay}
            <input type="date" required min={today} value={away.startDate}
              onChange={event => setAway({ ...away, startDate: event.target.value, endDate: away.endDate && away.endDate < event.target.value ? '' : away.endDate })} />
          </label>
          <label>{text.lastDay}
            <input type="date" min={away.startDate || today} value={away.endDate} onChange={event => setAway({ ...away, endDate: event.target.value })} />
          </label>
          <label>{text.reason}
            <input type="text" maxLength={300} value={away.reason} onChange={event => setAway({ ...away, reason: event.target.value })} />
          </label>
          <button type="submit" className="button button--primary" disabled={busy}>{busy ? text.saving : text.addAway}</button>
        </form>
      </section>
      <p className="serving-page__privacy">{text.privacy}</p>
    </>}
  </section>
}
