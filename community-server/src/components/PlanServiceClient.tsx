'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import serviceCore from '../../packages/service-core/index.js'

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
  document: { project: ServiceProject }
  project: ServiceProject
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
type Row = {
  item: ProjectItem
  parentId: string | null
  index: number
  depth: number
}
type PictureUploadTarget = 'new' | 'all' | ChannelId

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

async function uploadServiceImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP picture.')
  }
  if (file.size < 1 || file.size > 75 * 1024 * 1024) {
    throw new Error('Choose a picture no larger than 75 MB.')
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
        : `Picture upload failed (${response.status}).`,
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

function flatten(project: ServiceProject): Row[] {
  const rows: Row[] = []
  const visit = (itemId: string, parentId: string | null, index: number, depth: number) => {
    const item = project.items[itemId]
    if (!item) return
    rows.push({ item, parentId, index, depth })
    if (item.kind === 'group') {
      item.childIds.forEach((childId: string, childIndex: number) =>
        visit(childId, item.id, childIndex, depth + 1))
    }
  }
  project.rootItemIds.forEach((itemId, index) => visit(itemId, null, index, 0))
  return rows
}

function cloneProject(project: ServiceProject): ServiceProject {
  return JSON.parse(JSON.stringify(project)) as ServiceProject
}

function itemPreset(item: ProjectItem) {
  return item.kind === 'song' ? item.lyricsPresetId : item.presetId
}

function presetChoices(item: ProjectItem) {
  if (item.kind === 'song') return ['song-lyrics']
  if (item.kind === 'bible') return ['scripture-text']
  if (item.kind === 'sermon') return ['sermon-point', 'notice-text']
  if (item.kind === 'notice') return ['notice-text', 'sermon-point']
  if (item.kind === 'picture') return ['picture-fullscreen']
  if (item.kind === 'blank') return ['blank-black']
  return []
}

function previewText(item: ProjectItem | null, channelId: string) {
  if (!item) return 'Choose an item to preview it.'
  if (item.kind === 'group') return 'Section heading — not projected'
  if (item.kind === 'sermon' || item.kind === 'notice') {
    return item.textByChannel?.[channelId] || 'Hidden on this output'
  }
  if (item.kind === 'blank') {
    return item.channelIds?.includes(channelId) ? 'Intentional clear screen' : 'Hidden on this output'
  }
  if (item.kind === 'picture') {
    const visible = item.assetIdsByChannel
      ? Boolean(item.assetIdsByChannel[channelId])
      : item.channelIds?.includes(channelId)
    return visible ? item.altText || 'Picture' : 'Hidden on this output'
  }
  if (item.kind === 'song') {
    const variant = item.variants?.[channelId]
    return variant?.mode === 'content'
      ? 'Pinned song lyrics'
      : variant?.mode === 'inherit'
        ? `Uses ${variant.from}`
        : variant?.mode === 'derive'
          ? `Current + next from ${variant.from}`
          : 'Hidden on this output'
  }
  if (item.kind === 'bible') {
    const passage = item.passagesByChannel?.[channelId]
    return passage
      ? `${passage.reference} · ${passage.translationId}\n${(passage.verses || [])
          .slice(0, 3)
          .map((verse: any) => `${verse.number} ${verse.text}`)
          .join(' ')}`
      : 'Hidden on this output'
  }
  return 'Projected content is retained exactly.'
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

function NewService({ onCreated }: { onCreated: (value: ServiceEnvelope) => void }) {
  const [title, setTitle] = useState('Sunday Morning Service')
  const [serviceDate, setServiceDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const response = await jsonRequest(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: 1,
          requestId: uuid(),
          syncId: `service-${serviceDate}`,
          title,
          serviceDate,
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
    <section className="heritage-service-planner__new">
      <label>
        <span>Service title</span>
        <input value={title} maxLength={200} onChange={event => setTitle(event.target.value)} />
      </label>
      <label>
        <span>Service date</span>
        <input type="date" value={serviceDate} onChange={event => setServiceDate(event.target.value)} />
      </label>
      <button className="btn btn--style-primary" type="button" disabled={busy || !title.trim() || !serviceDate} onClick={create}>
        {busy ? 'Creating…' : 'Create shared service'}
      </button>
      {error ? <p className="heritage-service-planner__error" role="alert">{error}</p> : null}
    </section>
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
  const [songLibrary, setSongLibrary] = useState<SongLibraryOption[]>([])
  const [songChoice, setSongChoice] = useState('')
  const [bibleBooks, setBibleBooks] = useState<BibleBookOption[]>([])
  const [bibleBookId, setBibleBookId] = useState('Eph')
  const [bibleChapter, setBibleChapter] = useState(3)
  const [bibleStartVerse, setBibleStartVerse] = useState(14)
  const [bibleEndVerse, setBibleEndVerse] = useState(21)
  const pictureInput = useRef<HTMLInputElement>(null)
  const pictureTarget = useRef<PictureUploadTarget>('new')
  const [notice, setNotice] = useState('Choose a service or create the next one.')
  const rows = useMemo(() => draft ? flatten(draft) : [], [draft])
  const selected = selectedId && draft ? draft.items[selectedId] || null : null
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

  function useEnvelope(next: ServiceEnvelope) {
    setEnvelope(next)
    setDraft(cloneProject(next.project || next.document.project))
    setSelectedId(null)
    setDesiredStatus(next.status)
    setDirty(false)
    setError(null)
    setNotice(`${next.project.title} is open at Community version ${next.syncVersion}.`)
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

  useEffect(() => {
    loadList()
    loadLibraries()
  }, [])

  function change(mutator: (project: ServiceProject) => void) {
    if (!draft) return
    const next = cloneProject(draft)
    mutator(next)
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

  function siblings(row: Row, project: ServiceProject) {
    return row.parentId === null
      ? project.rootItemIds
      : project.items[row.parentId].childIds as string[]
  }

  function move(row: Row, offset: -1 | 1) {
    change(project => {
      const ordered = siblings(row, project)
      const index = ordered.indexOf(row.item.id)
      const target = index + offset
      if (index < 0 || target < 0 || target >= ordered.length) return
      ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    })
  }

  function remove(row: Row) {
    if (!globalThis.confirm(`Remove “${row.item.title}”${row.item.kind === 'group' ? ' and everything inside it' : ''}?`)) return
    change(project => {
      const ordered = siblings(row, project)
      ordered.splice(ordered.indexOf(row.item.id), 1)
      const removeIds: string[] = []
      const collect = (itemId: string) => {
        const item = project.items[itemId]
        if (item?.kind === 'group') item.childIds.forEach(collect)
        removeIds.push(itemId)
      }
      collect(row.item.id)
      removeIds.forEach(itemId => delete project.items[itemId])
    })
    setSelectedId(null)
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
              presetId: kind === 'sermon' ? 'sermon-point' : 'notice-text',
            }
      if (parentId) project.items[parentId].childIds.push(id)
      else project.rootItemIds.push(id)
    })
    setSelectedId(id)
  }

  function acceptCoreProject(project: ServiceProject, itemId: string, message: string) {
    setDraft(cloneProject(project))
    setSelectedId(itemId)
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
        document: serviceCore.parseSongDocument(value.source, {
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
      const itemId = `song-${uuid()}`
      project = serviceCore.addProjectItem(project, {
        id: itemId,
        kind: 'song',
        title: [librarySong.title, librarySong.russianTitle]
          .filter(Boolean)
          .filter((value: string, index: number, values: string[]) => values.indexOf(value) === index)
          .join(' / '),
        operatorNotes: `Pinned from Community song ${librarySong.syncId} v${librarySong.syncVersion}. Rights and access remain manager-controlled.`,
        variants: Object.fromEntries(CHANNEL_IDS.map(channelId => [channelId, {
          mode: 'content',
          resourceId: resourceByChannel[channelId],
        }])),
        arrangement: primary.document.sections.map((section: any) => ({
          id: `arr-${uuid()}`,
          sectionId: section.id,
        })),
        primaryChannelId,
        titlePresetId: 'song-title',
        lyricsPresetId: 'song-lyrics',
      }, {
        parentId: selected?.kind === 'group' ? selected.id : null,
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
    setBusy(true)
    setError(null)
    try {
      const response = await jsonRequest(`${ENDPOINT}/library/bible-passage`, {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: 1,
          bookId: bibleBookId,
          chapter: bibleChapter,
          startVerse: bibleStartVerse,
          endVerse: bibleEndVerse,
        }),
      })
      const passage = response.passage
      const itemId = `bible-${uuid()}`
      const project = serviceCore.addBibleItem(draft, {
        id: itemId,
        title: `${passage.title} · BSB / SYNO-W`,
        range: passage.range,
        passagesByChannel: passage.passagesByChannel,
        presetId: 'scripture-text',
        operatorNotes: 'Exact Bible text pinned from the configured Heritage reader data.',
        parentId: selected?.kind === 'group' ? selected.id : null,
        now: new Date().toISOString(),
      })
      acceptCoreProject(
        project,
        itemId,
        'Bible passage resolved and pinned for English, Russian, and Media. Save the shared service when the order is ready.',
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
      const project = serviceCore.setSongChannelTreatment(draft, {
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
    setUploadingPicture(true)
    setError(null)
    setNotice('Uploading the exact picture privately…')
    try {
      const uploaded = await uploadServiceImage(file)
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
          project.rootItemIds.push(id)
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
      <header className="heritage-service-planner__heading">
        <p className="heritage-admin-eyebrow">One shared service</p>
        <h1>Plan a service</h1>
        <p>Arrange the service once, preview English, Russian, and Media, then open the same document in SyncShow. Display routing stays on the venue computer.</p>
      </header>

      <NewService onCreated={useEnvelope} />
      {error ? <p className="heritage-service-planner__error" role="alert">{error}</p> : null}
      <p className="heritage-service-planner__notice" aria-live="polite">{notice}</p>

      <div className="heritage-service-planner__workspace">
        <aside className="heritage-service-planner__services">
          <div className="heritage-service-planner__pane-heading">
            <h2>Services</h2>
            <button className="btn btn--style-secondary btn--size-small" type="button" disabled={busy} onClick={loadList}>Refresh</button>
          </div>
          {summaries.length ? summaries.map(summary => (
            <button
              className="heritage-service-planner__service"
              data-current={envelope?.syncId === summary.syncId || undefined}
              key={summary.syncId}
              type="button"
              disabled={busy}
              onClick={() => openService(summary.syncId)}
            >
              <strong>{summary.title}</strong>
              <span>{summary.serviceDate} · {summary.status} · v{summary.syncVersion}</span>
            </button>
          )) : <p className="heritage-service-planner__empty">No shared services yet.</p>}
        </aside>

        <main className="heritage-service-planner__rundown">
          <div className="heritage-service-planner__pane-heading">
            <div>
              <h2>{draft?.title || 'Service order'}</h2>
              <span>{draft?.serviceDate || 'Choose a service'}</span>
            </div>
            {draft ? <div className="heritage-service-planner__add">
              <button type="button" onClick={() => add('group')}>+ Section</button>
              <button type="button" onClick={() => add('notice')}>+ Notice</button>
              <button type="button" onClick={() => add('sermon')}>+ Sermon text</button>
              <button type="button" onClick={() => add('blank')}>+ Blank</button>
              <button type="button" disabled={uploadingPicture} onClick={() => choosePicture('new')}>+ Picture</button>
              <input
                ref={pictureInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={event => pictureChosen(event.target.files?.[0])}
              />
            </div> : null}
          </div>
          {draft ? <div className="heritage-service-planner__library-actions" aria-label="Reviewed libraries">
            <div>
              <label>
                <span>Community song</span>
                <select value={songChoice} onChange={event => setSongChoice(event.target.value)}>
                  {songLibrary.map(song => <option key={song.syncId} value={song.syncId}>
                    {song.title}{song.russianTitle && song.russianTitle !== song.title ? ` / ${song.russianTitle}` : ''}
                  </option>)}
                </select>
              </label>
              <button type="button" disabled={busy || !songChoice} onClick={addLibrarySong}>+ Pinned song</button>
            </div>
            <div>
              <label>
                <span>Bible book</span>
                <select
                  value={bibleBookId}
                  onChange={event => {
                    setBibleBookId(event.target.value)
                    const chapters = bibleBooks.find(book => book.id === event.target.value)?.chapters || 1
                    setBibleChapter(current => Math.min(current, chapters))
                  }}
                >
                  {bibleBooks.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}
                </select>
              </label>
              <label><span>Chapter</span><input type="number" min={1} max={bibleBooks.find(book => book.id === bibleBookId)?.chapters || 200} value={bibleChapter} onChange={event => setBibleChapter(Number(event.target.value))} /></label>
              <label><span>Start verse</span><input type="number" min={1} max={999} value={bibleStartVerse} onChange={event => setBibleStartVerse(Number(event.target.value))} /></label>
              <label><span>End verse</span><input type="number" min={1} max={999} value={bibleEndVerse} onChange={event => setBibleEndVerse(Number(event.target.value))} /></label>
              <button type="button" disabled={busy || !bibleBookId} onClick={addBiblePassage}>+ Pinned reading</button>
            </div>
            <small>Adding content pins exact reviewed revisions into this private service; it does not publish or change song access.</small>
          </div> : null}
          {draft ? (
            <ol className="heritage-service-planner__rows">
              {rows.map(row => {
                const ordered = row.parentId === null
                  ? draft.rootItemIds
                  : draft.items[row.parentId].childIds
                return (
                  <li key={row.item.id} style={{ '--service-depth': row.depth } as React.CSSProperties}>
                    <button
                      className="heritage-service-planner__row"
                      data-selected={selectedId === row.item.id || undefined}
                      type="button"
                      onClick={() => setSelectedId(row.item.id)}
                    >
                      <strong>{row.item.title}</strong>
                      <span>{row.item.kind}</span>
                    </button>
                    <div className="heritage-service-planner__row-actions">
                      <button type="button" disabled={row.index === 0} aria-label={`Move ${row.item.title} up`} onClick={() => move(row, -1)}>↑</button>
                      <button type="button" disabled={row.index === ordered.length - 1} aria-label={`Move ${row.item.title} down`} onClick={() => move(row, 1)}>↓</button>
                      <button type="button" aria-label={`Remove ${row.item.title}`} onClick={() => remove(row)}>×</button>
                    </div>
                  </li>
                )
              })}
              {!rows.length ? <li className="heritage-service-planner__empty">Add the first section or item above.</li> : null}
            </ol>
          ) : <p className="heritage-service-planner__empty">Choose a shared service from the left.</p>}
        </main>

        <aside className="heritage-service-planner__inspector">
          <h2>{selected?.title || 'Selected item'}</h2>
          {selected ? <>
            <label><span>Volunteer label</span><input value={selected.title} maxLength={200} onChange={event => updateSelected({ title: event.target.value })} /></label>
            <label><span>Operator notes</span><textarea rows={3} value={selected.operatorNotes || ''} onChange={event => updateSelected({ operatorNotes: event.target.value })} /></label>
            {presetChoices(selected).length ? <label>
              <span>Visual preset</span>
              <select value={itemPreset(selected)} onChange={event => updateSelected(selected.kind === 'song' ? { lyricsPresetId: event.target.value } : { presetId: event.target.value })}>
                {presetChoices(selected).map(preset => <option key={preset} value={preset}>{preset}</option>)}
              </select>
            </label> : null}
            {selected.kind === 'group' ? <label>
              <span>Section type</span>
              <select value={selected.groupKind} onChange={event => updateSelected({ groupKind: event.target.value })}>
                {['service', 'section', 'sermon', 'point', 'subpoint', 'custom'].map(kind => <option key={kind}>{kind}</option>)}
              </select>
            </label> : null}
            {(selected.kind === 'sermon' || selected.kind === 'notice') ? CHANNEL_IDS.map(channelId => (
              <label key={channelId}>
                <span>{draft?.channels[channelId]?.label || channelId} text</span>
                <textarea
                  rows={5}
                  value={selected.textByChannel?.[channelId] || ''}
                  placeholder="Leave empty to hide this output"
                  onChange={event => {
                    const textByChannel = { ...selected.textByChannel }
                    if (event.target.value) textByChannel[channelId] = event.target.value
                    else delete textByChannel[channelId]
                    updateSelected({ textByChannel })
                  }}
                />
              </label>
            )) : null}
            {selected.kind === 'blank' ? CHANNEL_IDS.map(channelId => (
              <label className="heritage-service-planner__check" key={channelId}>
                <input
                  type="checkbox"
                  checked={selected.channelIds.includes(channelId)}
                  onChange={event => {
                    const channelIds = event.target.checked
                      ? [...new Set([...selected.channelIds, channelId])]
                      : selected.channelIds.filter((id: string) => id !== channelId)
                    updateSelected({ channelIds })
                  }}
                />
                <span>Clear {draft?.channels[channelId]?.label || channelId}</span>
              </label>
            )) : null}
            {selected.kind === 'picture' ? <>
              <button type="button" disabled={uploadingPicture} onClick={() => choosePicture('all')}>
                {uploadingPicture ? 'Uploading…' : 'Replace picture on every output'}
              </button>
              {CHANNEL_IDS.map(channelId => <button
                key={channelId}
                type="button"
                disabled={uploadingPicture}
                onClick={() => choosePicture(channelId)}
              >
                Replace {draft?.channels[channelId]?.label || channelId} picture
              </button>)}
              <label><span>Image description</span><input value={selected.altText || ''} onChange={event => updateSelected({ altText: event.target.value })} /></label>
              <label><span>Attribution</span><input value={selected.attribution || ''} onChange={event => updateSelected({ attribution: event.target.value })} /></label>
              <label><span>Fit</span><select value={selected.fit} onChange={event => updateSelected({ fit: event.target.value })}><option>fit</option><option>fill</option><option>stretch</option></select></label>
            </> : null}
            {selected.kind === 'song' ? <div className="heritage-service-planner__treatments">
              <p className="heritage-service-planner__boundary">Exact Community song revisions stay pinned. Choose what each logical output shows; detailed verse/chorus ordering remains available in SyncShow.</p>
              {CHANNEL_IDS.map(channelId => {
                const primaryChannelId = selected.primaryChannelId || selectedSongContentChannels[0]
                return <label key={channelId}>
                  <span>{draft?.channels[channelId]?.label || channelId} treatment</span>
                  <select
                    value={songTreatmentValue(selected.variants?.[channelId])}
                    disabled={channelId === primaryChannelId}
                    onChange={event => setSelectedSongTreatment(channelId, event.target.value)}
                  >
                    {selected.variants?.[channelId]?.mode === 'content'
                      ? <option value="content">Pinned exact lyrics</option>
                      : null}
                    {selectedSongContentChannels
                      .filter(sourceChannelId => sourceChannelId !== channelId)
                      .flatMap(sourceChannelId => [
                        <option key={`inherit:${sourceChannelId}`} value={`inherit:${sourceChannelId}`}>Normal lyrics from {draft?.channels[sourceChannelId]?.label || sourceChannelId}</option>,
                        <option key={`derive:${sourceChannelId}`} value={`derive-next-text:${sourceChannelId}`}>Current + next from {draft?.channels[sourceChannelId]?.label || sourceChannelId}</option>,
                      ])}
                    <option value="hidden">Hidden on this output</option>
                  </select>
                </label>
              })}
            </div> : null}
            {selected.kind === 'bible' ? <p className="heritage-service-planner__boundary">This reading keeps exact translation text and checksums for every output. Add a different canonical lookup above if the passage changes.</p> : null}
            {selectedSermonDocumentId ? <a
              className="btn btn--style-secondary"
              href={`/admin/sermon-publications?sermon=${encodeURIComponent(selectedSermonDocumentId)}`}
            >Open exact sermon publication review</a> : null}
          </> : <p className="heritage-service-planner__empty">Choose an item in the order to edit it.</p>}
        </aside>
      </div>

      {draft ? <section className="heritage-service-planner__previews" aria-label="Immediate output previews">
        {CHANNEL_IDS.map(channelId => (
          <article key={channelId}>
            <span>{draft.channels[channelId]?.label || channelId}</span>
            <h3>{selected?.title || 'Preview'}</h3>
            <p>{previewText(selected, channelId)}</p>
          </article>
        ))}
      </section> : null}

      {draft ? <footer className="heritage-service-planner__savebar">
        <label>
          <span>Revision status</span>
          <select value={desiredStatus} onChange={event => setDesiredStatus(event.target.value as ServiceEnvelope['status'])}>
            <option value="planning">Planning</option>
            <option value="ready">Ready for this exact revision</option>
            <option value="archived">Archived privately</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <span>{dirty ? 'Unsaved changes' : `Community version ${envelope?.syncVersion}`}</span>
        <button className="btn btn--style-primary" type="button" disabled={busy || (!dirty && desiredStatus === envelope?.status)} onClick={save}>
          {busy ? 'Saving…' : 'Save shared service'}
        </button>
      </footer> : null}
    </section>
  )
}
