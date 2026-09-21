'use client'
import { useEffect, useRef, useState } from 'react'
import type { BibleImportSummary } from '../../packages/bible-import/index.js'
import './bibleTranslations.css'
const ENDPOINT = '/api/community/bible-translations'
type Edition = { id: string; name: string; language: string; edition: string; builtin: boolean; bookCount?: number; verseCount?: number; attribution?: string }
type Preview = { preview: BibleImportSummary; digest: string; installed: boolean; conflict: boolean }
async function request(path = '', body?: unknown) {
  const response = await fetch(ENDPOINT + path, { credentials: 'same-origin', cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || 'The Bible library is temporarily unavailable.')
  return value
}
export default function BibleTranslationsClient() {
  const [editions, setEditions] = useState<Edition[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reference, setReference] = useState('')
  const [permission, setPermission] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; request().then(value => { if (mounted.current) setEditions(value.translations) }).catch(error => { if (mounted.current) setError(error.message) }); return () => { mounted.current = false } }, [])
  async function choose(file?: File) {
    setPreview(null); setSource(''); setPermission(false); setReference(''); setError(''); setNotice('')
    if (!file) return
    if (file.size > 24 * 1024 * 1024) { setError('Choose a Bible JSON file smaller than 24 MiB.'); return }
    setBusy(true)
    try { const content = await file.text(); const result = await request('/preview', { source: content }); setSource(content); setPreview(result) }
    catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  async function install() {
    if (!preview) return
    setBusy(true); setError('')
    try {
      await request('', { source, digest: preview.digest, permissionConfirmed: permission, permissionReference: reference })
      setNotice(`${preview.preview.name} is installed. Select it under Scripture when preparing a sermon or planning a service.`)
      setSource(''); setPreview(null); setPermission(false); setReference('')
      setEditions((await request()).translations)
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <main className="heritage-bible-library">
    <header><h1>Bible translations</h1><p>Import an authorized edition for your church’s slides. Selected verses and their attribution travel with the service so SyncShow can present them offline.</p></header>
    {error ? <p role="alert" className="heritage-bible-library__error">{error}</p> : null}
    {notice ? <p role="status" className="heritage-bible-library__notice">{notice}</p> : null}
    <section aria-labelledby="installed-bibles"><h2 id="installed-bibles">Available editions</h2>
      <ul>{editions.map(edition => <li key={edition.id}><strong>{edition.name} <small>{edition.id} · {edition.language}</small></strong><p>{edition.edition} · {edition.builtin ? 'Built in' : `${edition.bookCount} books · ${edition.verseCount?.toLocaleString()} supplied verses`}</p>{edition.attribution ? <small>{edition.attribution}</small> : null}</li>)}</ul>
    </section>
    <section aria-labelledby="import-bible"><h2 id="import-bible">Import a Bible</h2>
      <p>Choose a Heritage Bible JSON file supplied or converted from an authorized source. The preview checks its contents before anything is installed. Imported editions stay private to church managers and service preparation.</p>
      <label className="heritage-bible-library__file">Bible file <input type="file" accept=".json,application/json" disabled={busy} onChange={event => { void choose(event.target.files?.[0]); event.target.value = '' }} /></label>
      <p><a href="/bible-import-example.json" download>Download a public-domain sample</a> · <a href="/bible-import-format.html" target="_blank" rel="noreferrer">File format and LSB licensing</a></p>
      {busy ? <p role="status">{preview ? 'Installing…' : 'Checking the file…'}</p> : null}
      {preview ? <div className="heritage-bible-library__preview">
        <h3>{preview.preview.name} <small>{preview.preview.id}</small></h3>
        <p>{preview.preview.edition} · {preview.preview.language} · {preview.preview.bookCount} books · {preview.preview.chapterCount} chapters · {preview.preview.verseCount.toLocaleString()} supplied verses</p>
        <p>Only supplied verses are available. Missing verses are never filled from another edition.</p>
        <blockquote><strong>{preview.preview.sample.bookId} {preview.preview.sample.chapter}</strong>{preview.preview.sample.verses.map(verse => <p key={verse.number}><sup>{verse.number}</sup> {verse.text}</p>)}</blockquote>
        <p>{preview.preview.attribution}</p><p>License: {preview.preview.license}</p><p>Source: <a href={preview.preview.sourceUrl} target="_blank" rel="noreferrer">{preview.preview.sourceUrl}</a></p>
        {preview.conflict ? <p role="alert">This ID already belongs to another edition. Give the new edition a different ID; existing slides will keep their original text.</p>
          : preview.installed ? <p role="status">This exact edition is already installed.</p> : <>
            <label>License or permission reference<input type="text" maxLength={1000} value={reference} onChange={event => setReference(event.target.value)} placeholder="License name, agreement or receipt reference" /></label>
            <label className="heritage-bible-library__permission"><input type="checkbox" checked={permission} onChange={event => setPermission(event.target.checked)} />I have permission to store this text for this church and include its verses in church presentations and offline service packages.</label>
            <button type="button" disabled={busy || !permission || !reference.trim()} onClick={install}>Install this edition</button>
          </>}
      </div> : null}
    </section>
  </main>
}
