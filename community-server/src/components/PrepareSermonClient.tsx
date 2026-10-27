'use client'
import { useWorkspaceText } from './useWorkspaceText'
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
  const t = useWorkspaceText()
  const [sermons, setSermons] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const flushCurrent = useRef<(() => Promise<boolean>) | null>(null)
  const registerFlush = useCallback((flush: (() => Promise<boolean>) | null) => { flushCurrent.current = flush }, [])
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
  async function chooseWorkspace(next: () => void) {
    setBusy(true); setError('')
    try {
      if (flushCurrent.current && !await flushCurrent.current()) { setError('Your current slides could not be saved. Keep this sermon open and try saving again.'); return }
      next()
    } finally { setBusy(false) }
  }
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const data = { title, speaker, language, serviceDate }, source = JSON.stringify(data)
      if (pending.current?.source !== source) pending.current = { source, requestId: crypto.randomUUID() }
      const result = await api('sermon-drafts', { method: 'POST', body: JSON.stringify({ ...data, requestId: pending.current.requestId }) })
      setSelected(result.syncId); setCreating(false); setTitle(''); pending.current = null; await load()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  const header = <header className="heritage-sermon-workspace__header">
      {!selected && <details className="heritage-sermon-menu"><summary aria-label={t("Church workspace menu")}>☰</summary><nav aria-label={t("Church workspace")}>{[...churchWorkspaceLinks, {href:'/admin/collections/events',label:t("Events")}].map(link => <a key={link.href} href={link.href}>{t(link.label)}</a>)}</nav></details>}
      <h1>{t("Prepare a sermon")}</h1>
      <label><span>{t("Sermon")}</span><select aria-label={t("Sermon to prepare")} value={selected} disabled={busy} onChange={event => { const value = event.target.value; void chooseWorkspace(() => { setSelected(value); setCreating(false); setImporting(false) }) }}><option value="">{t("Choose a sermon…")}</option>{sermons.map(sermon => <option key={sermon.syncId} value={sermon.syncId}>{sermon.serviceDate} · {sermon.title}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void chooseWorkspace(() => { setCreating(true); setImporting(false); setSelected('') })}>{t("New sermon")}</button>
      <details><summary>{t("More")}</summary><button type="button" onClick={load}>{t("Refresh sermons")}</button><button type="button" disabled={busy} onClick={() => void chooseWorkspace(() => { setSelected(''); setCreating(false); setImporting(true) })}>{t("Create from manuscript and passages")}</button><a href="/admin/plan-service">{t("Plan a service")}</a></details>
      {error && <p role="alert">{t(error)}</p>}
    </header>
  return <div className="heritage-sermon-workspace" data-has-sermon={Boolean(selected)}>
    {!selected && header}
    {creating ? <form onSubmit={create} className="heritage-sermon-workspace__create">
      <h2>{t("New sermon")}</h2><p>{t("Start a private draft, then build its slides. Publication can be reviewed later.")}</p>
      <label>{t("Title")}<input autoFocus required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>{t("Speaker")}<input required maxLength={200} value={speaker} onChange={event => setSpeaker(event.target.value)} /></label>
      <label>{t("Service date")}<input type="date" required value={serviceDate} onChange={event => setServiceDate(event.target.value)} /></label>
      <label>{t("Primary language")}<select value={language} onChange={event => setLanguage(event.target.value)}><option value="en">{t("English")}</option><option value="ru">{t("Russian")}</option></select></label>
      <button disabled={busy}>{busy ? t("Creating…") : t("Create and edit slides")}</button><button type="button" disabled={busy} onClick={() => setCreating(false)}>{t("Cancel")}</button>
    </form> : importing ? <div className="heritage-sermon-workspace__import"><button type="button" onClick={() => { setImporting(false); void load() }}>{t("Back to sermon slides")}</button><ManuscriptPreparation /></div>
      : selected ? <PlanServiceClient key={selected} sermonSyncId={selected} onFlushReady={registerFlush} sidebarHeader={header} />
        : <div className="heritage-sermon-workspace__empty"><h2>{t("Build the sermon’s slides here")}</h2><p>{t("Choose a sermon on the left, or create one. Add Bible passages, main points, quotations, pictures, and video. Preview English, Russian, and the stage screen as you work.")}</p><p>{t("After saving, open Plan a service → Sermon → Add whole sermon.")}</p></div>}
  </div>
}
