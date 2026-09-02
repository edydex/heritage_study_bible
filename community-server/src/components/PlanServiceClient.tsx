'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import serviceCore from '../../packages/service-core/index.js'
import { plannerPreview } from './plannerPreview'
import { preparePlannerPresentation, scriptureLineCount, SCRIPTURE_PAGE_MAX_LINES } from './plannerPresentation'
import { deletePlannerSlide, editablePreviewBlock, editPlannerSlide, movePlannerSlide, plannerSlides, type PlannerSlide } from './plannerSlides'
import {
  parsePlannerLibrarySongDocument,
  projectFromServiceEnvelope,
} from './serviceDocumentPlannerModel'

const ENDPOINT = '/api/community/service-documents'
const CHANNEL_IDS = ['english', 'russian', 'media'] as const

type ChannelId = typeof CHANNEL_IDS[number]
type ProjectItem = Record<string, any> & {
  id: string
  kind: string
  title: string
  operatorNotes: string
}
type ServiceProject = Record<string, any> & {
  id: string
  title: string
  serviceDate: string
  revision: number
  channelIds: string[]
  channels: Record<string, { id: string; label: string; language: string }>
  rootItemIds: string[]
  items: Record<string, ProjectItem>
}
type ServiceEnvelope = {
  syncId: string
  syncVersion: number
  revision: string
  documentSource: string
  status: 'planning' | 'ready' | 'archived' | 'cancelled'
  changedAt: string
  project: ServiceProject
}
type ServiceEnvelopeInput = Omit<ServiceEnvelope, 'project'> & {
  project?: ServiceProject
  document?: { project?: ServiceProject }
}
type ServiceSummary = {
  syncId: string
  syncVersion: number
  revision: string
  status: ServiceEnvelope['status']
  title: string
  serviceDate: string
  changedAt: string
}
type SongLibraryOption = {
  syncId: string
  syncVersion: number
  title: string
  russianTitle: string
  rightsStatus: string
  visibility: string
  documentCount: number
}
type BibleBookOption = {
  id: string
  name: string
  chapters: number
}
type PictureUploadTarget = 'new' | 'all' | ChannelId
type ResourceTab = 'songs' | 'media' | 'scripture'

function uuid() {
  return globalThis.crypto.randomUUID()
}

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Heritage Community could not complete that service change.'
}

async function jsonRequest(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  let value: any = null
  try {
    value = await response.json()
  } catch {
    // A successful response must still be valid JSON.
  }
  if (!response.ok) {
    const error = new Error(
      typeof value?.error === 'string'
        ? value.error
        : `Service request failed (${response.status}).`,
    ) as Error & { code?: string; status?: number }
    error.code = value?.code
    error.status = response.status
    throw error
  }
  return value
}

async function uploadServiceMedia(file: File) {
  const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
  const isVideo = ['video/mp4', 'video/webm'].includes(file.type)
  if (!isImage && !isVideo) {
    throw new Error('Choose a PNG, JPEG, WebP, MP4, or WebM file.')
  }
  const maximumBytes = isVideo ? 250 * 1024 * 1024 : 75 * 1024 * 1024
  if (file.size < 1 || file.size > maximumBytes) {
    throw new Error(isVideo
      ? 'Choose a video no larger than 250 MB.'
      : 'Choose a picture no larger than 75 MB.')
  }
  const sha256 = [...new Uint8Array(await globalThis.crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  ))].map(value => value.toString(16).padStart(2, '0')).join('')
  const assetId = `sha256:${sha256}`
  const response = await fetch(
    `${ENDPOINT}/assets/${encodeURIComponent(assetId)}`,
    {
      method: 'PUT',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': file.type },
      body: file,
    },
  )
  let value: any = null
  try { value = await response.json() } catch { /* handled below */ }
  if (!response.ok || !value?.asset) {
    throw new Error(
      typeof value?.error === 'string'
        ? value.error
        : `Media upload failed (${response.status}).`,
    )
  }
  return { assetId, sha256, metadata: value.asset as Record<string, any> }
}

function safeImageFileName(value: string, mediaType: string) {
  const extension = mediaType === 'image/png'
    ? 'png'
    : mediaType === 'image/webp'
      ? 'webp'
      : 'jpg'
  const base = value.normalize('NFC').replace(/[\\/\p{Cc}]/gu, '-').trim().slice(0, 180)
  return { fileName: base || `service-picture.${extension}`, extension }
}

function safeVideoFileName(value: string, mediaType: string) {
  const extension = mediaType === 'video/webm' ? 'webm' : 'mp4'
  const base = value.normalize('NFC').replace(/[\/\p{Cc}]/gu, '-').trim().slice(0, 180)
  return { fileName: base || `service-video.${extension}`, extension }
}

function cloneProject(project: ServiceProject): ServiceProject {
  return JSON.parse(JSON.stringify(project)) as ServiceProject
}

function itemPreset(item: ProjectItem) {
  return item.kind === 'song' ? item.lyricsPresetId : item.presetId
}

function presetChoices(item: ProjectItem) {
  if (item.kind === 'song') return ['wotbc-song-stacked', 'wotbc-song-lyrics', 'song-lyrics']
  if (item.kind === 'bible') return ['wotbc-reading', 'scripture-large', 'scripture-text']
  if (item.kind === 'sermon') return ['wotbc-sermon', 'sermon-point', 'sermon-notes']
  if (item.kind === 'notice') return ['notice-text', 'sermon-point']
  if (item.kind === 'picture') return ['picture-fullscreen']
  if (item.kind === 'video') return ['video-fullscreen']
  if (item.kind === 'blank') return ['blank-black']
  return []
}

function previewBlockText(block: Record<string, any>) {
  if (typeof block.text === 'string') return block.text
  if (Array.isArray(block.verses)) {
    return [block.reference, ...block.verses.map((verse: any) => `${verse.number} ${verse.text}`)].filter(Boolean).join('\n')
  }
  if (block.type === 'image') return block.altText || 'Picture'
  if (block.type === 'video') return 'Video'
  return ''
}

function SlideText({ text, label, role, spans = [], readOnly = false, onCommit }: { text: string; label: string; role: string; spans?: Record<string, any>[]; readOnly?: boolean; onCommit: (value: string) => void }) {
  const element = useRef<HTMLDivElement>(null)
  const paint = () => {
    const node = element.current
    if (!node) return
    node.replaceChildren()
    let offset = 0
    for (const span of spans) {
      node.append(document.createTextNode(text.slice(offset, span.start)))
      const fragment = document.createElement('span')
      fragment.textContent = text.slice(span.start, span.end)
      if (span.foreground) fragment.style.color = span.foreground
      if (span.weight) fragment.style.fontWeight = span.weight
      if (span.fontScale) fragment.style.fontSize = `${span.fontScale}em`
      node.append(fragment)
      offset = span.end
    }
    node.append(document.createTextNode(text.slice(offset)))
  }
  useEffect(paint, [text, spans])
  return <div ref={element} className="heritage-service-planner__editable-text" data-role={role}
    data-fit-text
    contentEditable={readOnly ? false : 'plaintext-only'} suppressContentEditableWarning role={readOnly ? undefined : 'textbox'} aria-multiline={readOnly ? undefined : true} aria-label={label}
    onBlur={event => { const value = event.currentTarget.innerText; if (value !== text) onCommit(value); paint() }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.currentTarget.innerText = text; event.currentTarget.blur() }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.blur() }
    }} />
}

function PreviewCanvas({ kind, presetId, titleCard, singer, next, children }: { kind: string; presetId?: string; titleCard?: boolean; singer?: boolean; next?: {state: string; text: string}; children: React.ReactNode }) {
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const fit = () => {
      const logicalSize = titleCard ? 98 : kind === 'bible' ? 96 : kind === 'sermon' ? 82 : kind === 'song' ? (presetId === 'wotbc-song-lyrics' ? 106 : 98) : 76
      let size = element.clientWidth / 1920 * logicalSize
      element.style.setProperty('--slide-text-size', `${size}px`)
      const overflows = () => {
        const content = element.querySelector<HTMLElement>('.heritage-service-planner__slide-content')!
        const textOverflow = [...element.querySelectorAll<HTMLElement>('[data-fit-text]')].some(node => node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)
        // Credits deliberately sit outside the centered title region.
        if (titleCard) return textOverflow || [...content.querySelectorAll<HTMLElement>('[data-role="title"], [data-role="subtitle"]')].reduce((height, node) => height + node.offsetHeight, 0) > content.clientHeight
        return textOverflow || content.scrollHeight > content.clientHeight + 1 || content.scrollWidth > content.clientWidth + 1
      }
      while (size > 6 && overflows()) {
        size *= 0.92
        element.style.setProperty('--slide-text-size', `${size}px`)
      }
      // Match the text after fitting, including title/body preset overrides.
      // The footer clips its prefix to one line; it must never shrink to fit.
      const content = element.querySelector<HTMLElement>('.heritage-service-planner__slide-content')!
      const primary = content.querySelector<HTMLElement>('[data-role="lyrics"], [data-role="body"]')
        || content.querySelector<HTMLElement>('.heritage-service-planner__scripture-page p:not(.heritage-service-planner__scripture-reference)')
        || content.querySelector<HTMLElement>('[data-role="title"], [data-fit-text]')
      const typography = getComputedStyle(primary || content)
      element.style.setProperty('--singer-next-font-size', primary ? typography.fontSize : `${size}px`)
      element.style.setProperty('--singer-next-font-weight', typography.fontWeight)
      element.style.setProperty('--singer-next-font-family', typography.fontFamily)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    element.addEventListener('input', fit)
    fit()
    return () => { observer.disconnect(); element.removeEventListener('input', fit) }
  }, [children, kind, presetId, titleCard, singer])
  return <div className="heritage-service-planner__canvas-space"><div ref={stage} className="heritage-service-planner__stage" data-kind={kind} data-preset={presetId} data-title-card={titleCard || undefined} data-singer={singer || undefined}><div className="heritage-service-planner__slide-content">{children}</div>
    {singer && next ? <aside className="heritage-service-planner__next-lines" aria-label="Next slide cue" data-state={next.state}>
      <p>{next.state === 'end' ? 'End of presentation' : next.text}</p>
    </aside> : null}
  </div></div>
}

function descendantIds(project: ServiceProject, itemId: string, found = new Set<string>()) {
  if (found.has(itemId)) return found
  found.add(itemId)
  const item = project.items[itemId]
  if (item?.kind === 'group') item.childIds.forEach((childId: string) => descendantIds(project, childId, found))
  return found
}

function sermonDocumentIdForItem(project: ServiceProject | null, item: ProjectItem | null) {
  if (!project || !item) return null
  let resourceId = item.sermonResourceId || item.sermonReading?.sermonResourceId
  if (!resourceId) {
    const owner = Object.values(project.items).find(candidate => (
      candidate.kind === 'group'
      && candidate.sermonResourceId
      && descendantIds(project, candidate.id).has(item.id)
    ))
    resourceId = owner?.sermonResourceId
  }
  const resource = resourceId ? project.resources?.[resourceId] : null
  return resource?.kind === 'sermon' ? String(resource.document?.id || '') || null : null
}

function songTreatmentValue(variant: Record<string, any> | undefined) {
  if (!variant || variant.mode === 'hidden') return 'hidden'
  if (variant.mode === 'inherit') return `inherit:${variant.from}`
  if (variant.mode === 'derive') return `derive-next-text:${variant.from}`
  return 'content'
}

function today() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function NewService({ onCreated, onCopy }: { onCreated: (value: ServiceEnvelopeInput) => void; onCopy?: () => void }) {
  const [title, setTitle] = useState('Sunday Morning Service')
  const [serviceDate, setServiceDate] = useState(today)
  const titleInput = useRef<HTMLInputElement>(null)
  const serviceDateInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    const visibleTitle = titleInput.current?.value.trim() || title.trim()
    const visibleServiceDate = serviceDateInput.current?.value || serviceDate
    setBusy(true)
    setError(null)
    try {
      const response = await jsonRequest(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: 1,
          requestId: uuid(),
          syncId: `service-${visibleServiceDate}`,
          title: visibleTitle,
          serviceDate: visibleServiceDate,
        }),
      })
      onCreated(response.serviceDocument)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="heritage-service-planner__new">
      <summary>+ New service</summary>
      <div>
        <label>
          <span>Service title</span>
          <input ref={titleInput} value={title} maxLength={200} onChange={event => setTitle(event.target.value)} />
        </label>
        <label>
          <span>Service date</span>
          <input ref={serviceDateInput} type="date" value={serviceDate} onChange={event => setServiceDate(event.target.value)} />
        </label>
        <button className="btn btn--style-primary" type="button" disabled={busy || !title.trim() || !serviceDate} onClick={create}>
          {busy ? 'Creating…' : 'Create service'}
        </button>
        {onCopy ? <button type="button" onClick={onCopy}>Make a copy of the current service</button> : null}
        {error ? <p className="heritage-service-planner__error" role="alert">{error}</p> : null}
      </div>
    </details>
  )
}

export default function PlanServiceClient() {
  const [summaries, setSummaries] = useState<ServiceSummary[]>([])
  const [envelope, setEnvelope] = useState<ServiceEnvelope | null>(null)
  const [draft, setDraft] = useState<ServiceProject | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [desiredStatus, setDesiredStatus] = useState<ServiceEnvelope['status']>('planning')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [songLibrary, setSongLibrary] = useState<SongLibraryOption[]>([])
  const [songChoice, setSongChoice] = useState('')
  const [bibleBooks, setBibleBooks] = useState<BibleBookOption[]>([])
  const [bibleBookId, setBibleBookId] = useState('Eph')
  const [bibleChapter, setBibleChapter] = useState(3)
  const [bibleStartVerse, setBibleStartVerse] = useState(14)
  const [bibleEndVerse, setBibleEndVerse] = useState(21)
  const [resourceTab, setResourceTab] = useState<ResourceTab>('songs')
  const [previewChannel, setPreviewChannel] = useState<ChannelId>('english')
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0)
  const [menu, setMenu] = useState<{ row: PlannerSlide; x: number; y: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null)
  const dragged = useRef<PlannerSlide | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const workspaceMenuRef = useRef<HTMLDetailsElement>(null)
  const [undoStack, setUndoStack] = useState<ServiceProject[]>([])
  const bibleBookInput = useRef<HTMLSelectElement>(null)
  const bibleChapterInput = useRef<HTMLInputElement>(null)
  const bibleStartVerseInput = useRef<HTMLInputElement>(null)
  const bibleEndVerseInput = useRef<HTMLInputElement>(null)
  const pictureInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const pictureTarget = useRef<PictureUploadTarget>('new')
  const [notice, setNotice] = useState('Choose a service or create the next one.')
  const selected = selectedId && draft ? draft.items[selectedId] || null : null
  const slideList = useMemo<{ rows: PlannerSlide[]; error: string }>(() => {
    if (!draft) return { rows: [], error: '' }
    try {
      return { rows: plannerSlides(draft), error: '' }
    } catch (caught) {
      return { rows: [], error: errorText(caught) }
    }
  }, [draft])
  const selectedSlides = slideList.rows.filter(row => row.itemId === selectedId && row.cue)
  const activePreviewIndex = Math.min(previewSlideIndex, Math.max(0, selectedSlides.length - 1))
  const activeSlide = selectedSlides[activePreviewIndex]
  const activePreviewCue = activeSlide?.cue
  const preview = plannerPreview(slideList.rows, activeSlide, previewChannel)
  const activePreviewOutput = preview.output
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) workspaceMenuRef.current.open = false
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  useEffect(() => {
    if (!menu) return
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [menu])
  const selectedSermonDocumentId = sermonDocumentIdForItem(draft, selected)
  const selectedSongContentChannels = selected?.kind === 'song'
    ? CHANNEL_IDS.filter(channelId => selected.variants?.[channelId]?.mode === 'content')
    : []

  async function loadList() {
    setBusy(true)
    setError(null)
    try {
      const result = await jsonRequest(ENDPOINT)
      setSummaries(result.items || [])
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  async function loadLibraries() {
    try {
      const [songs, bible] = await Promise.all([
        jsonRequest(`${ENDPOINT}/library/songs`),
        jsonRequest(`${ENDPOINT}/library/bible-passage`),
      ])
      const nextSongs = songs.items || []
      setSongLibrary(nextSongs)
      setSongChoice(current => current || nextSongs[0]?.syncId || '')
      setBibleBooks(bible.books || [])
    } catch (caught) {
      setError(errorText(caught))
    }
  }

  function useEnvelope(next: ServiceEnvelopeInput) {
    const project = projectFromServiceEnvelope(next) as ServiceProject
    const prepared = preparePlannerPresentation(project)
    const normalized = { ...next, project } as ServiceEnvelope
    setEnvelope(normalized)
    setDraft(cloneProject(prepared.project as ServiceProject))
    setSelectedId(plannerSlides(prepared.project).find(row => row.cue)?.itemId || null)
    setPreviewSlideIndex(0)
    setUndoStack([])
    setMenu(null)
    setDesiredStatus(next.status)
    setDirty(prepared.changed)
    setError(null)
    setNotice(prepared.changed
      ? 'Projector layout updated: short Scripture pages and minimal song titles. Save service to keep these changes.'
      : `${project.title} is open at Community version ${next.syncVersion}.`)
    loadList()
  }

  async function openService(syncId: string) {
    if (dirty && !globalThis.confirm('Discard the unsaved service changes on this page?')) return
    setBusy(true)
    setError(null)
    try {
      const result = await jsonRequest(`${ENDPOINT}/${encodeURIComponent(syncId)}`)
      useEnvelope(result.serviceDocument)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  async function copyService() {
    if (!draft || busy) return
    setBusy(true)
    setError(null)
    try {
      const syncId = `service-${draft.serviceDate}-${uuid().slice(0, 8)}`
      const title = `${draft.title.slice(0, 190)} — copy`
      const created = await jsonRequest(ENDPOINT, { method: 'POST', body: JSON.stringify({
        schemaVersion: 1, requestId: uuid(), syncId, title, serviceDate: draft.serviceDate,
      }) })
      const project = cloneProject(draft)
      project.id = syncId
      project.title = title
      project.revision = 2
      project.createdAt = new Date().toISOString()
      project.updatedAt = project.createdAt
      delete project.planning
      const result = await jsonRequest(`${ENDPOINT}/${encodeURIComponent(syncId)}`, { method: 'PUT', body: JSON.stringify({
        schemaVersion: 1, requestId: uuid(), syncId,
        baseSyncVersion: created.serviceDocument.syncVersion, baseRevision: created.serviceDocument.revision,
        documentSource: serviceCore.serializeHeritageServiceDocument(serviceCore.createHeritageServiceDocument(project)), status: 'planning',
      }) })
      useEnvelope(result.serviceDocument)
      setNotice('Service copied. The original service is unchanged.')
    } catch (caught) { setError(errorText(caught)) }
    finally { setBusy(false) }
  }

  useEffect(() => {
    loadList()
    loadLibraries()
  }, [])

  function change(mutator: (project: ServiceProject) => void) {
    if (!draft) return
    const next = cloneProject(draft)
    mutator(next)
    setUndoStack(stack => [...stack.slice(-29), draft])
    setDraft(next)
    setDesiredStatus('planning')
    setDirty(true)
    setNotice('Unsaved changes — output previews update immediately.')
  }

  function updateSelected(patch: Record<string, unknown>) {
    if (!selectedId) return
    change(project => {
      project.items[selectedId] = {
        ...project.items[selectedId],
        ...patch,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  function selectSlide(row: PlannerSlide) {
    setSelectedId(row.itemId)
    setPreviewSlideIndex(Math.max(0, row.index))
  }

  function slideMutation(operation: () => any, index = activePreviewIndex) {
    if (!draft) return
    try {
      const next = operation() as ServiceProject
      if (next === draft) return
      setUndoStack(stack => [...stack.slice(-29), draft])
      setDraft(cloneProject(next))
      setPreviewSlideIndex(index)
      setDirty(true)
      setDesiredStatus('planning')
      setError(null)
      setNotice('Unsaved changes · Library originals are unchanged.')
    } catch (caught) { setError(errorText(caught)) }
  }

  function removeSlide(row: PlannerSlide) {
    setMenu(null)
    const scope = row.kind === 'group' ? 'this section and all its slides' : row.kind === 'song' && row.index === 0 ? 'this song and all its slides' : 'this slide'
    if (!globalThis.confirm(`Delete ${scope}: “${row.title}”? You can undo before saving.`)) return
    slideMutation(() => deletePlannerSlide(draft!, row), Math.max(0, row.index - 1))
  }

  function moveSlide(from: PlannerSlide, to: PlannerSlide, after = false) {
    slideMutation(() => movePlannerSlide(draft!, from, to, after), from.kind === 'song' && from.index > 0
      ? Math.max(1, to.index + Number(after) - Number(from.index < to.index + Number(after))) : 0)
    setSelectedId(from.itemId)
    setDropTarget(null)
    dragged.current = null
    setMenu(null)
  }

  function undo() {
    const previous = undoStack.at(-1)
    if (!previous) return
    setDraft(previous)
    setUndoStack(stack => stack.slice(0, -1))
    setDirty(true)
    setDesiredStatus('planning')
    setError(null)
    setNotice('Change undone. Save when ready.')
  }

  function add(kind: 'group' | 'notice' | 'sermon' | 'blank') {
    if (!draft) return
    const now = new Date().toISOString()
    const id = `${kind}-${uuid()}`
    const parentId = selected?.kind === 'group' ? selected.id : null
    const text = kind === 'sermon' ? 'Sermon point' : 'Notice'
    change(project => {
      const common = {
        id,
        kind,
        title: kind === 'group' ? 'Section' : kind === 'blank' ? 'Blank' : text,
        operatorNotes: '',
        createdAt: now,
        updatedAt: now,
      }
      project.items[id] = kind === 'group'
        ? { ...common, groupKind: 'section', childIds: [] }
        : kind === 'blank'
          ? { ...common, channelIds: [...project.channelIds], presetId: 'blank-black' }
          : {
              ...common,
              textByChannel: Object.fromEntries(project.channelIds.map(channelId => [channelId, text])),
              presetId: kind === 'sermon' ? 'wotbc-sermon' : 'notice-text',
              ...(kind === 'sermon' ? { titlesByChannel: { english: 'Sermon heading', russian: 'Тема проповеди', media: 'Тема проповеди' } } : {}),
            }
      if (parentId) project.items[parentId].childIds.push(id)
      else project.rootItemIds.push(id)
    })
    setSelectedId(id)
    setPreviewSlideIndex(0)
  }

  function acceptCoreProject(project: ServiceProject, itemId: string, message: string) {
    if (draft) setUndoStack(stack => [...stack.slice(-29), draft])
    const prepared = preparePlannerPresentation(project).project as ServiceProject
    setDraft(cloneProject(prepared))
    setSelectedId(prepared.items[itemId]?.kind === 'group' ? prepared.items[itemId].childIds[0] || itemId : itemId)
    setPreviewSlideIndex(0)
    setDesiredStatus('planning')
    setDirty(true)
    setError(null)
    setNotice(message)
  }

  async function addLibrarySong() {
    if (!draft || !songChoice || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await jsonRequest(
        `${ENDPOINT}/library/songs/${encodeURIComponent(songChoice)}`,
      )
      const librarySong = response.item
      const documents = (librarySong.syncDocuments || []).map((value: any) => ({
        ...value,
        ...parsePlannerLibrarySongDocument(value.source, {
          fileName: `${value.id}.md`,
        }),
      }))
      if (!documents.length) throw new Error('This song has no reviewed document to pin.')

      let project = cloneProject(draft)
      const pinned = documents.map((value: any) => {
        const result = (serviceCore.addSongResource as any)(project, value.document, {
          provider: 'heritage-community',
          providerId: 'song-library',
          itemId: librarySong.syncId,
          revision: value.revision,
        })
        project = result.project
        return { ...value, resourceId: result.resourceId }
      })
      const english = pinned.find((value: any) => value.document.language === 'en')
      const russian = pinned.find((value: any) => value.document.language === 'ru')
      const primary = english || russian || pinned[0]
      const compatible = (candidate: any) => (
        !candidate
        || candidate.resourceId === primary.resourceId
        || serviceCore.compareSongTranslations(primary.document, candidate.document).compatible
      )
      const alignedEnglish = compatible(english) ? english : null
      const alignedRussian = compatible(russian) ? russian : null
      const resourceByChannel = {
        english: alignedEnglish?.resourceId || primary.resourceId,
        russian: alignedRussian?.resourceId || primary.resourceId,
        media: alignedRussian?.resourceId || alignedEnglish?.resourceId || primary.resourceId,
      }
      const primaryChannelId = resourceByChannel.english === primary.resourceId
        ? 'english'
        : resourceByChannel.russian === primary.resourceId
          ? 'russian'
          : 'media'
      const arrangementSource = [primary, alignedEnglish, alignedRussian]
        .filter(Boolean)
        .sort((left: any, right: any) => (
          right.arrangementSectionIds.length - left.arrangementSectionIds.length
        ))[0]
      const itemId = `song-${uuid()}`
      project = serviceCore.addProjectItem(project, {
        id: itemId,
        kind: 'song',
        title: [librarySong.title, librarySong.russianTitle]
          .filter(Boolean)
          .filter((value: string, index: number, values: string[]) => values.indexOf(value) === index)
          .join(' / '),
        operatorNotes: `From Community song ${librarySong.syncId} v${librarySong.syncVersion}.`,
        variants: Object.fromEntries(CHANNEL_IDS.map(channelId => [channelId, {
          mode: 'content',
          resourceId: resourceByChannel[channelId],
          titleCardMode: 'simple',
        }])),
        arrangement: arrangementSource.arrangementSectionIds.map((sectionId: string) => ({
          id: `arr-${uuid()}`,
          sectionId,
        })),
        primaryChannelId,
        titlePresetId: 'song-title',
        lyricsPresetId: 'song-lyrics',
      }, {
        parentId: selected?.kind === 'group' ? selected.id : null,
        now: new Date().toISOString(),
      })
      const singersSourceChannelId = alignedRussian
        ? 'russian'
        : alignedEnglish
          ? 'english'
          : primaryChannelId
      project = serviceCore.setSongChannelTreatment(project, {
        itemId,
        channelId: 'media',
        mode: 'derive-next-text',
        sourceChannelId: singersSourceChannelId,
        now: new Date().toISOString(),
      })
      const unaligned = Boolean((english && !alignedEnglish) || (russian && !alignedRussian))
      acceptCoreProject(
        project,
        itemId,
        unaligned
          ? 'Song pinned. One translation was not structurally aligned, so the reviewed primary version is used on that output until its arrangement is reviewed.'
          : 'Song pinned from Community with exact reviewed revisions. Save the shared service when the order is ready.',
      )
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  async function addBiblePassage() {
    if (!draft || busy) return
    const visibleBibleBookId = bibleBookInput.current?.value || bibleBookId
    const visibleBibleChapter = Number(bibleChapterInput.current?.value || bibleChapter)
    const visibleBibleStartVerse = Number(bibleStartVerseInput.current?.value || bibleStartVerse)
    const visibleBibleEndVerse = Number(bibleEndVerseInput.current?.value || bibleEndVerse)
    setBusy(true)
    setError(null)
    try {
      const response = await jsonRequest(`${ENDPOINT}/library/bible-passage`, {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: 1,
          bookId: visibleBibleBookId,
          chapter: visibleBibleChapter,
          startVerse: visibleBibleStartVerse,
          endVerse: visibleBibleEndVerse,
        }),
      })
      const passage = response.passage
      const itemId = `bible-${uuid()}`
      const project = serviceCore.addBibleItem(draft, {
        id: itemId,
        title: `${passage.title} · BSB / SYNO-W`,
        range: passage.range,
        passagesByChannel: passage.passagesByChannel,
        presetId: 'scripture-large',
        operatorNotes: 'Exact Bible text pinned from the configured Heritage reader data.',
        parentId: selected?.kind === 'group' ? selected.id : null,
        now: new Date().toISOString(),
      })
      acceptCoreProject(
        project,
        itemId,
        'Reading added as short, synchronized Scripture slides. Save service when ready.',
      )
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  function setSelectedSongTreatment(channelId: ChannelId, value: string) {
    if (!draft || selected?.kind !== 'song' || value === 'content') return
    try {
      const [mode, sourceChannelId] = value.split(':')
      const source = cloneProject(draft)
      // Removing a direct translation also removes it from the visible stack.
      // Keep the credit and fall back to the remaining actual content channel.
      const presentation = source.items[selected.id].songPresentation
      if (presentation && [presentation.primaryChannelId, presentation.secondaryChannelId].includes(channelId)) {
        const remaining = Object.keys(selected.variants).filter(id => id !== channelId && selected.variants[id].mode === 'content')
        source.items[selected.id].songPresentation = { ...presentation, stackedTranslation: false,
          primaryChannelId: remaining[0], secondaryChannelId: remaining[1] || null }
        source.items[selected.id].lyricsPresetId = 'wotbc-song-lyrics'
      }
      const project = serviceCore.setSongChannelTreatment(source, {
        itemId: selected.id,
        channelId,
        mode,
        sourceChannelId: sourceChannelId || null,
        now: new Date().toISOString(),
      })
      acceptCoreProject(
        project,
        selected.id,
        'Song output treatment changed while retaining the exact pinned library revisions.',
      )
    } catch (caught) {
      setError(errorText(caught))
    }
  }

  function choosePicture(target: PictureUploadTarget) {
    pictureTarget.current = target
    if (pictureInput.current) {
      pictureInput.current.value = ''
      pictureInput.current.click()
    }
  }

  async function pictureChosen(file: File | undefined) {
    if (!file || !draft || uploadingPicture) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP picture.')
      return
    }
    setUploadingPicture(true)
    setError(null)
    setNotice('Uploading the exact picture privately…')
    try {
      const uploaded = await uploadServiceMedia(file)
      const now = new Date().toISOString()
      const safeName = safeImageFileName(file.name, uploaded.metadata.mediaType)
      const asset = {
        id: uploaded.assetId,
        kind: 'image',
        mediaType: uploaded.metadata.mediaType,
        fileName: safeName.fileName,
        storedName: `${uploaded.sha256}.${safeName.extension}`,
        size: uploaded.metadata.size,
        sha256: uploaded.sha256,
        createdAt: now,
        width: uploaded.metadata.width,
        height: uploaded.metadata.height,
        orientation: uploaded.metadata.orientation,
        altText: file.name,
        attribution: '',
      }
      const target = pictureTarget.current
      if (target === 'new') {
        const id = `picture-${uuid()}`
        const parentId = selected?.kind === 'group' ? selected.id : null
        change(project => {
          project.assets[asset.id] = asset
          project.items[id] = {
            id,
            kind: 'picture',
            title: file.name.replace(/\.[^.]+$/u, '') || 'Picture',
            operatorNotes: '',
            createdAt: now,
            updatedAt: now,
            assetIdsByChannel: Object.fromEntries(
              project.channelIds.map(channelId => [channelId, asset.id]),
            ),
            fit: 'fit',
            focalPoint: { x: 0.5, y: 0.5 },
            altText: file.name,
            attribution: '',
            presetId: 'picture-fullscreen',
          }
          if (parentId) project.items[parentId].childIds.push(id)
          else project.rootItemIds.push(id)
        })
        setSelectedId(id)
      } else if (selected?.kind === 'picture') {
        change(project => {
          project.assets[asset.id] = asset
          const item = project.items[selected.id]
          const current = item.assetIdsByChannel
            ? { ...item.assetIdsByChannel }
            : Object.fromEntries((item.channelIds || project.channelIds)
              .map((channelId: string) => [channelId, item.assetId]))
          if (target === 'all') {
            item.assetIdsByChannel = Object.fromEntries(
              project.channelIds.map(channelId => [channelId, asset.id]),
            )
          } else {
            current[target] = asset.id
            item.assetIdsByChannel = current
          }
          delete item.assetId
          delete item.channelIds
          item.altText = item.altText || file.name
          item.updatedAt = now
        })
      }
      setNotice('Picture uploaded privately. Save the shared service to attach it to this revision.')
    } catch (caught) {
      setError(errorText(caught))
      setNotice('The service itself was not changed.')
    } finally {
      setUploadingPicture(false)
    }
  }

  async function videoChosen(file: File | undefined) {
    if (!file || !draft || uploadingVideo) return
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      setError('Choose an MP4 or WebM video.')
      return
    }
    setUploadingVideo(true)
    setError(null)
    setNotice('Uploading the exact video privately…')
    try {
      const uploaded = await uploadServiceMedia(file)
      const now = new Date().toISOString()
      const safeName = safeVideoFileName(file.name, uploaded.metadata.mediaType)
      const asset = {
        id: uploaded.assetId,
        kind: 'video',
        mediaType: uploaded.metadata.mediaType,
        fileName: safeName.fileName,
        storedName: `${uploaded.sha256}.${safeName.extension}`,
        size: uploaded.metadata.size,
        sha256: uploaded.sha256,
        createdAt: now,
        altText: file.name,
        attribution: '',
      }
      const id = `video-${uuid()}`
      const parentId = selected?.kind === 'group' ? selected.id : null
      change(project => {
        project.assets[asset.id] = asset
        project.items[id] = {
          id,
          kind: 'video',
          title: file.name.replace(/\.[^.]+$/u, '') || 'Video',
          operatorNotes: 'First Right or Space starts playback. Space pauses or resumes; Right advances.',
          createdAt: now,
          updatedAt: now,
          assetId: asset.id,
          channelIds: [...project.channelIds],
          audioChannelId: project.channelIds[0],
          fit: 'fit',
          presetId: 'video-fullscreen',
        }
        if (parentId) project.items[parentId].childIds.push(id)
        else project.rootItemIds.push(id)
      })
      setSelectedId(id)
      setNotice('Video uploaded privately. Save the shared service to attach it to this revision.')
    } catch (caught) {
      setError(errorText(caught))
      setNotice('The service itself was not changed.')
    } finally {
      setUploadingVideo(false)
    }
  }

  async function save() {
    if (!draft || !envelope) return
    setBusy(true)
    setError(null)
    try {
      const project = cloneProject(draft)
      if (dirty) {
        project.revision = envelope.project.revision + 1
        project.updatedAt = new Date().toISOString()
      }
      const documentSource = serviceCore.serializeHeritageServiceDocument(
        serviceCore.createHeritageServiceDocument(project),
      )
      const response = await jsonRequest(
        `${ENDPOINT}/${encodeURIComponent(envelope.syncId)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            schemaVersion: 1,
            requestId: uuid(),
            syncId: envelope.syncId,
            baseSyncVersion: envelope.syncVersion,
            baseRevision: envelope.revision,
            documentSource,
            status: desiredStatus,
          }),
        },
      )
      useEnvelope(response.serviceDocument)
      setNotice(
        response.serviceDocument.status === 'ready'
          ? 'This exact revision is Ready.'
          : 'Saved. SyncShow can open this exact Community revision.',
      )
    } catch (caught: any) {
      setError(
        caught?.status === 412
          ? 'This service changed somewhere else. Your unsaved copy is still on this screen; open the current Community copy in another tab and review both before choosing what to keep.'
          : errorText(caught),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="heritage-service-planner">
      {error ? <p className="heritage-service-planner__error" role="alert">{error}</p> : null}

      <div className="heritage-service-planner__shell">
        <aside className="heritage-service-planner__navigation">
          <div className="heritage-service-planner__toolbar">
            <details ref={workspaceMenuRef} className="heritage-service-planner__app-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
              <summary aria-label="Workspace menu" title="Workspace menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></summary>
              <nav aria-label="Church workspace">
                <strong>Church workspace</strong>
                <a href="/admin">Workspace home</a>
                <a href="/admin/prepare-sermon">Prepare a sermon</a>
                <a href="/admin/sermon-publications">Publish sermons</a>
                <a href="/admin/collections/songs">Song library</a>
                <a href="/admin/collections/sermons">Sermon library</a>
                <a href="/admin/collections/media">Media library</a>
                <a href="/" target="_blank" rel="noreferrer">Church website ↗</a>
                <a href="/admin/account">My account</a>
                <a href="/admin/logout">Log out</a>
                <small>{notice}</small>
              </nav>
            </details>
            <label htmlFor="service-status">Status</label>
            <select id="service-status" value={desiredStatus} disabled={!draft || busy} onChange={event => setDesiredStatus(event.target.value as ServiceEnvelope['status'])}>
              <option value="planning">Planning</option><option value="ready">Ready</option>
              <option value="archived">Archived</option><option value="cancelled">Cancelled</option>
            </select>
            <button type="button" aria-label="Save service" title={!draft ? 'Open a service to save' : busy ? 'Saving…' : dirty || desiredStatus !== envelope?.status ? 'Save service · unsaved changes' : `Saved · v${envelope?.syncVersion || ''}`}
              disabled={!draft || busy || (!dirty && desiredStatus === envelope?.status)} onClick={save}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l4 4v14H3V3h2zm2 0v7h10V3M7 21v-7h10v7" /></svg>
            </button>
          </div>
          <p className="heritage-service-planner__save-state" aria-live="polite" title={notice}>{draft ? `${slideList.rows.filter(row => row.cue).length} slides · ${busy ? 'Working…' : dirty || desiredStatus !== envelope?.status ? 'Unsaved changes' : `Saved v${envelope?.syncVersion}`}` : notice}</p>
          <div className="heritage-service-planner__service-picker">
            <label>
              <span>Current service</span>
              <select value={envelope?.syncId || ''} disabled={busy} onChange={event => openService(event.target.value)}>
                <option value="" disabled>Choose a service…</option>
                {summaries.map(summary => <option key={summary.syncId} value={summary.syncId}>{summary.serviceDate} · {summary.title}</option>)}
              </select>
            </label>
            <button type="button" aria-label="Refresh services" disabled={busy} onClick={loadList}>↻</button>
          </div>
          <NewService onCreated={useEnvelope} onCopy={draft && !busy ? copyService : undefined} />

          <div className="heritage-service-planner__outline-heading">
            <h2>Service order</h2>
            <div className="heritage-service-planner__add">
              <button type="button" disabled={!draft} onClick={() => add('group')}>+ Section</button>
              <button type="button" disabled={!draft} onClick={() => add('notice')}>+ Slide</button>
              <button type="button" disabled={!draft} onClick={() => add('sermon')}>+ Sermon</button>
              <button type="button" disabled={!draft} onClick={() => add('blank')}>+ Blank</button>
            </div>
          </div>

          {draft ? <ol className="heritage-service-planner__rows">
            {slideList.rows.map(row => {
              const openMenu = (x: number, y: number) => { selectSlide(row); setMenu({ row, x: Math.min(x, window.innerWidth - 240), y: Math.min(y, window.innerHeight - 190) }) }
              return <li key={row.id} style={{ '--service-depth': row.depth } as React.CSSProperties}
                data-drop={dropTarget?.id === row.id ? (dropTarget.after ? 'after' : 'before') : undefined}>
                <button className="heritage-service-planner__row" data-kind={row.kind}
                  data-selected={selectedId === row.itemId && (row.index < 0 || activePreviewIndex === row.index) || undefined}
                  type="button" draggable title={row.kind === 'song' && row.index === 0 ? `${row.title} · Drag to move the whole song` : row.title}
                  onClick={() => selectSlide(row)}
                  onContextMenu={event => { event.preventDefault(); openMenu(event.clientX, event.clientY) }}
                  onKeyDown={event => {
                    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                      event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(rect.left, rect.bottom)
                    }
                  }}
                  onDragStart={event => { dragged.current = row; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.id); setMenu(null) }}
                  onDragEnd={() => { dragged.current = null; setDropTarget(null) }}
                  onDragOver={event => { if (!dragged.current) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; const rect = event.currentTarget.getBoundingClientRect(); setDropTarget({ id: row.id, after: event.clientY > rect.top + rect.height / 2 }) }}
                  onDrop={event => { event.preventDefault(); if (dragged.current) moveSlide(dragged.current, row, dropTarget?.after) }}>
                  <span className="heritage-service-planner__kind" aria-hidden="true">{row.kind === 'group' ? '▾' : row.number}</span>
                  <span><strong>{row.title}</strong>{row.kind === 'group' ? <small>section</small> : row.kind === 'song' && row.index === 0 ? <small>song</small> : null}</span>
                </button>
              </li>
            })}
            {!slideList.rows.length ? <li className="heritage-service-planner__empty">{slideList.error || 'Add a section, song, reading, or slide.'}</li> : null}
          </ol> : <p className="heritage-service-planner__empty">No service open.</p>}
          {menu ? <div ref={menuRef} className="heritage-service-planner__context-menu" role="menu" aria-label="Slide actions" style={{ left: menu.x, top: menu.y }}
            onKeyDown={event => {
              if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
              event.preventDefault()
              const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
              buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
            }}>
            <small>{menu.row.kind === 'song' && menu.row.index === 0 ? 'Whole song' : menu.row.kind === 'group' ? 'Whole section' : `Slide ${menu.row.number}`}</small>
            {([-1, 1] as const).map(offset => {
              const candidates = slideList.rows.filter(row => menu.row.kind === 'song' && menu.row.index > 0
                ? row.itemId === menu.row.itemId && row.index > 0
                : row.parentId === menu.row.parentId && row.index <= 0)
              const target = candidates[candidates.findIndex(row => row.id === menu.row.id) + offset]
              return <button key={offset} type="button" role="menuitem" disabled={!target} onClick={() => target && moveSlide(menu.row, target, offset > 0)}>Move {offset < 0 ? 'up' : 'down'}</button>
            })}
            <button type="button" role="menuitem" onClick={() => removeSlide(menu.row)}>Delete</button>
          </div> : null}
        </aside>

        <main className="heritage-service-planner__editor">
          {selected ? <>
            <section className="heritage-service-planner__preview">
              <header className="heritage-service-planner__preview-heading">
                <div><strong>{activeSlide ? `Slide ${activeSlide.number}` : selected.title}</strong><span title={draft?.title}>{draft?.title}</span><time dateTime={draft?.serviceDate}>{draft?.serviceDate}</time></div>
                <button type="button" disabled={!undoStack.length} onClick={undo}>Undo</button>
              </header>
              <div className="heritage-service-planner__output-tabs" role="tablist" aria-label="Preview output">
                <span>Screen</span>
                {CHANNEL_IDS.map(channelId => <button key={channelId} type="button" role="tab" aria-selected={previewChannel === channelId} onClick={() => setPreviewChannel(channelId)}>{channelId === 'media' ? 'Singers' : draft?.channels[channelId]?.label || channelId}</button>)}
              </div>
              {selected.kind === 'song' && selected.songPresentation && !preview.singer ? <div className="heritage-service-planner__song-layout">
                <label><input type="checkbox" aria-label="Stacked translation" checked={selected.songPresentation.stackedTranslation}
                  disabled={!selected.songPresentation.secondaryChannelId}
                  onChange={event => updateSelected({ songPresentation: { ...selected.songPresentation, stackedTranslation: event.target.checked },
                    lyricsPresetId: event.target.checked ? 'wotbc-song-stacked' : 'wotbc-song-lyrics' })} /> Stacked translation</label>
                {selected.songPresentation.stackedTranslation ? <label>Top language <select aria-label="Top language" value={selected.songPresentation.primaryChannelId}
                  onChange={event => updateSelected({ songPresentation: { ...selected.songPresentation,
                    primaryChannelId: event.target.value, secondaryChannelId: selected.songPresentation.primaryChannelId } })}>
                  {[selected.songPresentation.primaryChannelId, selected.songPresentation.secondaryChannelId].map((id: string) => <option key={id} value={id}>{draft?.channels[id]?.label || id}</option>)}
                </select></label> : <span>{selected.songPresentation.secondaryChannelId ? 'One language per screen' : 'Single-language song'}</span>}
              </div> : null}
              <PreviewCanvas kind={selected.kind} presetId={preview.presetId} titleCard={selected.kind === 'song' && activeSlide?.index === 0} singer={preview.singer} next={preview.next}>
                {selected.kind === 'group' ? <p className="heritage-service-planner__stage-status">Choose a numbered slide on the left.<br />“{selected.title}” is a section, not a slide.</p>
                  : slideList.error ? <p className="heritage-service-planner__stage-status">Preview unavailable: {slideList.error}</p>
                  : activePreviewOutput?.mode === 'hide' ? <p className="heritage-service-planner__stage-status">Hidden on this screen</p>
                    : selected.kind === 'blank' ? <p className="heritage-service-planner__stage-status">Intentional blank screen</p>
                      : (activePreviewOutput?.blocks || []).map((block: any, index: number) => {
                        if (block.type === 'image' || block.type === 'video') {
                          if (!envelope?.project.assets?.[block.assetId]) return <p key={index} className="heritage-service-planner__stage-status">Save the service to preview this new media file.</p>
                          const source = `${ENDPOINT}/${encodeURIComponent(envelope.syncId)}/assets/${encodeURIComponent(block.assetId)}`
                          return block.type === 'image'
                            ? <img key={index} src={source} alt={block.altText || selected.title} />
                            : <video key={index} src={source} controls preload="metadata" muted={block.muted} />
                        }
                        if (block.type === 'bible') return <div key={index} className="heritage-service-planner__scripture-page" data-fit-text>
                          <p className="heritage-service-planner__scripture-reference">{block.reference} <small>{block.translationId}</small></p>
                          <p>{block.verses.map((verse: any, verseIndex: number) => <span key={verse.number}>{verseIndex > 0 ? ' ' : ''}<sup>{verse.number}</sup> {verse.text}</span>)}</p>
                        </div>
                        return activeSlide && block.type === 'text'
                          ? <SlideText key={`${activeSlide.id}:${previewChannel}:${index}`} text={previewBlockText(block)} role={block.role}
                              readOnly={preview.singer || !editablePreviewBlock(draft!, activeSlide, previewChannel, block)}
                              spans={block.spans}
                              label={`Slide ${activeSlide.number} ${selected.kind === 'song' && selected.songPresentation?.stackedTranslation && block.role === 'lyrics'
                                ? (index === 0 ? selected.songPresentation.primaryChannelId : selected.songPresentation.secondaryChannelId) : previewChannel} ${block.role} — click to edit`}
                              onCommit={text => slideMutation(() => editPlannerSlide(draft!, activeSlide, previewChannel, index, text))} />
                          : <p key={index} data-role={block.role || 'scripture'}>{previewBlockText(block)}</p>
                      })}
              </PreviewCanvas>
              <p className="heritage-service-planner__preview-note">{preview.singer
                ? 'Full primary-language slide · Same-size next line, fitted to the available width.'
                : selected.kind === 'bible' ? (activePreviewOutput?.blocks || []).some((block: any) => block.type === 'bible' && block.verses.reduce((count: number, verse: any) => count + scriptureLineCount(`${verse.number} ${verse.text}`), 0) > SCRIPTURE_PAGE_MAX_LINES)
                  ? 'This unusually long verse needs a shorter slide layout before projection.'
                  : 'One reading page · English and Russian advance together · Exact source text preserved.'
                  : selected.kind === 'song' && selected.songPresentation?.stackedTranslation ? 'Same stack on both audience screens · White primary language, orange translation · Click either to edit.'
                  : selected.kind === 'sermon' ? 'One language per screen · Gold heading and references · Click heading or body to edit.'
                  : selected.kind === 'picture' ? 'Picture slide. Replace its image from Media below.'
                    : 'Click the slide text to edit · Click outside to apply · Save to keep changes'}</p>
            </section>

            <details className="heritage-service-planner__advanced">
              <summary>Slide settings</summary>
              <div>
                <label><span>Item name</span><input value={selected.title} maxLength={200} onChange={event => updateSelected({ title: event.target.value })} /></label>
                <label><span>Notes for the operator</span><input value={selected.operatorNotes || ''} onChange={event => updateSelected({ operatorNotes: event.target.value })} /></label>
                {selected.kind === 'song' && selected.songPresentation ? <label><span>Song credit · bottom right of title slide</span><input aria-label="Song credit" value={selected.songPresentation.credits} maxLength={500}
                  onChange={event => updateSelected({ songPresentation: { ...selected.songPresentation, credits: event.target.value } })} /></label> : null}

            {selected.kind === 'picture' ? <div className="heritage-service-planner__picture-editor">
              <button type="button" disabled={uploadingPicture} onClick={() => choosePicture('all')}>{uploadingPicture ? 'Uploading…' : 'Replace on every output'}</button>
              <label><span>Image description</span><input value={selected.altText || ''} onChange={event => updateSelected({ altText: event.target.value })} /></label>
              <label><span>Attribution</span><input value={selected.attribution || ''} onChange={event => updateSelected({ attribution: event.target.value })} /></label>
            </div> : null}

            {selected.kind === 'video' ? <div className="heritage-service-planner__picture-editor">
              <p className="heritage-service-planner__boundary">The video opens paused. First Right or Space plays it; Space pauses or resumes; Right advances to the next service item.</p>
              <label><span>Audio output</span><select value={selected.audioChannelId} onChange={event => updateSelected({ audioChannelId: event.target.value })}>{selected.channelIds.map((channelId: string) => <option key={channelId} value={channelId}>{draft?.channels[channelId]?.label || channelId}</option>)}</select></label>
            </div> : null}

                {presetChoices(selected).length ? <label><span>Visual preset</span><select value={itemPreset(selected)} onChange={event => updateSelected(selected.kind === 'song' ? { lyricsPresetId: event.target.value } : { presetId: event.target.value })}>{presetChoices(selected).map(preset => <option key={preset} value={preset}>{preset}</option>)}</select></label> : null}
                {selected.kind === 'group' ? <label><span>Section type</span><select value={selected.groupKind} onChange={event => updateSelected({ groupKind: event.target.value })}>{['service', 'section', 'sermon', 'point', 'subpoint', 'custom'].map(kind => <option key={kind}>{kind}</option>)}</select></label> : null}
                {selected.kind === 'blank' ? CHANNEL_IDS.map(channelId => <label className="heritage-service-planner__check" key={channelId}><input type="checkbox" checked={selected.channelIds.includes(channelId)} onChange={event => updateSelected({ channelIds: event.target.checked ? [...new Set([...selected.channelIds, channelId])] : selected.channelIds.filter((id: string) => id !== channelId) })} /><span>Clear {draft?.channels[channelId]?.label || channelId}</span></label>) : null}
                {selected.kind === 'song' ? <div className="heritage-service-planner__treatments">
                  <p className="heritage-service-planner__boundary">Exact Community revisions stay pinned. Output-specific language choices live here so they do not clutter normal planning.</p>
                  {CHANNEL_IDS.map(channelId => {
                    const primaryChannelId = selected.primaryChannelId || selectedSongContentChannels[0]
                    return <label key={channelId}><span>{draft?.channels[channelId]?.label || channelId}</span><select value={songTreatmentValue(selected.variants?.[channelId])} disabled={channelId === primaryChannelId} onChange={event => setSelectedSongTreatment(channelId, event.target.value)}>
                      {selected.variants?.[channelId]?.mode === 'content' ? <option value="content">Pinned exact lyrics</option> : null}
                      {selectedSongContentChannels.filter(sourceChannelId => sourceChannelId !== channelId).flatMap(sourceChannelId => [
                        <option key={`inherit:${sourceChannelId}`} value={`inherit:${sourceChannelId}`}>Normal lyrics from {draft?.channels[sourceChannelId]?.label || sourceChannelId}</option>,
                        <option key={`derive:${sourceChannelId}`} value={`derive-next-text:${sourceChannelId}`}>Current + next from {draft?.channels[sourceChannelId]?.label || sourceChannelId}</option>,
                      ])}
                      <option value="hidden">Hidden</option>
                    </select></label>
                  })}
                </div> : null}
                {selected.kind === 'picture' ? <label><span>Fit</span><select value={selected.fit} onChange={event => updateSelected({ fit: event.target.value })}><option>fit</option><option>fill</option><option>stretch</option></select></label> : null}
                {selected.kind === 'video' ? <>
                  <label><span>Fit</span><select value={selected.fit} onChange={event => updateSelected({ fit: event.target.value })}><option>fit</option><option>fill</option><option>stretch</option></select></label>
                  {CHANNEL_IDS.map(channelId => <label className="heritage-service-planner__check" key={channelId}><input type="checkbox" checked={selected.channelIds.includes(channelId)} disabled={channelId === selected.audioChannelId} onChange={event => updateSelected({ channelIds: event.target.checked ? [...new Set([...selected.channelIds, channelId])] : selected.channelIds.filter((id: string) => id !== channelId) })} /><span>Show on {draft?.channels[channelId]?.label || channelId}{channelId === selected.audioChannelId ? ' · audio' : ''}</span></label>)}
                </> : null}
                {selected.kind === 'bible' ? <p className="heritage-service-planner__boundary">This reading keeps exact translation text and checksums. Add another canonical reading below if the passage changes.</p> : null}
                {selectedSermonDocumentId ? <a className="btn btn--style-secondary" href={`/admin/sermon-publications?sermon=${encodeURIComponent(selectedSermonDocumentId)}`}>Open sermon publication review</a> : null}
              </div>
            </details>

          </> : <div className="heritage-service-planner__editor-empty"><h2>{draft ? 'Choose a slide on the left' : 'Choose a service to begin'}</h2></div>}
        </main>

        <section className="heritage-service-planner__resources">
          <div className="heritage-service-planner__resource-tabs" role="tablist" aria-label="Resources">
            {(['songs', 'media', 'scripture'] as ResourceTab[]).map(tab => <button key={tab} type="button" role="tab" aria-selected={resourceTab === tab} onClick={() => setResourceTab(tab)}>{tab === 'songs' ? 'Song library' : tab === 'media' ? 'Media' : 'Scripture'}</button>)}
          </div>
          <div className="heritage-service-planner__resource-content">
            {resourceTab === 'songs' ? <>
              <label><span>Reviewed Community song</span><select value={songChoice} onChange={event => setSongChoice(event.target.value)}>{songLibrary.map(song => <option key={song.syncId} value={song.syncId}>{song.title}{song.russianTitle && song.russianTitle !== song.title ? ` / ${song.russianTitle}` : ''}</option>)}</select></label>
              <button className="btn btn--style-primary" type="button" disabled={!draft || busy || !songChoice} onClick={addLibrarySong}>Add song to service</button>
              <small>Adds a service copy. Library lyrics stay unchanged.</small>
            </> : null}
            {resourceTab === 'media' ? <>
              <div><strong>Pictures and videos</strong><small>Media stays private inside this service until its exact revision is opened in SyncShow.</small></div>
              <button className="btn btn--style-primary" type="button" disabled={!draft || uploadingPicture} onClick={() => choosePicture('new')}>{uploadingPicture ? 'Uploading…' : 'Add picture'}</button>
              <button className="btn btn--style-primary" type="button" disabled={!draft || uploadingVideo} onClick={() => { if (videoInput.current) { videoInput.current.value = ''; videoInput.current.click() } }}>{uploadingVideo ? 'Uploading…' : 'Add video'}</button>
              {selected?.kind === 'picture' ? CHANNEL_IDS.map(channelId => <button key={channelId} type="button" disabled={uploadingPicture} onClick={() => choosePicture(channelId)}>Replace {draft?.channels[channelId]?.label || channelId}</button>) : null}
            </> : null}
            {resourceTab === 'scripture' ? <>
              <label><span>Book</span><select ref={bibleBookInput} value={bibleBookId} onChange={event => { setBibleBookId(event.target.value); const chapters = bibleBooks.find(book => book.id === event.target.value)?.chapters || 1; setBibleChapter(current => Math.min(current, chapters)) }}>{bibleBooks.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label>
              <label><span>Chapter</span><input ref={bibleChapterInput} type="number" min={1} max={bibleBooks.find(book => book.id === bibleBookId)?.chapters || 200} value={bibleChapter} onChange={event => setBibleChapter(Number(event.target.value))} /></label>
              <label><span>From</span><input ref={bibleStartVerseInput} type="number" min={1} max={999} value={bibleStartVerse} onChange={event => setBibleStartVerse(Number(event.target.value))} /></label>
              <label><span>To</span><input ref={bibleEndVerseInput} type="number" min={1} max={999} value={bibleEndVerse} onChange={event => setBibleEndVerse(Number(event.target.value))} /></label>
              <button className="btn btn--style-primary" type="button" disabled={!draft || busy || !bibleBookId} onClick={addBiblePassage}>Add reading</button>
            </> : null}
          </div>
          <input ref={pictureInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => pictureChosen(event.target.files?.[0])} />
          <input ref={videoInput} type="file" accept="video/mp4,video/webm,.mp4,.webm" hidden onChange={event => videoChosen(event.target.files?.[0])} />
        </section>
      </div>
    </section>
  )
}
