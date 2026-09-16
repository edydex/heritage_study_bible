'use client'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { churchWorkspaceLinks } from '../lib/churchWorkspaceLinks'
import PlanServiceClient from './PlanServiceClient'
import ManuscriptPreparation from './ManuscriptPreparation'
import './PrepareSermonClient.css'

async function api(path: string, options?: RequestInit) {
  const response = await fetch(`/api/community/${path}`, { cache: 'no-store', credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json' } })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || 'Could not open the sermon workspace.')
  return value
}
export default function PrepareSermonClient() {
  const [sermons, setSermons] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [language, setLanguage] = useState('en')
  const [serviceDate, setServiceDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const pending = useRef<{ source: string; requestId: string } | null>(null)
  const load = useCallback(async () => {
    try { const result = await api('sermon-presentations'); setSermons(result.items || []) }
    catch (error) { setError((error as Error).message) }
  }, [])
  useEffect(() => { void load() }, [load])
  function mayLeave() { return !dirty || globalThis.confirm('Discard the unsaved sermon slides? Save them first to keep your changes.') }
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const data = { title, speaker, language, serviceDate }, source = JSON.stringify(data)
      if (pending.current?.source !== source) pending.current = { source, requestId: crypto.randomUUID() }
      const result = await api('sermon-drafts', { method: 'POST', body: JSON.stringify({ ...data, requestId: pending.current.requestId }) })
      setSelected(result.syncId); setCreating(false); setTitle(''); pending.current = null; setDirty(false); await load()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  const header = <header className="heritage-sermon-workspace__header">
      {!selected && <details className="heritage-sermon-menu"><summary aria-label="Church workspace menu">☰</summary><nav aria-label="Church workspace">{[...churchWorkspaceLinks, {href:'/admin/collections/events',label:'Events'}].map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav></details>}
      <h1>Prepare a sermon</h1>
      <label><span>Sermon</span><select aria-label="Sermon to prepare" value={selected} disabled={busy} onChange={event => { if (mayLeave()) { setSelected(event.target.value); setCreating(false); setImporting(false); setDirty(false) } }}><option value="">Choose a sermon…</option>{sermons.map(sermon => <option key={sermon.syncId} value={sermon.syncId}>{sermon.serviceDate} · {sermon.title}</option>)}</select></label>
      <button type="button" onClick={() => { if (mayLeave()) { setCreating(true); setImporting(false); setSelected(''); setDirty(false) } }}>New sermon</button>
      <details><summary>More</summary><button type="button" onClick={load}>Refresh sermons</button><button type="button" onClick={() => { if (mayLeave()) { setSelected(''); setCreating(false); setImporting(true); setDirty(false) } }}>Create from manuscript and passages</button><a href="/admin/plan-service">Plan a service</a></details>
      {error && <p role="alert">{error}</p>}
    </header>
  return <div className="heritage-sermon-workspace" data-has-sermon={Boolean(selected)}>
    {!selected && header}
    {creating ? <form onSubmit={create} className="heritage-sermon-workspace__create">
      <h2>New sermon</h2><p>Start a private draft, then build its slides. Publication can be reviewed later.</p>
      <label>Title<input autoFocus required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>Speaker<input required maxLength={200} value={speaker} onChange={event => setSpeaker(event.target.value)} /></label>
      <label>Service date<input type="date" required value={serviceDate} onChange={event => setServiceDate(event.target.value)} /></label>
      <label>Primary language<select value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="ru">Russian</option></select></label>
      <button disabled={busy}>{busy ? 'Creating…' : 'Create and edit slides'}</button><button type="button" disabled={busy} onClick={() => setCreating(false)}>Cancel</button>
    </form> : importing ? <div className="heritage-sermon-workspace__import"><button type="button" onClick={() => { setImporting(false); void load() }}>Back to sermon slides</button><ManuscriptPreparation /></div>
      : selected ? <PlanServiceClient key={selected} sermonSyncId={selected} onDirtyChange={setDirty} sidebarHeader={header} />
        : <div className="heritage-sermon-workspace__empty"><h2>Build the sermon’s slides here</h2><p>Choose a sermon on the left, or create one. Add Bible passages, main points, quotations, pictures, and video. Preview English, Russian, and the stage screen as you work.</p><p>After saving, open Plan a service → Sermon → Add whole sermon.</p></div>}
  </div>
}
