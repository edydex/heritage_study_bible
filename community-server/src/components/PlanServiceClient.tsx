'use client'
import NumberDraftInput from './NumberDraftInput'
import { groupSermonSections } from './plannerSermonSections'
import { scriptureTranslationScope, scriptureTranslationRequest, hasScriptureEdits, replaceScriptureTranslation } from './plannerScriptureTranslations'
import BibleSourceNotice from './BibleSourceNotice'
import {typographyItemIds} from './plannerTypography'
import { setReadingTemplate } from './readingTemplates'
import { appendBlankSlide, readingOwner } from './plannerReadingGroups'

import { PresentationAccessibility, PresentationAccessibilityControl } from './PresentationAccessibility'
import { insertReusableSlide, extractReusableSlide } from './plannerReusableSlides'
import { importSermonPresentation } from './importSermonPresentation'
import { churchWorkspaceLinks } from '@/lib/churchWorkspaceLinks'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import PassageReferenceInput from './PassageReferenceInput'
import SongPreview from '../../packages/song-text/SongPreview.jsx'
import { workspaceSignInHref } from '../lib/workspaceNavigation'
import serviceCore from '../../packages/service-core/index.js'
import { plannerPreview } from './plannerPreview'
import CanvasSlide, { newCanvasObject } from './CanvasSlide'
import TemplateSlideEditor from './TemplateSlideEditor'
import MoveSlidesDialog from './MoveSlidesDialog'
import DeleteSlidesDialog from './DeleteSlidesDialog'
import ScriptureEditionDialog from './ScriptureEditionDialog'
import SlideSettingsDialog from './SlideSettingsDialog'
import SlideText from './SlideText'
import PreviewCanvas from './PreviewCanvas'
import ServicePreview from './ServicePreview'
import formatting from '../../packages/service-core/node/services/project/SlideFormatting.js'
import typography from '../../packages/service-core/node/services/project/SlideTypography.js'
import { SERMON_TEMPLATES, createTemplateDraft, editTemplateField, editCanvasObjects, insertionPoint, type SermonTemplateId } from './plannerTemplates'
import { addReadingTitle, preparePlannerPresentation } from './plannerPresentation'
import { editablePreviewBlock, editPlannerSlide, isSongTitleSlide, plannerSlides, setSlideTranslationCue, translationActionForSlide, type PlannerSlide } from './plannerSlides'
import { changePlannerSelection, plannerClickSelection, selectedPlannerSlides, type SelectionResult } from './plannerSelection'
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
  previewSections?: { language: string; label: string; lines: string[] }[]
}
type BibleBookOption = {
  id: string
  name: string
  chapters: number
}
type PictureUploadTarget = 'new' | 'all' | 'background' | 'canvas' | ChannelId
type ResourceTab = 'songs' | 'media' | 'scripture' | 'templates'

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
  if (item.kind === 'bible') return ['wotbc-reading', 'wotbc-sermon-scripture', 'wotbc-sermon-verse', 'scripture-large', 'scripture-text']
  if (item.kind === 'sermon') return ['wotbc-sermon-title', 'wotbc-sermon', 'wotbc-sermon-quote', 'sermon-point', 'sermon-notes']
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
  const newServiceDetails = useRef<HTMLDetailsElement>(null)
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
      if (newServiceDetails.current) newServiceDetails.current.open = false
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <details ref={newServiceDetails} className="heritage-service-planner__new">
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

export default function PlanServiceClient({ sermonSyncId, onDirtyChange, sidebarHeader }: { sermonSyncId?: string; onDirtyChange?: (dirty: boolean) => void; sidebarHeader?: ReactNode } = {}) {
  const [summaries, setSummaries] = useState<ServiceSummary[]>([])
  const [envelope, setEnvelope] = useState<ServiceEnvelope | null>(null)
  const [editionChange, setEditionChange] = useState<{channel:'english'|'russian';translationId:string} | null>(null)
  const [draft, setDraft] = useState<ServiceProject | null>(null)
  const latestDraft = useRef(draft)
  latestDraft.current = draft
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [desiredStatus, setDesiredStatus] = useState<ServiceEnvelope['status']>('planning')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reusableSlides,setReusableSlides] = useState<any[]>([])
  const [templateName,setTemplateName] = useState('')
  const [templateAutoStart,setTemplateAutoStart] = useState(false)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [songLibrary, setSongLibrary] = useState<SongLibraryOption[]>([])
  const [songChoice, setSongChoice] = useState('')
  const [songQuery, setSongQuery] = useState('')
  const [sermonLibrary, setSermonLibrary] = useState<any[]>([])
  const [sermonChoice, setSermonChoice] = useState('')
  const [bibleBooks, setBibleBooks] = useState<BibleBookOption[]>([])
  const [bibleTranslations, setBibleTranslations] = useState<{ id: string; name: string; language: string }[]>([{ id: 'BSB', name: 'Berean Standard Bible', language: 'en' }, { id: 'SYNO-W', name: 'Russian Synodal Bible', language: 'ru' }])
  const [bibleEnglish, setBibleEnglish] = useState('BSB')
  const [bibleRussian, setBibleRussian] = useState('SYNO-W')
  const [bibleBookId, setBibleBookId] = useState('Eph')
  const [bibleChapter, setBibleChapter] = useState(3)
  const [bibleStartVerse, setBibleStartVerse] = useState(14)
  const [bibleEndVerse, setBibleEndVerse] = useState(21)
  const [referenceKey, setReferenceKey] = useState(0)
  const [referenceValid, setReferenceValid] = useState(true)
  const [bibleVerseNumbers, setBibleVerseNumbers] = useState<number[] | undefined>()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteRef = useRef<HTMLElement>(null)
  const addSlideRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (paletteOpen) paletteRef.current?.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true], button')?.focus()
  }, [paletteOpen])
  const closePalette = () => { setPaletteOpen(false); addSlideRef.current?.focus() }
  const [readingTemplate, setReadingTemplateChoice] = useState('centered')
  const [alignmentRole, setAlignmentRole] = useState('bodyAlign')
  const [resourceTab, setResourceTab] = useState<ResourceTab>(sermonSyncId ? 'templates' : 'songs')
  const [sermonPassage, setSermonPassage] = useState(false)
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, string>>({})
  const localUrls = useRef<string[]>([])
  useEffect(() => () => localUrls.current.forEach(url => URL.revokeObjectURL(url)), [])
  const [previewChannel, setPreviewChannel] = useState<ChannelId>('english')
  const [servicePreviewOpen, setServicePreviewOpen] = useState(false)
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0)
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
  const rangeAnchor = useRef<string | null>(null)
  const [menu, setMenu] = useState<{ row: PlannerSlide; ids: string[]; x: number; y: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moveDialog, setMoveDialog] = useState<string[] | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<string[] | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null)
  const dragged = useRef<string[] | null>(null)
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
  const canvasPictureTarget = useRef<{itemId:string;channelId:string} | null>(null)
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
  const scriptureScope = draft && selectedId ? scriptureTranslationScope(draft, selectedId) : null
  const selectedSlides = slideList.rows.filter(row => row.itemId === selectedId && row.cue)
  const activePreviewIndex = Math.min(previewSlideIndex, Math.max(0, selectedSlides.length - 1))
  const activeSlide = selectedSlides[activePreviewIndex]
  const activePreviewCue = activeSlide?.cue
  const preview = plannerPreview(slideList.rows, activeSlide, previewChannel)
  const activePreviewOutput = preview.output
  const selectionIds = selectedRowIds.filter(id => slideList.rows.some(row => row.id === id))
  if (!selectionIds.length && (activeSlide || selected?.kind === 'group')) selectionIds.push(activeSlide?.id || selected!.id)
  const batchSlides = selectedPlannerSlides(slideList.rows, selectionIds)
  useEffect(() => {
    const handleUndo = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'z' || event.isComposing || event.defaultPrevented) return
      const target = event.target instanceof HTMLElement ? event.target : null
      // Native editing owns its undo history until the edit is committed.
      if (target?.isContentEditable || target?.closest('input,textarea,[contenteditable="true"],[role="textbox"]')) return
      if (!undoStack.length || busy || servicePreviewOpen) return
      event.preventDefault(); undo()
    }
    document.addEventListener('keydown', handleUndo)
    return () => document.removeEventListener('keydown', handleUndo)
  }, [undoStack, busy, servicePreviewOpen, activeSlide?.id])
  const selectedKeys = new Set([...selectionIds, ...batchSlides.map(row => row.id)])
  const dialogSlides = selectedPlannerSlides(slideList.rows, moveDialog || [])
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) workspaceMenuRef.current.open = false
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return
    const element = menuRef.current
    const position = () => {
      const bounds = element.getBoundingClientRect()
      element.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - bounds.width - 8))}px`
      element.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - bounds.height - 8))}px`
    }
    position()
    element.querySelector<HTMLButtonElement>('button')?.focus({preventScroll: true})
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', position)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); window.removeEventListener('resize', position) }
  }, [menu])
  const selectedSermonDocumentId = sermonDocumentIdForItem(draft, selected)
  const selectedSongContentChannels = selected?.kind === 'song'
    ? CHANNEL_IDS.filter(channelId => selected.variants?.[channelId]?.mode === 'content')
    : []

  async function loadList(initial = false) {
    if (sermonSyncId) return
    setBusy(true)
    setError(null)
    try {
      const result = await jsonRequest(ENDPOINT)
      setSummaries(result.items || [])
    } catch (caught) {
      setError(errorText(caught))
      // Only initial entry may navigate away. An expired session while editing
      // must leave the unsaved service on screen for the operator to recover.
      if (initial && (caught as { status?: number })?.status === 401) {
        window.location.replace(workspaceSignInHref('/admin/plan-service'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function loadLibraries() {
    try {
      const [songs, bible, sermons, slides] = await Promise.all([
        jsonRequest(`${ENDPOINT}/library/songs`),
        jsonRequest(`${ENDPOINT}/library/bible-passage`),
        jsonRequest('/api/community/sermon-presentations'),
        jsonRequest(`${ENDPOINT}/library/slides`),
      ])
      const nextSongs = songs.items || []
      setSongLibrary(nextSongs)
      setSongChoice(current => current || nextSongs[0]?.syncId || '')
      setBibleBooks(bible.books || [])
      if (bible.translations?.length) setBibleTranslations(bible.translations)
      setSermonLibrary(sermons.items || [])
      setReusableSlides(slides.items || [])
      setSermonChoice(current => current || sermons.items?.[0]?.syncId || '')
    } catch (caught) {
      setError(errorText(caught))
    }
  }

  function useEnvelope(next: ServiceEnvelopeInput, keepSelection = false) {
    const project = projectFromServiceEnvelope(next) as ServiceProject
    const prepared = preparePlannerPresentation(project, {paginateItemIds: new Set()})
    const normalized = { ...next, project } as ServiceEnvelope
    setEnvelope(normalized)
    setDraft(cloneProject(prepared.project as ServiceProject))
    const retained = keepSelection && selectedId && prepared.project.items[selectedId]
    setSelectedId(retained ? selectedId : plannerSlides(prepared.project).find(row => row.cue)?.itemId || null)
    setPreviewSlideIndex(retained ? previewSlideIndex : 0)
    setUndoStack([])
    setMenu(null)
    setSelectedRowIds([])
    rangeAnchor.current = null
    setMoveDialog(null)
    setDeleteDialog(null)
    setDesiredStatus(next.status)
    setDirty(prepared.changed)
    setError(null)
    setNotice(prepared.changed
      ? 'Section grouping and presentation layout updated. Save service to keep these changes.'
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
    if (sermonSyncId) {
      setBusy(true)
      jsonRequest(`/api/community/sermon-presentations/${encodeURIComponent(sermonSyncId)}`, { method: 'POST' })
        .then(result => useEnvelope(result.serviceDocument))
        .catch(error => setError(errorText(error))).finally(() => setBusy(false))
    } else loadList(true)
    loadLibraries()
  }, [])

  useEffect(() => { onDirtyChange?.(dirty || desiredStatus !== envelope?.status) }, [dirty, desiredStatus, envelope?.status, onDirtyChange])

  function addReusable(template:any) {
    if(!draft)return
    try {
      const result=insertReusableSlide(draft,template.documentSource,selectedId)
      const deck=serviceCore.parseHeritageServiceDocumentSource(template.documentSource).project
      setMediaPreviews(value=>({...value,...Object.fromEntries(Object.keys(deck.assets).map(id=>[id,`${ENDPOINT}/library/slides/${template.id}/assets/${encodeURIComponent(id)}`]))}))
      acceptCoreProject(result.project,result.selectedId,'Slide copied into this service. Save when ready.')
    } catch(error) {setError(errorText(error))}
  }
  async function saveReusable() {
    if(!draft || !selected)return
    try {
      const result=await jsonRequest(`${ENDPOINT}/library/slides/slide-${crypto.randomUUID()}`,{method:'PUT',body:JSON.stringify({title:templateName || selected.title,autoStart:templateAutoStart,documentSource:extractReusableSlide(draft,selected.id)})})
      setReusableSlides(result.items);setTemplateName('');setTemplateAutoStart(false);setNotice('Saved in Media for future services.')
    } catch(error) {setError(errorText(error))}
  }
  async function removeReusable(id:string) {
    try { const result=await jsonRequest(`${ENDPOINT}/library/slides/${id}`,{method:'PUT',body:JSON.stringify({remove:true})});setReusableSlides(result.items) } catch(error) {setError(errorText(error))}
  }

  async function addWholeSermon() {
    if (!draft || !sermonChoice || busy) return
    setBusy(true); setError(null)
    try {
      const result = await jsonRequest(`/api/community/sermon-presentations/${encodeURIComponent(sermonChoice)}`)
      if (!result.serviceDocument) throw new Error('This sermon has no saved slides yet. Open Prepare a sermon first.')
      const imported = importSermonPresentation(draft, projectFromServiceEnvelope(result.serviceDocument), result.sermonDocument, selectedId)
      change(project => Object.assign(project, imported.project))
      setSelectedId(plannerSlides(imported.project).find(row => row.cue && !draft.items[row.itemId])?.itemId || imported.selectedId)
      setSelectedRowIds([])
      setNotice('Whole sermon added, including its saved slides and media. Save the service to keep it.')
    } catch (error) { setError(errorText(error)) } finally { setBusy(false) }
  }

  useEffect(() => {
    if (!envelope || (!dirty && desiredStatus === envelope.status)) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty, desiredStatus, envelope?.status])

  function change(mutator: (project: ServiceProject) => void) {
    const current = latestDraft.current
    if (!current) return
    const next = cloneProject(current)
    mutator(next)
    groupSermonSections(next)
    latestDraft.current = next
    setUndoStack(stack => [...stack.slice(-29), current])
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

  function selectSlide(row: PlannerSlide, modifiers: {shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean} = {}) {
    setPaletteOpen(false)
    setSelectedId(row.itemId)
    setPreviewSlideIndex(Math.max(0, row.index))
    setSelectedRowIds(plannerClickSelection(slideList.rows, row, selectionIds, modifiers,
      rangeAnchor.current || activeSlide?.id || row.id))
    if (!modifiers.shiftKey) rangeAnchor.current = row.id
  }

  function slideMutation(operation: () => any, index = activePreviewIndex) {
    if (!draft) return
    try {
      const next = cloneProject(operation() as ServiceProject)
      groupSermonSections(next)
      setUndoStack(stack => [...stack.slice(-29), draft])
      setDraft(cloneProject(next))
      setPreviewSlideIndex(index)
      setDirty(true)
      setDesiredStatus('planning')
      setError(null)
      setNotice('Unsaved changes · Library originals are unchanged.')
    } catch (caught) { setError(errorText(caught)) }
  }

  function applySelection(result: SelectionResult) {
    if (!draft) return
    setUndoStack(stack => [...stack.slice(-29), draft])
    groupSermonSections(result.project)
    setDraft(result.project as ServiceProject)
    setSelectedRowIds(result.selectedIds)
    rangeAnchor.current = result.activeId
    const active = plannerSlides(result.project).find(row => row.id === result.activeId)
    setSelectedId(active?.itemId || null)
    setPreviewSlideIndex(Math.max(0, active?.index || 0))
    setDirty(true); setDesiredStatus('planning'); setError(null)
    setNotice('Unsaved changes · Undo restores the whole operation.')
    setMenu(null); setDropTarget(null); dragged.current = null
  }

  function runSelection(ids: string[], operation: 'move' | 'duplicate' | 'delete', destination?: number) {
    try { applySelection(changePlannerSelection(draft!, ids, operation, destination)) }
    catch (caught) { setError(errorText(caught)); setMenu(null) }
  }

  function removeSelection(ids: string[]) {
    setMenu(null)
    setDeleteDialog(ids)
  }

  function dropSelection(ids: string[], target: PlannerSlide, after: boolean) {
    const chosen = new Set(selectedPlannerSlides(slideList.rows, ids).map(row => row.id))
    if (chosen.has(target.id) || ids.includes(target.id)) return
    const all = slideList.rows.filter(row => row.cue)
    const children = selectedPlannerSlides(slideList.rows, plannerClickSelection(slideList.rows, target))
    const boundary = children.length ? (after ? children.at(-1)!.number : children[0].number - 1)
      : slideList.rows.slice(0, slideList.rows.indexOf(target)).filter(row => row.cue).length
    runSelection(ids, 'move', all.slice(0, boundary).filter(row => !chosen.has(row.id)).length + 1)
  }

  function undo() {
    const previous = undoStack.at(-1)
    if (!previous) return
    setDraft(previous)
    const rows = plannerSlides(previous).filter(row => row.cue)
    const focus = rows[Math.min(Math.max(0, (activeSlide?.number || 1) - 1), rows.length - 1)]
    setSelectedRowIds(focus ? [focus.id] : [])
    setSelectedId(focus?.itemId || null)
    setPreviewSlideIndex(focus?.index || 0)
    rangeAnchor.current = focus?.id || null
    setUndoStack(stack => stack.slice(0, -1))
    setDirty(true)
    setDesiredStatus('planning')
    setError(null)
    setNotice('Change undone. Save when ready.')
  }

  function add(kind: 'group' | 'blank') {
    if (!draft) return
    setSelectedRowIds([])
    const now = new Date().toISOString()
    const id = `${kind}-${uuid()}`
    const { parentId, index } = insertionPoint(draft, selectedId, kind === 'blank')
    change(project => {
      const common = {
        id,
        kind,
        title: kind === 'group' ? 'Section' : 'Blank',
        operatorNotes: '',
        createdAt: now,
        updatedAt: now,
      }
      project.items[id] = kind === 'group'
        ? { ...common, groupKind: 'section', childIds: [] }
        : { ...common, channelIds: [...project.channelIds], presetId: 'blank-black' }
      if (parentId) project.items[parentId].childIds.splice(index, 0, id)
      else project.rootItemIds.splice(index, 0, id)
    })
    setPaletteOpen(false)
    setSelectedId(id)
    setPreviewSlideIndex(0)
  }

  function acceptCoreProject(project: ServiceProject, itemId: string, message: string) {
    setPaletteOpen(false)
    setSelectedRowIds([])
    if (draft) setUndoStack(stack => [...stack.slice(-29), draft])
    const prepared = preparePlannerPresentation(project, {paginateItemIds: new Set(Object.keys(project.items).filter(id => !draft?.items[id]))}).project as ServiceProject
    setDraft(cloneProject(prepared))
    setSelectedId(prepared.items[itemId]?.kind === 'group' ? prepared.items[itemId].childIds[0] || itemId : itemId)
    setPreviewSlideIndex(0)
    setDesiredStatus('planning')
    setDirty(true)
    setError(null)
    setNotice(message)
  }

  function addTemplate(template: Exclude<SermonTemplateId, 'passage'>) {
    if (!draft) return
    try {
      const id = `sermon-${uuid()}`
      const next = createTemplateDraft(draft, { id, template, selectedId })
      acceptCoreProject(next as ServiceProject, id, 'Slide added. Click the placeholders on the slide to edit; guides are never projected.')
      if (previewChannel === 'media') setPreviewChannel('english')
    } catch (caught) { setError(errorText(caught)) }
  }

  async function rememberSongLayout() {
    if(!selected || !draft || selected.kind!=='song')return
    const resourceId=Object.values(selected.variants as Record<string,any>).find((value:any)=>value.mode==='content')?.resourceId
    const syncId=draft.resources[resourceId]?.origin?.itemId
    if(!syncId){setError('This song is not linked to a Community library record.');return}
    setBusy(true)
    try {
      const lyric=slideList.rows.find(row=>row.itemId===selected.id && row.cue?.presetId?.includes('lyrics') || row.itemId===selected.id && row.cue?.presetId==='wotbc-song-stacked')
      const style={...selected.textStyle,...(lyric?.cue?.textStyle?.bodySize ? {bodySize:lyric.cue.textStyle.bodySize} : {})}
      await jsonRequest(`${ENDPOINT}/library/songs/${encodeURIComponent(syncId)}/layout`,{method:'POST',body:JSON.stringify(style)})
      setNotice('Song layout saved. New services will reuse this size and alignment.')
    } catch(caught){setError(errorText(caught))} finally{setBusy(false)}
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
      const primary = (librarySong.defaultSongLanguage === 'en' ? english : russian) || english || russian || pinned[0]
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
        ...(librarySong.projectionStyle ? {textStyle:librarySong.projectionStyle} : {}),
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
        songPresentation: { stackedTranslation: Boolean(alignedEnglish && alignedRussian && alignedEnglish.resourceId !== alignedRussian.resourceId), primaryChannelId,
          secondaryChannelId: alignedEnglish && alignedRussian ? (primaryChannelId === 'english' ? 'russian' : 'english') : null,
          credits: [...new Set(pinned.flatMap((value:any) => [...(value.document.authors || []), ...(value.document.composers || []), ...(value.document.translators || [])]))].join(' / ').slice(0,500) },
        titlePresetId: 'wotbc-song-title',
        lyricsPresetId: alignedEnglish && alignedRussian ? 'wotbc-song-stacked' : 'wotbc-song-lyrics',
      }, {
        ...insertionPoint(draft, selectedId, false, true),
        now: new Date().toISOString(),
      })
      const singersSourceChannelId = primaryChannelId
      project = serviceCore.setSongChannelTreatment(project, {
        itemId,
        channelId: 'media',
        mode: 'derive-next-text',
        sourceChannelId: singersSourceChannelId,
        now: new Date().toISOString(),
      })
      project = appendBlankSlide(project, itemId)
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

  async function changeScriptureTranslation(channel: 'english' | 'russian', translationId: string, replaceEdits = false) {
    if (!draft || !scriptureScope || busy || !translationId) return
    if (!replaceEdits && hasScriptureEdits(draft, scriptureScope, channel)) {
      setEditionChange({channel,translationId}); return
    }
    const original = draft, scope = scriptureScope
    setBusy(true); setError(null); setNotice('Fetching the selected Bible translation…')
    try {
      const response = await jsonRequest(`${ENDPOINT}/library/bible-passage`, {
        method:'POST', body:JSON.stringify(scriptureTranslationRequest(original, scope, translationId)),
      })
      if (latestDraft.current !== original) throw new Error('The service changed while the translation was loading. Please choose the translation again.')
      const next = replaceScriptureTranslation(original, scope, {channel, translationId,
        translationName:bibleTranslations.find(value=>value.id===translationId)?.name || translationId,
        passage:response.passage.passagesByChannel.english, sourceUrl:response.passage.sources.english})
      slideMutation(() => next)
      setNotice('Translation updated for this passage. Verse selection and slide breaks are preserved. Save when ready; Undo restores the previous text.')
    } catch (caught) { setError(errorText(caught)); setNotice('Translation unchanged.') }
    finally { setBusy(false) }
  }

  const scriptureTranslationControls = scriptureScope && draft ? <fieldset className="heritage-scripture-editions" disabled={busy}>
    <legend>Bible translation</legend>
    {(['english','russian'] as const).map(channel => {
      const editions = [...new Set(scriptureScope.itemIds.map(id=>draft.items[id].passagesByChannel[channel]?.translationId))]
      const value = editions.length === 1 ? editions[0] || '' : ''
      return <label key={channel}>{channel === 'english' ? 'English screen' : 'Russian / stage screen'}
        <select aria-label={`Change ${channel} Scripture translation`} value={value} onChange={event=>void changeScriptureTranslation(channel,event.target.value)}>
          {!value && <option value="" disabled>Mixed translations</option>}
          {value && !bibleTranslations.some(translation=>translation.id===value) && <option value={value}>{value}</option>}
          {bibleTranslations.map(translation=><option key={translation.id} value={translation.id}>{translation.id} · {translation.name}</option>)}
        </select>
      </label>
    })}
    <small>{scriptureScope.itemIds.length > 1 ? 'Changes every page of this passage.' : 'Changes this passage.'} Other passages stay unchanged.</small>
  </fieldset> : null

  async function addBiblePassage() {
    if (!draft || busy || !referenceValid) return
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
          ...(bibleVerseNumbers ? {verseNumbers: bibleVerseNumbers} : {}),
          translations: { english: bibleEnglish, russian: bibleRussian },
        }),
      })
      const passage = response.passage
      const itemId = `bible-${uuid()}`
      let project = serviceCore.addBibleItem(draft, {
        id: itemId,
        title: `${passage.title} · ${passage.passagesByChannel.english.translationId} / ${passage.passagesByChannel.russian.translationId}`,
        range: passage.range,
        ...(passage.verseNumbers ? {verseNumbers: passage.verseNumbers} : {}),
        passagesByChannel: passage.passagesByChannel,
        presetId: sermonPassage ? 'wotbc-sermon-scripture' : 'wotbc-reading',
        operatorNotes: `Exact Bible text and attribution pinned from the selected editions.\nEnglish source: ${passage.sources.english}\nRussian source: ${passage.sources.russian}`,
        ...insertionPoint(draft, selectedId, false, !sermonPassage),
        now: new Date().toISOString(),
      })
      if (!sermonPassage) project = addReadingTitle(project, itemId, { english: bibleTranslations.find(value=>value.id===bibleEnglish)?.name || bibleEnglish, russian: bibleTranslations.find(value=>value.id===bibleRussian)?.name || bibleRussian })
      if (!sermonPassage && readingTemplate === 'pre-sermon') project = setReadingTemplate(project, `${itemId}-title`, 'pre-sermon')
      project = appendBlankSlide(project, sermonPassage ? itemId : `${itemId}-reading`)
      acceptCoreProject(
        project,
        sermonPassage ? itemId : `${itemId}-title`,
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
    canvasPictureTarget.current = target === 'canvas' && selectedId ? {itemId:selectedId,channelId:previewChannel} : null
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
    const target = pictureTarget.current
    const canvasTarget = canvasPictureTarget.current
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
      const previewUrl = URL.createObjectURL(file); localUrls.current.push(previewUrl); setMediaPreviews(value => ({ ...value, [asset.id]: previewUrl }))
      if (target === 'canvas' && canvasTarget) {
        change(project => {
          const item = project.items[canvasTarget.itemId]
          if (item?.sermonTemplate !== 'other') throw new Error('The target slide is no longer available.')
          project.assets[asset.id] = asset
          const objects = [...(item.objectsByChannel[canvasTarget.channelId] || []), newCanvasObject('image', {assetId:asset.id,altText:file.name})]
          const updated = editCanvasObjects(project, canvasTarget.itemId, canvasTarget.channelId, objects)
          project.items[canvasTarget.itemId] = updated.items[canvasTarget.itemId]
        })
      } else if (target === 'new') {
        const id = `picture-${uuid()}`
        const { parentId, index } = insertionPoint(draft, selectedId)
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
          if (parentId) project.items[parentId].childIds.splice(index, 0, id)
          else project.rootItemIds.splice(index, 0, id)
        })
        setSelectedId(id)
        setSelectedRowIds([])
        rangeAnchor.current = null
      } else if (target === 'background' && selected?.kind === 'sermon') {
        change(project => { project.assets[asset.id] = asset; const item = project.items[selected.id]; item.backgroundAssetIdsByChannel = { ...item.backgroundAssetIdsByChannel, [previewChannel]: asset.id }; if (previewChannel === 'russian') item.backgroundAssetIdsByChannel.media = asset.id })
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
      const { parentId, index } = insertionPoint(draft, selectedId)
      const previewUrl = URL.createObjectURL(file); localUrls.current.push(previewUrl); setMediaPreviews(value => ({ ...value, [asset.id]: previewUrl }))
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
        if (parentId) project.items[parentId].childIds.splice(index, 0, id)
        else project.rootItemIds.splice(index, 0, id)
      })
      setSelectedId(id)
      setSelectedRowIds([])
      rangeAnchor.current = null
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
      useEnvelope(response.serviceDocument, true)
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
    <PresentationAccessibility><section className="heritage-service-planner">
      {servicePreviewOpen && draft ? <ServicePreview project={draft} rows={slideList.rows} initialSlideId={activeSlide?.id} initialChannel={previewChannel} dirty={dirty}
        mediaUrl={assetId=>mediaPreviews[assetId] || (envelope?.project.assets?.[assetId] ? `${ENDPOINT}/${encodeURIComponent(envelope.syncId)}/assets/${encodeURIComponent(assetId)}` : undefined)}
        onClose={row=>{setServicePreviewOpen(false);if(row) selectSlide(row)}} /> : null}
      {error ? <p className="heritage-service-planner__error" role="alert">{error}</p> : null}

      <div className="heritage-service-planner__shell">
        <aside className="heritage-service-planner__navigation">
          {sidebarHeader}
          <div className="heritage-service-planner__toolbar">
            <details ref={workspaceMenuRef} className="heritage-service-planner__app-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
              <summary aria-label="Workspace menu" title="Workspace menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></summary>
              <nav aria-label="Church workspace">
                <strong>Church workspace</strong>
                {churchWorkspaceLinks.filter(item => item.href !== (sermonSyncId ? '/admin/prepare-sermon' : '/admin/plan-service')).map(item =>
                <a key={item.href} href={item.href}>{item.label}</a>)}
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
            <button type="button" aria-label={sermonSyncId ? 'Save sermon slides' : 'Save service'} title={!draft ? 'Open a service to save' : busy ? 'Saving…' : dirty || desiredStatus !== envelope?.status ? 'Save service · unsaved changes' : `Saved · v${envelope?.syncVersion || ''}`}
              disabled={!draft || busy || (!dirty && desiredStatus === envelope?.status)} onClick={save}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l4 4v14H3V3h2zm2 0v7h10V3M7 21v-7h10v7" /></svg>
            </button>
          </div>
          <p className="heritage-service-planner__save-state" aria-live="polite" title={notice}>{draft ? `${slideList.rows.filter(row => row.cue).length} slides · ${busy ? 'Working…' : dirty || desiredStatus !== envelope?.status ? 'Unsaved changes' : `Saved v${envelope?.syncVersion}`}` : notice}</p>
          {!sermonSyncId && <>
          <div className="heritage-service-planner__service-picker">
            <label>
              <span>Current service</span>
              <select value={envelope?.syncId || ''} disabled={busy} onChange={event => openService(event.target.value)}>
                <option value="" disabled>Choose a service…</option>
                {summaries.map(summary => <option key={summary.syncId} value={summary.syncId}>{summary.serviceDate} · {summary.title}</option>)}
              </select>
            </label>
            <button type="button" aria-label="Refresh services" disabled={busy} onClick={() => void loadList()}>↻</button>
          </div>
          <NewService onCreated={useEnvelope} onCopy={draft && !busy ? copyService : undefined} />
          {envelope && (dirty || busy || desiredStatus !== envelope.status
            ? <p className="heritage-service-planner__save-state">Save this service to open translation settings.</p>
            : <p><a href={`/admin/live-translation?service=${encodeURIComponent(envelope.syncId)}`} target="_blank" rel="noopener noreferrer">Translation settings ↗</a></p>)}

          </>}

          <PresentationAccessibilityControl item={selected} />
          <div className="heritage-service-planner__outline-heading">
            <h2>{sermonSyncId ? 'Sermon slides' : 'Service order'}</h2><button type="button" className="heritage-add-slide" ref={addSlideRef} disabled={!draft} aria-expanded={paletteOpen} onClick={()=>setPaletteOpen(true)}>＋ Add slide</button>
            <small aria-live="polite">{batchSlides.length > 1 ? `${batchSlides.length} selected` : 'Title: whole section · Ctrl/⌘: title only'}</small>
          </div>

          {draft ? <ol className="heritage-service-planner__rows">
            {slideList.rows.map(row => {
              const rowSelected = selectedKeys.has(row.id)
              const openMenu = (x: number, y: number) => {
                const ids = rowSelected ? selectionIds : plannerClickSelection(slideList.rows, row)
                if (!rowSelected) selectSlide(row)
                setMenu({ row, ids, x, y })
              }
              return <li key={row.id} style={{ '--service-depth': row.depth } as React.CSSProperties}
                data-drop={dropTarget?.id === row.id ? (dropTarget.after ? 'after' : 'before') : undefined}>
                <button className="heritage-service-planner__row" data-kind={row.kind}
                  data-slide-id={row.id} data-selected={rowSelected || undefined} aria-pressed={rowSelected}
                  data-active={activeSlide?.id === row.id || undefined}
                  type="button" draggable title={`${row.title} · Click title for whole section · Ctrl/⌘-click for title only · Shift-click for range · Right-click for actions`}
                  onClick={event => selectSlide(row, event)}
                  onContextMenu={event => { event.preventDefault(); openMenu(event.clientX, event.clientY) }}
                  onKeyDown={event => {
                    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                      event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(rect.left, rect.bottom)
                    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
                      event.preventDefault(); setSelectedRowIds(slideList.rows.filter(value => value.cue).map(value => value.id))
                    } else if (event.key === 'Delete' || event.key === 'Backspace') {
                      event.preventDefault(); removeSelection(rowSelected ? selectionIds : plannerClickSelection(slideList.rows, row))
                    } else if (event.shiftKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
                      const numbered = slideList.rows.filter(value => value.cue)
                      const target = numbered[numbered.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)]
                      if (target) {
                        event.preventDefault(); selectSlide(target, { shiftKey: true })
                        event.currentTarget.closest('ol')?.querySelector<HTMLButtonElement>(`[data-slide-id="${CSS.escape(target.id)}"]`)?.focus()
                      }
                    }
                  }}
                  onDragStart={event => { dragged.current = rowSelected ? selectionIds : plannerClickSelection(slideList.rows, row); if (!rowSelected) selectSlide(row); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.id); setMenu(null) }}
                  onDragEnd={() => { dragged.current = null; setDropTarget(null) }}
                  onDragOver={event => { if (!dragged.current) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; const rect = event.currentTarget.getBoundingClientRect(); setDropTarget({ id: row.id, after: event.clientY > rect.top + rect.height / 2 }) }}
                  onDrop={event => { event.preventDefault(); if (dragged.current) dropSelection(dragged.current, row, Boolean(dropTarget?.after)) }}>
                  <span className="heritage-service-planner__kind" aria-hidden="true">{row.kind === 'group' ? '▾' : row.number}</span>
                  <span><strong>{row.title}</strong>{row.cue?.translationAction ? <small className="heritage-service-planner__translation-cue">{row.cue.translationAction === 'start' ? '▶ Start Translate' : '■ Stop Translate'}</small> : null}{row.kind === 'group' ? <small>section</small> : isSongTitleSlide(row) ? <small>song</small> : row.readingTitle ? <small>reading</small> : row.sermonTitle ? <small>sermon</small> : null}</span>
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
            <small>{selectedPlannerSlides(slideList.rows, menu.ids).length > 1 ? `${selectedPlannerSlides(slideList.rows, menu.ids).length} selected slides` : menu.row.kind === 'group' ? 'Section' : `Slide ${menu.row.number}`}</small>
            <button type="button" role="menuitem" onClick={() => { selectSlide(menu.row); setMenu(null); setSettingsOpen(true) }}>Slide settings…</button>
            {menu.row.kind === 'bible' && draft && draft.items[menu.row.itemId]?.passagesByChannel?.[previewChannel]?.displayText !== undefined ? <button type="button" role="menuitem" onClick={() => {
              const next = cloneProject(draft), item = next.items[menu.row.itemId]
              for (const output of previewChannel === 'russian' && item.passagesByChannel.media ? ['russian','media'] : [previewChannel]) { delete item.passagesByChannel[output].displayText; delete item.passagesByChannel[output].displaySpans }
              slideMutation(() => serviceCore.normalizeServiceProject(next)); setMenu(null)
            }}>Restore original passage text</button> : null}
            {menu.row.cue && draft ? <>
              <button type="button" role="menuitem" onClick={() => {
                const action = translationActionForSlide(slideList.rows, menu.row)
                slideMutation(() => setSlideTranslationCue(draft, menu.row, action), menu.row.index)
                setMenu(null)
              }}>{menu.row.cue.translationAction ? 'Set' : 'Add'} “{translationActionForSlide(slideList.rows, menu.row) === 'start' ? 'Start Translate' : 'Stop Translate'}” Cue</button>
              {menu.row.cue.translationAction ? <button type="button" role="menuitem" onClick={() => { slideMutation(() => setSlideTranslationCue(draft, menu.row, null), menu.row.index); setMenu(null) }}>Remove translation cue</button> : null}
            </> : null}
            <button type="button" role="menuitem" onClick={() => runSelection(menu.ids, 'duplicate')}>Duplicate</button>
            <button type="button" role="menuitem" onClick={() => { setMoveDialog(menu.ids); setMenu(null) }}>Move To…</button>
            {([-1, 1] as const).map(offset => {
              const chosen = selectedPlannerSlides(slideList.rows, menu.ids)
              const target = (chosen[0]?.number || 1) + offset
              const maximum = slideList.rows.filter(row => row.cue).length - chosen.length + 1
              return <button key={offset} type="button" role="menuitem" disabled={!chosen.length || target < 1 || target > maximum} onClick={() => runSelection(menu.ids, 'move', target)}>Move {offset < 0 ? 'up' : 'down'}</button>
            })}
            <button type="button" role="menuitem" onClick={() => removeSelection(menu.ids)}>Delete</button>
          </div> : null}
        </aside>

        <main className="heritage-service-planner__editor" hidden={paletteOpen}>
          {selected ? <>
            <section className="heritage-service-planner__preview">
              <header className="heritage-service-planner__preview-heading">
                <div className="heritage-service-planner__preview-context">
                  <strong>{activeSlide ? `Slide ${activeSlide.number}` : selected.title}</strong>
                  <span className="heritage-service-planner__preview-title" title={draft?.title}>{draft?.title}</span>
                  <time dateTime={draft?.serviceDate}>{draft?.serviceDate}</time>
                  <span className="heritage-service-planner__preview-divider" aria-hidden="true">|</span>
                  <div className="heritage-service-planner__output-tabs" role="tablist" aria-label="Preview output">
                    <span>Screen:</span>
                    {CHANNEL_IDS.map(channelId => <button key={channelId} type="button" role="tab" aria-selected={previewChannel === channelId} onClick={() => setPreviewChannel(channelId)}>{channelId === 'media' ? 'Stage-Facing Screen' : draft?.channels[channelId]?.label || channelId}</button>)}
                  </div>
                </div>
                <div className="heritage-service-planner__preview-actions">
                  <button type="button" title="Undo (Ctrl+Z / Command+Z)" aria-keyshortcuts="Control+Z Meta+Z" disabled={!undoStack.length || busy} onClick={undo}>Undo</button>
                  <button type="button" className="heritage-service-planner__service-preview-button" disabled={!slideList.rows.some(row=>row.cue) || Boolean(slideList.error)} onClick={()=>setServicePreviewOpen(true)}>▦ {sermonSyncId ? 'Sermon preview' : 'Service Preview'}</button>
                </div>
              </header>
              {activePreviewOutput?.fallbackFromChannelId ? <p className="heritage-service-planner__language-warning" role="status">
                {draft?.channels[previewChannel]?.label || previewChannel} is not configured. Screens will show {draft?.channels[activePreviewOutput.fallbackFromChannelId]?.label || 'the filled language'} content until you add text here.
              </p> : null}
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
              {selected.kind === 'sermon' && (selected.sermonTemplate === 'title' || selected.presetId === 'wotbc-sermon-title') && !preview.singer ? <div className="heritage-service-planner__song-layout">
                <button type="button" disabled={uploadingPicture} onClick={() => choosePicture('background')}>{uploadingPicture ? 'Uploading…' : (selected.backgroundAssetIdsByChannel?.[previewChannel] || selected.backgroundAssetId) ? `Replace ${previewChannel === 'russian' ? 'Russian' : 'English'} image` : `Choose ${previewChannel === 'russian' ? 'Russian' : 'English'} image`}</button>
                <label className="heritage-sermon-title-input">Title<input aria-label={`${previewChannel} title for following passages`} value={selected.titlesByChannel?.[previewChannel] || ''} onChange={event => slideMutation(() => editTemplateField(draft!, selected.id, previewChannel, 'heading', event.target.value, formatting.remapTextSpans(selected.titlesByChannel?.[previewChannel] || '', event.target.value, selected.titleSpansByChannel?.[previewChannel] || [])))} /></label>
                <label><input type="checkbox" checked={selected.sermonPresentation?.showText ?? true} onChange={event => updateSelected({ sermonPresentation: {darkenBackground: true, ...selected.sermonPresentation, showText: event.target.checked} })} /> Show title text</label>
                <label><input type="checkbox" checked={selected.sermonPresentation?.darkenBackground ?? true} onChange={event => updateSelected({ sermonPresentation: {showText: true, ...selected.sermonPresentation, darkenBackground: event.target.checked} })} /> Darken image</label>
              </div> : null}
              <div className="heritage-service-planner__slide-workspace" data-canvas={!preview.singer && selected.kind !== 'group' || undefined}>
              <PreviewCanvas textStyle={activeSlide?.cue?.textStyle} kind={selected.kind} presetId={preview.presetId} template={selected.sermonTemplate} titleCard={Boolean(activeSlide && isSongTitleSlide(activeSlide))} singer={preview.singer} next={preview.next} backgroundDimOpacity={selected.sermonPresentation?.darkenBackground === false ? 0 : 0.55} backgroundUrl={(selected.backgroundAssetIdsByChannel?.[previewChannel] || selected.backgroundAssetId) ? mediaPreviews[selected.backgroundAssetIdsByChannel?.[previewChannel] || selected.backgroundAssetId] || `${ENDPOINT}/${encodeURIComponent(envelope!.syncId)}/assets/${encodeURIComponent(selected.backgroundAssetIdsByChannel?.[previewChannel] || selected.backgroundAssetId)}` : undefined}>
                {selected.kind === 'group' ? <p className="heritage-service-planner__stage-status">Choose a numbered slide on the left.<br />“{selected.title}” is a section, not a slide.</p>
                  : slideList.error ? <p className="heritage-service-planner__stage-status">Preview unavailable: {slideList.error}</p>
                  : selected.sermonTemplate === 'other' && !preview.singer ? <CanvasSlide key={`${selected.id}:${previewChannel}`} objects={selected.objectsByChannel[previewChannel] || []} mediaUrl={id=>mediaPreviews[id] || `${ENDPOINT}/${encodeURIComponent(envelope!.syncId)}/assets/${encodeURIComponent(id)}`} uploading={uploadingPicture} onImage={()=>choosePicture('canvas')} onChange={objects=>slideMutation(()=>editCanvasObjects(draft!,selected.id,previewChannel,objects))} />
                  : selected.sermonTemplate && !preview.singer ? <TemplateSlideEditor key={`${selected.id}:${previewChannel}`} item={selected} inheritedHeading={activePreviewOutput?.blocks?.find((block:any)=>block.type==='text' && block.role==='title')?.text} channelId={previewChannel} uploading={uploadingPicture} onImage={() => choosePicture('background')}
                      onEdit={(field, text, spans) => slideMutation(() => editTemplateField(draft!, selected.id, previewChannel, field, text, spans))} />
                  : activePreviewOutput?.mode === 'hide' ? <p className="heritage-service-planner__stage-status">Hidden on this screen</p>
                    : selected.kind === 'blank' ? <p className="heritage-service-planner__stage-status">Intentional blank screen</p>
                      : (activePreviewOutput?.blocks || []).map((block: any, index: number) => {
                        if (block.type === 'canvas') return <CanvasSlide key={index} objects={block.objects} mediaUrl={id=>mediaPreviews[id] || `${ENDPOINT}/${encodeURIComponent(envelope!.syncId)}/assets/${encodeURIComponent(id)}`} />
                        if (block.type === 'image' && block.role === 'background') return null
                        if (block.type === 'image' || block.type === 'video') {
                          if (!envelope?.project.assets?.[block.assetId] && !mediaPreviews[block.assetId]) return <p key={index} className="heritage-service-planner__stage-status">Save the service to preview this new media file.</p>
                          const source = mediaPreviews[block.assetId] || `${ENDPOINT}/${encodeURIComponent(envelope!.syncId)}/assets/${encodeURIComponent(block.assetId)}`
                          return block.type === 'image'
                            ? <img key={index} src={source} alt={block.altText || selected.title} />
                            : <video key={index} src={source} controls preload="metadata" muted={block.muted} />
                        }
                        if (block.type === 'bible') return <div key={index} className="heritage-service-planner__scripture-page" data-fit-text>
                          <p className="heritage-service-planner__scripture-reference">{block.reference} <small>{block.translationId}</small></p>
                          <SlideText text={formatting.scriptureDisplay(block, preview.presetId).text} spans={formatting.scriptureDisplay(block, preview.presetId).spans} label={`Slide ${activeSlide?.number} ${previewChannel} Scripture — click to edit`} role="body" readOnly={preview.singer} canFormat={!preview.singer}
                            onCommit={(text, spans) => activeSlide && slideMutation(() => editPlannerSlide(draft!, activeSlide, previewChannel, index, text, spans))} />
                          {formatting.scriptureCredit(block) ? <p className="heritage-scripture-credit">{formatting.scriptureCredit(block)}</p> : null}
                        </div>
                        return activeSlide && block.type === 'text'
                          ? <SlideText key={`${activeSlide.id}:${previewChannel}:${index}`} text={previewBlockText(block)} role={block.role}
                              readOnly={preview.singer || !editablePreviewBlock(draft!, activeSlide, previewChannel, block)}
                              spans={block.spans}
                              canFormat={!preview.singer && ['sermon', 'notice'].includes(selected.kind)}
                              label={`Slide ${activeSlide.number} ${selected.kind === 'song' && selected.songPresentation?.stackedTranslation && block.role === 'lyrics'
                                ? (index === 0 ? selected.songPresentation.primaryChannelId : selected.songPresentation.secondaryChannelId) : previewChannel} ${block.role} — click to edit`}
                              onCommit={(text, spans) => slideMutation(() => editPlannerSlide(draft!, activeSlide, previewChannel, index, text, ['sermon','notice'].includes(selected.kind) ? spans : undefined))} />
                          : <p key={index} data-role={block.role || 'scripture'}>{previewBlockText(block)}</p>
                      })}
              </PreviewCanvas>
              {!preview.singer && selected.sermonTemplate !== 'other' && ['song','bible','sermon','notice'].includes(selected.kind) && <aside className="heritage-text-inspector" aria-label="Text layout">
                <h3>Text layout</h3>
                {scriptureTranslationControls}
                {selected.presetId==='wotbc-reading-title' && <label>Reading template<select value="centered" onChange={event=>slideMutation(()=>setReadingTemplate(draft,selected.id,event.target.value))}><option value="centered">Centered title</option><option value="pre-sermon">Pre-sermon</option></select></label>}
                <label>Apply alignment to<select aria-label="Alignment field" value={alignmentRole} onChange={event=>setAlignmentRole(event.target.value)}><option value="bodyAlign">Text</option><option value="titleAlign">Heading</option><option value="creditAlign">Author / source</option></select></label>
                <div role="group" aria-label="Text alignment">{['left','center','right'].map(align=><button type="button" key={align} aria-label={`Align ${align}`} aria-pressed={(selected.textStyle?.[alignmentRole] || typography.textPreset(preview.presetId)[alignmentRole] || (alignmentRole==='creditAlign' && !(activeSlide && isSongTitleSlide(activeSlide)) ? 'right' : 'center'))===align} onClick={()=>change(project=>{
                  const ids=typographyItemIds(project,selected.id)
                  ids.forEach((id:string)=>{project.items[id].textStyle={...project.items[id].textStyle,[alignmentRole]:align}})
                })}>{align[0].toUpperCase()+align.slice(1)}</button>)}</div>
                {!(activeSlide && isSongTitleSlide(activeSlide)) && <label>{selected.kind==='song' ? 'Song font size' : selected.kind==='bible' ? 'Reading font size' : 'Text size'}<NumberDraftInput value={selected.textStyle?.bodySize || activeSlide?.cue?.textStyle?.bodySize || typography.textPreset(preview.presetId).bodySize} min={32} max={160} onCommit={bodySize=>change(project=>{
                  const ids=typographyItemIds(project,selected.id)
                  ids.forEach((id:string)=>{project.items[id].textStyle={...project.items[id].textStyle,bodySize}})
                })} /></label>}
                {selected.textStyle?.bodySize && activeSlide?.cue?.textStyle?.bodySize && selected.textStyle.bodySize !== activeSlide.cue.textStyle.bodySize && <small>Fitted size: {activeSlide.cue.textStyle.bodySize} across all pages.</small>}
                {selected.kind==='song' && <><small>One size for the whole song. Long lines can reduce it by up to 25%.</small><button type="button" disabled={busy} onClick={rememberSongLayout}>Remember for this song</button></>}
                {selected.kind==='bible' && <><small>All pages in this reading use the same size.</small><BibleSourceNotice translationIds={Object.values(selected.passagesByChannel || {}).map((p:any)=>p.translationId)} /></>}
              </aside>}
              {selected.sermonTemplate === 'other' && !preview.singer && <aside className="heritage-canvas-inspector" aria-label="Slide objects">
                {selected.presetId==='wotbc-reading-title' && <label>Reading template<select value="pre-sermon" onChange={event=>slideMutation(()=>setReadingTemplate(draft,selected.id,event.target.value))}><option value="centered">Centered title</option><option value="pre-sermon">Pre-sermon</option></select></label>}
                {scriptureTranslationControls}
                <div id="heritage-canvas-tools" />
                <button type="button" className="heritage-canvas-copy" onClick={()=>{if(globalThis.confirm('Replace the objects on the other outputs with this slide layout?'))updateSelected({objectsByChannel:Object.fromEntries(draft!.channelIds.map(id=>[id,JSON.parse(JSON.stringify(selected.objectsByChannel[previewChannel] || []))]))})}}>Copy layout to all outputs</button>
              </aside>}
              </div>
              <p className="heritage-service-planner__preview-note">{preview.singer
                ? 'Full primary-language slide · Same-size next line, fitted to the available width.'
                : selected.kind === 'bible' ? 'Click Scripture to edit this slide · Add omissions or [context] · Original Bible text is preserved.'
                  : selected.kind === 'song' && selected.songPresentation?.stackedTranslation ? 'Same stack on both audience screens · White primary language, orange translation · Click either to edit.'
                  : selected.kind === 'sermon' ? 'Click directly on the slide to edit · Select text for formatting · Empty guides are not projected.'
                  : selected.kind === 'picture' ? 'Picture slide. Open Add slide → Media to replace its image.'
                    : 'Click the slide text to edit · Click outside to apply · Save to keep changes'}</p>
            </section>
            {selected.objectsByChannel?.[previewChannel]?.some((object: any) => object.id === 'welcome-topic') ?
              <label className="heritage-service-planner__welcome-topic">Service / sermon topic
                <input aria-label="Welcome slide topic" value={selected.objectsByChannel[previewChannel].find((object: any) => object.id === 'welcome-topic')?.text || ''}
                  placeholder={previewChannel === 'english' ? 'Topic for this service' : 'Тема служения'}
                  onChange={event => slideMutation(() => editCanvasObjects(draft, selected.id, previewChannel, selected.objectsByChannel[previewChannel].map((object: any) => object.id === 'welcome-topic' ? { ...object, text: event.target.value, spans: [] } : object)))} />
              </label> : null}


            {settingsOpen && <SlideSettingsDialog onClose={() => { setSettingsOpen(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.heritage-service-planner__rows [data-slide-id="${CSS.escape(activeSlide?.id || selected.id)}"]`)?.focus()) }}>
                <label><span>Item name</span><input value={selected.title} maxLength={200} onChange={event => updateSelected({ title: event.target.value })} /></label>
                <label><span>Notes for the operator</span><input value={selected.operatorNotes || ''} onChange={event => updateSelected({ operatorNotes: event.target.value })} /></label>
                {selected.kind === 'song' && selected.songPresentation ? <label><span>Song credit · bottom right of title slide</span><input aria-label="Song credit" value={selected.songPresentation.credits} maxLength={500}
                  onChange={event => updateSelected({ songPresentation: { ...selected.songPresentation, credits: event.target.value } })} /></label> : null}

            {(selected.backgroundAssetIdsByChannel?.[previewChannel] || selected.backgroundAssetId) ? <button type="button" disabled={uploadingPicture} onClick={() => choosePicture('background')}>Replace title image</button> : null}
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
                {selected.kind === 'bible' ? <p className="heritage-service-planner__boundary">This reading keeps exact translation text and checksums. Use Add slide → Scripture if the passage changes.</p> : null}
                {selectedSermonDocumentId ? <a className="btn btn--style-secondary" href={`/admin/sermon-publications?sermon=${encodeURIComponent(selectedSermonDocumentId)}`}>Open sermon publication review</a> : null}
</SlideSettingsDialog>}

          </> : <div className="heritage-service-planner__editor-empty"><h2>{draft ? 'Choose a slide on the left' : 'Choose a service to begin'}</h2>{undoStack.length ? <button type="button" onClick={undo}>Undo</button> : null}</div>}
        </main>

        <section className="heritage-service-planner__resources" ref={paletteRef} hidden={!paletteOpen} aria-label="Add slide palette" onKeyDown={event=>{if(event.key==='Escape')closePalette()}}>
          <div className="heritage-service-planner__resource-tabs" role="tablist" aria-label="Add slides">
            <strong>Add a slide</strong><button type="button" className="heritage-palette-close" aria-label="Close add slide palette" onClick={()=>setPaletteOpen(false)}>×</button>
            {(['songs', 'media', 'scripture', 'templates'] as ResourceTab[]).map(tab => <button key={tab} type="button" role="tab" aria-selected={resourceTab === tab} onClick={() => { setResourceTab(tab); if (tab === 'scripture') setSermonPassage(false) }}>{tab === 'songs' ? 'Songs' : tab === 'media' ? 'Media' : tab === 'templates' ? 'Sermon' : 'Scripture'}</button>)}
            <details className="heritage-service-planner__add-menu"><summary aria-label="More slide types" title="More slide types">＋</summary><div><button type="button" disabled={!draft} onClick={event => { add('group'); event.currentTarget.closest('details')!.open = false }}>Section divider</button><button type="button" disabled={!draft} onClick={event => { add('blank'); event.currentTarget.closest('details')!.open = false }}>Blank screen</button></div></details>
          </div>
          <div className="heritage-service-planner__resource-content">
            {resourceTab === 'templates' && !sermonSyncId && <div className="heritage-sermon-library"><label>Prepared sermon<select aria-label="Prepared sermon" value={sermonChoice} onChange={event => setSermonChoice(event.target.value)}><option value="">Choose a sermon…</option>{sermonLibrary.map(sermon => <option key={sermon.syncId} value={sermon.syncId}>{sermon.serviceDate} · {sermon.title}</option>)}</select></label><button type="button" disabled={!draft || !sermonChoice || busy} onClick={addWholeSermon}>Add whole sermon</button><small>Newest added first. Copies saved slides, media and notes into this service.</small><a href="/admin/prepare-sermon" target="_blank" rel="noopener noreferrer">Prepare a sermon ↗</a><button type="button" onClick={loadLibraries} disabled={busy}>Refresh sermons</button></div>}
            {resourceTab === 'templates' ? <div className="heritage-service-planner__templates">{SERMON_TEMPLATES.map(value => <button key={value.id} type="button" disabled={!draft} onClick={() => { if (value.id === 'passage') { setResourceTab('scripture'); setSermonPassage(true) } else addTemplate(value.id) }}><span aria-hidden="true">{value.icon}</span><strong>{value.label}</strong><small>{value.hint}</small></button>)}</div> : null}
            {resourceTab === 'songs' ? <>
              <div className="heritage-planner-song-library">
                <label>Find a song<input type="search" value={songQuery} onChange={event => setSongQuery(event.target.value)} placeholder="English or Russian title…" /></label>
                <div className="heritage-planner-song-library__list" role="group" aria-label="Reviewed Community songs">
                  {songLibrary.filter(song => `${song.title} ${song.russianTitle}`.toLocaleLowerCase().includes(songQuery.trim().toLocaleLowerCase())).map(song => <SongPreview key={song.syncId} title={song.title} sections={song.previewSections || []}>
                    <button type="button" aria-pressed={songChoice === song.syncId} onClick={() => setSongChoice(song.syncId)}>{song.title}{song.russianTitle && song.russianTitle !== song.title && <small>{song.russianTitle}</small>}</button>
                  </SongPreview>)}
                </div>
              </div>
              <button className="btn btn--style-primary" type="button" disabled={!draft || busy || !songChoice} onClick={addLibrarySong}>Add song to service</button>
              <small>Adds a service copy. Library lyrics stay unchanged.</small>
            </> : null}
            {resourceTab === 'media' && <button type="button" disabled={!draft || busy} onClick={() => add('blank')}>Blank slide</button>}
            {resourceTab === 'media' ? <>
              {reusableSlides.map(template=><div key={template.id}><button type="button" disabled={!draft} onClick={()=>addReusable(template)}>{template.title}</button>{template.autoStart && <small>Starts every new service</small>}<button type="button" aria-label={`Remove ${template.title} from Media`} onClick={()=>removeReusable(template.id)}>Remove from Media</button></div>)}
              {selected && ['picture','blank','notice','sermon'].includes(selected.kind) && <details><summary>Save selected slide in Media</summary><label>Slide name<input value={templateName} placeholder={selected.title} onChange={event=>setTemplateName(event.target.value)} /></label><label><input type="checkbox" checked={templateAutoStart} onChange={event=>setTemplateAutoStart(event.target.checked)} />Add at the beginning of every new service</label><button type="button" onClick={saveReusable}>Save reusable slide</button></details>}
              <div><strong>Pictures and videos</strong><small>Media stays private inside this service until its exact revision is opened in SyncShow.</small></div>
              <button className="btn btn--style-primary" type="button" disabled={!draft || uploadingPicture} onClick={() => choosePicture('new')}>{uploadingPicture ? 'Uploading…' : 'Add picture'}</button>
              <button className="btn btn--style-primary" type="button" disabled={!draft || uploadingVideo} onClick={() => { if (videoInput.current) { videoInput.current.value = ''; videoInput.current.click() } }}>{uploadingVideo ? 'Uploading…' : 'Add video'}</button>
              {selected?.kind === 'picture' ? CHANNEL_IDS.map(channelId => <button key={channelId} type="button" disabled={uploadingPicture} onClick={() => choosePicture(channelId)}>Replace {draft?.channels[channelId]?.label || channelId}</button>) : null}
            </> : null}
            {resourceTab === 'scripture' ? <>
              {!sermonPassage && <label>Reading title template<select aria-label="Reading title template" value={readingTemplate} onChange={event=>setReadingTemplateChoice(event.target.value)}><option value="centered">Centered reading title</option><option value="pre-sermon">Pre-sermon · passage and service topic</option></select></label>}
              <label><span>English screen translation</span><select aria-label="English screen translation" value={bibleEnglish} onChange={event => setBibleEnglish(event.target.value)}>{bibleTranslations.map(translation => <option key={translation.id} value={translation.id}>{translation.id} · {translation.name}</option>)}</select></label>
              <label><span>Russian / stage screen translation</span><select aria-label="Russian / stage screen translation" value={bibleRussian} onChange={event => setBibleRussian(event.target.value)}>{bibleTranslations.map(translation => <option key={translation.id} value={translation.id}>{translation.id} · {translation.name}</option>)}</select></label>
              <BibleSourceNotice translationIds={[bibleEnglish,bibleRussian]} />
              <PassageReferenceInput key={referenceKey} books={bibleBooks} singleChapter allowVerseList onValidityChange={setReferenceValid} onResolve={passage => { setBibleBookId(passage.bookId); setBibleChapter(passage.startChapter); setBibleStartVerse(passage.startVerse); setBibleEndVerse(passage.endVerse); setBibleVerseNumbers(passage.verseNumbers) }} />
              <details className="heritage-passage-manual"><summary>Choose book and verses</summary><div>
              <label><span>Book</span><select ref={bibleBookInput} value={bibleBookId} onChange={event => { setReferenceKey(key => key + 1); setReferenceValid(true); setBibleVerseNumbers(undefined); setBibleBookId(event.target.value); const chapters = bibleBooks.find(book => book.id === event.target.value)?.chapters || 1; setBibleChapter(current => Math.min(current, chapters)) }}>{bibleBooks.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label>
              <label><span>Chapter</span><input ref={bibleChapterInput} type="number" min={1} max={bibleBooks.find(book => book.id === bibleBookId)?.chapters || 200} value={bibleChapter} onChange={event => { setReferenceKey(key => key + 1); setReferenceValid(true); setBibleVerseNumbers(undefined); setBibleChapter(Number(event.target.value)) } } /></label>
              <label><span>From</span><input ref={bibleStartVerseInput} type="number" min={1} max={999} value={bibleStartVerse} onChange={event => { setReferenceKey(key => key + 1); setReferenceValid(true); setBibleVerseNumbers(undefined); setBibleStartVerse(Number(event.target.value)) } } /></label>
              <label><span>To</span><input ref={bibleEndVerseInput} type="number" min={1} max={999} value={bibleEndVerse} onChange={event => { setReferenceKey(key => key + 1); setReferenceValid(true); setBibleVerseNumbers(undefined); setBibleEndVerse(Number(event.target.value)) } } /></label>
              </div></details>
              <button className="btn btn--style-primary" type="button" disabled={!draft || busy || !bibleBookId || !referenceValid} onClick={addBiblePassage}>{sermonPassage ? 'Add sermon passage' : 'Add reading'}</button>
            </> : null}
          </div>
        </section>
          <input ref={pictureInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => pictureChosen(event.target.files?.[0])} />
          <input ref={videoInput} type="file" accept="video/mp4,video/webm,.mp4,.webm" hidden onChange={event => videoChosen(event.target.files?.[0])} />
          {moveDialog && draft ? <MoveSlidesDialog count={dialogSlides.length} maximum={slideList.rows.filter(row => row.cue).length - dialogSlides.length + 1}
            initial={dialogSlides[0]?.number || 1} onCancel={() => setMoveDialog(null)}
            onMove={number => { applySelection(changePlannerSelection(draft, moveDialog, 'move', number)); setMoveDialog(null) }} /> : null}
          {editionChange && <ScriptureEditionDialog edition={editionChange.translationId}
            output={editionChange.channel === 'english' ? 'English' : 'Russian / stage'} onCancel={()=>setEditionChange(null)}
            onChange={()=>{ const choice=editionChange; setEditionChange(null); void changeScriptureTranslation(choice.channel,choice.translationId,true) }} />}
          {deleteDialog && draft ? <DeleteSlidesDialog count={selectedPlannerSlides(slideList.rows, deleteDialog).length}
            sections={deleteDialog.some(id => slideList.rows.find(row => row.id === id)?.kind === 'group')}
            onCancel={() => setDeleteDialog(null)} onDelete={() => { runSelection(deleteDialog, 'delete'); setDeleteDialog(null) }} /> : null}
      </div>
    </section></PresentationAccessibility>
  )
}
