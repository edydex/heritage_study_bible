'use client'
import { useWorkspaceText } from './useWorkspaceText'
import { useEffect, useMemo, useRef, useState } from 'react'
import ServiceSlidePreview from './ServiceSlidePreview'
import { plannerSlides } from './plannerSlides'
import { projectFromServiceEnvelope } from './serviceDocumentPlannerModel'
import type { ServiceHistoryEntry } from '../lib/serviceVersionHistory'
import './version-history.css'

type HistoryGroup = { id: string; saveKind: string; savedBy: string; savedAt: string; entries: ServiceHistoryEntry[] }
export default function VersionHistoryDialog({ syncId, currentVersion, request, onClose, onRestore }: {
  syncId: string; currentVersion: number | string; request: (url: string, options?: RequestInit) => Promise<any>;
  onClose: () => void; onRestore: (project: any) => Promise<boolean>;
}) {
  const t = useWorkspaceText()
  const dialog = useRef<HTMLDialogElement>(null)
  const [groups, setGroups] = useState<HistoryGroup[]>([])
  const [selected, setSelected] = useState<ServiceHistoryEntry | null>(null)
  const [project, setProject] = useState<any>(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [channel, setChannel] = useState('english')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const selectedRequest = useRef(0)
  const endpoint = `/api/community/service-documents/${encodeURIComponent(syncId)}`
  const rows = useMemo(() => project ? plannerSlides(project, channel) : [], [project, channel])
  const slides = rows.filter(row => row.cue)
  const slide = slides[Math.min(slideIndex, slides.length - 1)]
  const kindLabel = (kind: string) => t(kind === 'automatic' ? 'Automatic save' : kind === 'restore' ? 'Restored version' : kind === 'manual' ? 'Manual save · Ctrl/Cmd+S' : 'Saved version')
  const versionLabel = (version: string | number, short = false) => typeof version === 'number' ? short ? `v${version}` : t('Version {version}', { version }) : t('Saved on this computer')
  const time = (value: string) => new Date(value).toLocaleString(t.language === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
  async function choose(entry: ServiceHistoryEntry) {
    const identity = ++selectedRequest.current
    setSelected(entry); setProject(null); setError(''); setLoading(true); setSlideIndex(0)
    try {
      const value = await request(`${endpoint}/history/${entry.syncVersion}`)
      if (identity === selectedRequest.current) setProject(projectFromServiceEnvelope(value.serviceDocument))
    } catch (caught) { if (identity === selectedRequest.current) setError((caught as Error).message) }
    finally { if (identity === selectedRequest.current) setLoading(false) }
  }
  async function load(nextPage: number) {
    setLoading(true); setError('')
    try {
      const value = await request(`${endpoint}/history?page=${nextPage}`)
      setGroups(prior => nextPage === 1 ? value.groups : [...prior, ...value.groups])
      setPage(nextPage); setHasMore(value.hasNextPage)
      if (nextPage === 1 && value.groups[0]?.entries[0]) await choose(value.groups[0].entries[0])
    } catch (caught) { setError((caught as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    const invoker = document.activeElement as HTMLElement | null
    const node = dialog.current
    node?.showModal(); void load(1)
    return () => { node?.close(); invoker?.focus() }
  }, [])
  return <dialog ref={dialog} className="heritage-version-history" aria-labelledby="version-history-title" onCancel={event => { event.preventDefault(); if (!restoring) onClose() }}>
    <header><div><h2 id="version-history-title">{t("Version history")}</h2><p>{t("Preview previous versions. Restoring creates a new version and keeps this history.")}</p></div><button type="button" disabled={restoring} onClick={onClose}>{t("Back to editing")}</button></header>
    {error ? <p role="alert">{t(error)}</p> : null}
    <div className="heritage-version-history__layout">
      <aside aria-label={t("Saved versions")}>
        {groups.map(group => <details key={group.id} open={group.entries.some(entry => entry.id === selected?.id)}>
          <summary><button type="button" aria-pressed={group.entries.some(entry => entry.id === selected?.id)} onClick={() => void choose(group.entries[0])}>
            <strong>{time(group.savedAt)}</strong><span>{kindLabel(group.saveKind)}</span><small>{group.savedBy} · {group.entries.length > 1 ? t('{count} saves', { count: group.entries.length }) : versionLabel(group.entries[0].syncVersion, true)}</small>
          </button></summary>
          {group.entries.length > 1 ? group.entries.map(entry => <button className="heritage-version-history__entry" type="button" key={entry.id} aria-pressed={entry.id === selected?.id} onClick={() => void choose(entry)}>{time(entry.savedAt)} · {versionLabel(entry.syncVersion, true)}</button>) : null}
        </details>)}
        {!loading && !groups.length ? <p>{t("No saved versions yet.")}</p> : null}
        {hasMore ? <button type="button" disabled={loading} onClick={() => void load(page + 1)}>{t("Load earlier versions")}</button> : null}
      </aside>
      <section aria-label={t("Version preview")}>
        <div className="heritage-version-history__preview-toolbar"><strong>{selected ? `${versionLabel(selected.syncVersion)}${selected.syncVersion === currentVersion ? t(' · Current') : ''}` : t("Choose a version")}</strong>
          <select aria-label={t("Preview language")} value={channel} onChange={event => setChannel(event.target.value)}><option value="english">{t("English")}</option><option value="russian">{t("Russian")}</option><option value="media">{t("Stage-Facing Screen")}</option></select>
          <button type="button" disabled={!project || restoring || loading || selected?.syncVersion === currentVersion} onClick={async () => { setRestoring(true); if (await onRestore(project)) onClose(); setRestoring(false) }}>{restoring ? t("Restoring…") : t("Restore as new version")}</button></div>
        {loading ? <p role="status">{t("Loading version…")}</p> : project ? <><h3>{project.title}</h3>
          <div className="heritage-version-history__preview" lang={channel === 'russian' ? 'ru' : channel === 'english' ? 'en' : project.channels?.media?.language || t.language} aria-label={slide?.title}>{slide ? <ServiceSlidePreview project={project} rows={rows} slide={slide} channelId={channel} mediaUrl={assetId => selected ? `${endpoint}/history/${selected.syncVersion}/assets/${encodeURIComponent(assetId)}` : undefined} /> : <p>{t("This version has no slides.")}</p>}</div>
          <nav aria-label={t("Historical slide navigation")}><button type="button" disabled={slideIndex === 0} onClick={() => setSlideIndex(value => value - 1)}>{t("Previous slide")}</button><span>{slides.length ? `${slideIndex + 1} / ${slides.length} · ${slide?.title}` : t("0 slides")}</span><button type="button" disabled={slideIndex >= slides.length - 1} onClick={() => setSlideIndex(value => value + 1)}>{t("Next slide")}</button></nav>
        </> : null}
      </section>
    </div>
  </dialog>
}
