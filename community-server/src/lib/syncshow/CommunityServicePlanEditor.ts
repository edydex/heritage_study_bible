import { createHash, randomUUID } from 'node:crypto'
import type { CollectionBeforeValidateHook, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'
import { effectiveSyncDocuments, normalizeSyncDocuments } from '@/lib/syncShowProtocol'
import { bibleRangeContains } from './BibleRange.ts'
import {
  COMMUNITY_SERVICE_PLAN_KIND,
  CommunityServicePlanError,
  normalizeCommunityServicePlanStatus,
  serializeCommunityServicePlan,
  validateCommunityServicePlanSource,
  type CommunityServicePlanEntry,
  type CommunityServicePlanStatus,
} from './CommunityServicePlan.ts'
import {
  parseSermonDocument,
  serializeSermonDocument,
  type CanonicalSermonDocument,
} from './SermonDocument.ts'

type MutableRecord = Record<string, any>
type ResourceResolver = (
  id: number | string,
) => Promise<MutableRecord | null>

export type ServicePlanPreparationOptions = {
  data: MutableRecord
  originalDoc?: MutableRecord
  operation: 'create' | 'update'
  resolveSong: ResourceResolver
  resolveSermon: ResourceResolver
  uuid?: () => string
  now?: () => Date
}

export type ServicePlanPreparationErrorItem = {
  path: string
  message: string
}

export class CommunityServicePlanPreparationError extends Error {
  errors: ServicePlanPreparationErrorItem[]

  constructor(errors: ServicePlanPreparationErrorItem[]) {
    super(errors[0]?.message || 'The service plan is invalid.')
    this.name = 'CommunityServicePlanPreparationError'
    this.errors = errors
  }
}

const SYNC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

function record(value: unknown): MutableRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as MutableRecord
    : {}
}

function relationId(value: unknown): number | string | null {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0) return raw
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  return null
}

function sameRelation(left: unknown, right: unknown) {
  const leftId = relationId(left)
  const rightId = relationId(right)
  return leftId !== null && rightId !== null && String(leftId) === String(rightId)
}

function relationCommunityId(value: unknown): string {
  return String(relationId(value) || '')
}

function dateOnly(value: unknown): string {
  const raw = String(value || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : raw
}

function editableEntry(entryValue: unknown) {
  const entry = record(entryValue)
  const rowId = relationId(entry.id)
  const kind = String(entry.kind || '')
  const base = {
    rowId: rowId === null ? '' : String(rowId),
    kind,
    title: String(entry.title || ''),
  }
  if (kind === 'song' || kind === 'sermon') {
    const selectedId = relationId(entry[kind])
    return {
      ...base,
      [kind]: selectedId === null ? null : String(selectedId),
    }
  }
  if (kind === 'scripture') {
    const scripture = record(entry.scripture)
    const sermonReading = record(scripture.sermonReading)
    const selectedSermonId = relationId(sermonReading.sermon)
    return {
      ...base,
      scripture: {
        bookId: String(scripture.bookId || ''),
        startChapter: Number(scripture.startChapter),
        startVerse: Number(scripture.startVerse),
        endChapter: Number(scripture.endChapter),
        endVerse: Number(scripture.endVerse),
        translationId: String(scripture.translationId || ''),
        sermonReading: {
          sermon: selectedSermonId === null ? null : String(selectedSermonId),
          referenceId: String(sermonReading.referenceId || '').trim(),
        },
      },
    }
  }
  return base
}

function editablePlanContent(value: MutableRecord) {
  return {
    community: relationCommunityId(value.community),
    title: String(value.title || ''),
    serviceDate: dateOnly(value.serviceDate),
    startTime: String(value.startTime || ''),
    teamNotes: String(value.teamNotes ?? '').replace(/\r\n?/g, '\n'),
    entries: Array.isArray(value.entries)
      ? value.entries.map(editableEntry)
      : [],
  }
}

function terminalContentErrors(
  data: MutableRecord,
  originalDoc: MutableRecord,
): ServicePlanPreparationErrorItem[] {
  const candidate = editablePlanContent({ ...originalDoc, ...data })
  const original = editablePlanContent(originalDoc)
  const paths: Array<keyof typeof original> = [
    'community',
    'title',
    'serviceDate',
    'startTime',
    'teamNotes',
    'entries',
  ]
  const changedPath = paths.find(path => (
    JSON.stringify(candidate[path]) !== JSON.stringify(original[path])
  ))
  return changedPath
    ? [{
        path: changedPath,
        message: 'Archived and cancelled plans are audit records. Restore this plan to Draft first, save it, and then make content changes.',
      }]
    : []
}

function nextChangedAt(previous: unknown, now: Date) {
  const current = now.getTime()
  const prior = Date.parse(String(previous || ''))
  return new Date(Math.max(
    Number.isFinite(current) ? current : Date.now(),
    Number.isFinite(prior) ? prior + 1 : Number.NEGATIVE_INFINITY,
  )).toISOString()
}

function originalEntriesByRowId(originalDoc: MutableRecord) {
  const entries = Array.isArray(originalDoc.entries)
    ? originalDoc.entries.map(record)
    : []
  return new Map(entries.flatMap(entry => {
    const id = relationId(entry.id)
    return id === null ? [] : [[String(id), entry] as const]
  }))
}

function stableEntryId(
  entry: MutableRecord,
  originalByRowId: Map<string, MutableRecord>,
  uuid: () => string,
) {
  const rowId = relationId(entry.id)
  const original = rowId === null
    ? undefined
    : originalByRowId.get(String(rowId))
  return {
    entryId: original?.entryId
      ? String(original.entryId)
      : `entry-${uuid()}`,
    original,
  }
}

function cachedResourceResolver(resolve: ResourceResolver): ResourceResolver {
  const cache = new Map<string, Promise<MutableRecord | null>>()
  return id => {
    const key = String(id)
    let pending = cache.get(key)
    if (!pending) {
      pending = Promise.resolve().then(() => resolve(id))
      cache.set(key, pending)
    }
    return pending
  }
}

function resourcePinChanged(
  original: MutableRecord | undefined,
  relationField: 'song' | 'sermon',
  currentRelation: unknown,
  syncId: string,
  syncVersion: number,
  revision: string,
) {
  if (!original || !sameRelation(original[relationField], currentRelation)) return true
  return (
    String(original.resolvedSyncId || '') !== syncId
    || Number(original.resolvedSyncVersion) !== syncVersion
    || String(original.resolvedRevision || '') !== revision
  )
}

function basePreparedEntry(
  entry: MutableRecord,
  entryId: string,
): MutableRecord {
  return {
    ...entry,
    entryId,
    song: null,
    sermon: null,
    // Payload traverses nested group fields before persistence. An explicit
    // null parent crashes that traversal once Scripture contains the nested
    // sermonReading group; an empty group clears every stored Scripture
    // column while remaining safe for Section, Song, and Sermon rows.
    scripture: {},
    resolvedSyncId: null,
    resolvedSyncVersion: null,
    resolvedRevision: null,
  }
}

function strictSongPin(song: MutableRecord) {
  const syncId = String(song.syncId || '')
  const syncVersion = Number(song.syncVersion)
  if (
    !SYNC_ID_PATTERN.test(syncId)
    || !Number.isSafeInteger(syncVersion)
    || syncVersion < 1
  ) {
    return null
  }
  return {
    syncId,
    syncVersion,
    revision: `song:${syncId}:${syncVersion}`,
  }
}

function strictSermonPin(sermon: MutableRecord) {
  const syncId = String(sermon.syncId || '')
  const syncVersion = Number(sermon.syncVersion)
  const revision = String(sermon.syncCurrentRevision || '')
  if (
    !SYNC_ID_PATTERN.test(syncId)
    || !Number.isSafeInteger(syncVersion)
    || syncVersion < 1
    || !SHA256_PATTERN.test(revision)
  ) {
    return null
  }
  return { syncId, syncVersion, revision }
}

function readySongProblem(song: MutableRecord): string | null {
  if (song.status === 'archived') {
    return 'This song is archived. Restore or replace it before marking the plan Ready.'
  }
  if (!Array.isArray(song.syncDocuments) || song.syncDocuments.length === 0) {
    return 'This song is a legacy-only listing without canonical SyncShow content.'
  }
  try {
    const stored = normalizeSyncDocuments(song.syncDocuments) || []
    if (!stored.length || effectiveSyncDocuments(song).length !== stored.length) {
      return 'This song does not have one stable canonical SyncShow representation.'
    }
  } catch {
    return 'This song has conflicting canonical SyncShow content. Repair it before marking the plan Ready.'
  }
  return null
}

function exactPinnedSermon(
  sermon: MutableRecord,
): {
  document: CanonicalSermonDocument
  pin: NonNullable<ReturnType<typeof strictSermonPin>>
} | null {
  const pin = strictSermonPin(sermon)
  if (!pin) return null
  const source = String(sermon.syncCurrentDocumentSource || '')
  try {
    const document = parseSermonDocument(source)
    const actualRevision = createHash('sha256').update(source, 'utf8').digest('hex')
    if (
      document.id !== pin.syncId
      || serializeSermonDocument(document) !== source
      || actualRevision !== pin.revision
    ) {
      return null
    }
    return { document, pin }
  } catch {
    return null
  }
}

function readySermonProblem(
  sermon: MutableRecord,
  exact: ReturnType<typeof exactPinnedSermon> | undefined = undefined,
): string | null {
  if (sermon.syncArchived === true) {
    return 'This sermon is archived. Restore or replace it before marking the plan Ready.'
  }
  const pin = strictSermonPin(sermon)
  if (!pin) {
    return 'This is a legacy-only sermon without a canonical SyncShow identity.'
  }
  const resolvedExact = exact === undefined ? exactPinnedSermon(sermon) : exact
  if (!resolvedExact) {
    return 'This sermon has conflicting canonical SyncShow content. Repair it before marking the plan Ready.'
  }
  if (!['ready', 'published'].includes(resolvedExact.document.publication.status)) {
    return 'This sermon is still Draft. Review it before marking the plan Ready.'
  }
  return null
}

async function prepareResourceEntry(options: {
  communityId: string
  entry: MutableRecord
  entryId: string
  index: number
  kind: 'song' | 'sermon'
  original?: MutableRecord
  ready: boolean
  requireReviewedPin: boolean
  resolve: ResourceResolver
  exactSermons: Map<string, ReturnType<typeof exactPinnedSermon>>
  errors: ServicePlanPreparationErrorItem[]
}) {
  const {
    communityId,
    entry,
    entryId,
    index,
    kind,
    original,
    ready,
    requireReviewedPin,
    resolve,
    exactSermons,
    errors,
  } = options
  const relationField = kind
  const path = `entries.${index}.${relationField}`
  const selectedId = relationId(entry[relationField])
  if (selectedId === null) {
    errors.push({
      path,
      message: `Choose a ${kind} for this service-plan row.`,
    })
    return null
  }
  let resource: MutableRecord | null
  try {
    resource = await resolve(selectedId)
  } catch {
    resource = null
  }
  if (!resource || relationCommunityId(resource.community) !== communityId) {
    errors.push({
      path,
      message: `The selected ${kind} is missing or belongs to another Community.`,
    })
    return null
  }
  const pin = kind === 'song' ? strictSongPin(resource) : strictSermonPin(resource)
  if (!pin) {
    errors.push({
      path,
      message: `The selected ${kind} is legacy-only and has no stable SyncShow identity.`,
    })
    return null
  }
  let exactSermon: ReturnType<typeof exactPinnedSermon> = null
  if (kind === 'sermon') {
    const cacheKey = String(selectedId)
    if (exactSermons.has(cacheKey)) {
      exactSermon = exactSermons.get(cacheKey) || null
    } else {
      exactSermon = exactPinnedSermon(resource)
      exactSermons.set(cacheKey, exactSermon)
    }
  }
  if (ready) {
    const problem = kind === 'song'
      ? readySongProblem(resource)
      : readySermonProblem(resource, exactSermon)
    if (problem) errors.push({ path, message: problem })
    if (
      requireReviewedPin
      && resourcePinChanged(
        original,
        relationField,
        entry[relationField],
        pin.syncId,
        pin.syncVersion,
        pin.revision,
      )
    ) {
      errors.push({
        path,
        message: `This ${kind} changed after the draft was reviewed. Save the plan as Draft to refresh its pin, review it, then mark it Ready.`,
      })
    }
  }
  return {
    resource,
    pin,
    exactSermon,
    stored: {
      ...basePreparedEntry(entry, entryId),
      [relationField]: selectedId,
      resolvedSyncId: pin.syncId,
      resolvedSyncVersion: pin.syncVersion,
      resolvedRevision: pin.revision,
    },
    canonical: {
      id: entryId,
      kind,
      title: String(entry.title || ''),
      syncId: pin.syncId,
      expectedRevision: pin.revision,
      expectedSyncVersion: pin.syncVersion,
    } satisfies CommunityServicePlanEntry,
  }
}

export async function prepareCommunityServicePlanChange(
  options: ServicePlanPreparationOptions,
) {
  const {
    data,
    originalDoc = {},
    operation,
    resolveSong,
    resolveSermon,
    uuid = randomUUID,
    now = () => new Date(),
  } = options
  const source = { ...originalDoc, ...data }
  const errors: ServicePlanPreparationErrorItem[] = []
  const communityId = relationCommunityId(source.community)
  if (!communityId) {
    errors.push({ path: 'community', message: 'Choose the church for this service plan.' })
  }
  const status = (() => {
    try {
      return normalizeCommunityServicePlanStatus(
        source.status || 'draft',
      )
    } catch {
      errors.push({
        path: 'status',
        message: 'Choose Draft, Ready, Archived, or Cancelled.',
      })
      return 'draft' as CommunityServicePlanStatus
    }
  })()
  const ready = status === 'ready'
  if (operation === 'update') {
    let originalStatus: CommunityServicePlanStatus
    try {
      originalStatus = normalizeCommunityServicePlanStatus(originalDoc.status)
    } catch {
      throw new CommunityServicePlanPreparationError([{
        path: 'status',
        message: 'The stored service-plan status is invalid.',
      }])
    }
    const originalTerminal = (
      originalStatus === 'archived' || originalStatus === 'cancelled'
    )
    const targetTerminal = status === 'archived' || status === 'cancelled'
    if (originalTerminal || targetTerminal) {
      errors.push(...terminalContentErrors(data, originalDoc))
      if (originalTerminal && status === 'ready') {
        errors.push({
          path: 'status',
          message: 'Restore this archived or cancelled plan to Draft before marking it Ready again.',
        })
      }
      let validatedSource: ReturnType<typeof validateCommunityServicePlanSource>
      try {
        validatedSource = validateCommunityServicePlanSource(
          originalDoc.documentSource,
        )
        if (
          validatedSource.plan.id !== String(originalDoc.syncId || '')
          || validatedSource.revision !== String(originalDoc.revision || '')
        ) {
          throw new Error('stored identity mismatch')
        }
      } catch {
        errors.push({
          path: 'status',
          message: 'This plan’s stored audit source is invalid and cannot change lifecycle state.',
        })
      }
      if (errors.length) {
        throw new CommunityServicePlanPreparationError(errors)
      }
      const syncVersion = Number(originalDoc.syncVersion) + 1
      if (!Number.isSafeInteger(syncVersion) || syncVersion < 2) {
        throw new CommunityServicePlanPreparationError([{
          path: 'syncVersion',
          message: 'The stored service-plan version is invalid.',
        }])
      }
      return {
        ...data,
        community: originalDoc.community,
        status,
        serviceDate: originalDoc.serviceDate,
        startTime: originalDoc.startTime,
        title: originalDoc.title,
        teamNotes: originalDoc.teamNotes ?? '',
        entries: originalDoc.entries,
        syncId: originalDoc.syncId,
        syncVersion,
        documentSource: originalDoc.documentSource,
        revision: originalDoc.revision,
        changedAt: nextChangedAt(originalDoc.changedAt, now()),
      }
    }
  }
  const originalByRowId = originalEntriesByRowId(originalDoc)
  const rawEntries = Array.isArray(source.entries)
    ? source.entries.map(record)
    : []
  const preparedRows = rawEntries.map((entry, index) => ({
    entry,
    index,
    kind: String(entry.kind || ''),
    ...stableEntryId(entry, originalByRowId, uuid),
  }))
  const storedEntries: MutableRecord[] = []
  const canonicalEntries: CommunityServicePlanEntry[] = []
  const preparedResources = new Map<
    number,
    NonNullable<Awaited<ReturnType<typeof prepareResourceEntry>>>
  >()
  const resolveCachedSong = cachedResourceResolver(resolveSong)
  const resolveCachedSermon = cachedResourceResolver(resolveSermon)
  const exactSermons = new Map<
    string,
    ReturnType<typeof exactPinnedSermon>
  >()

  // Resolve resource rows before ordered emission. A Scripture reading normally
  // precedes the sermon it introduces, so its exact target pin must already be
  // available without changing the service order.
  for (const row of preparedRows) {
    const { entry, entryId, index, kind, original } = row
    if (kind === 'song' || kind === 'sermon') {
      const prepared = await prepareResourceEntry({
        communityId,
        entry,
        entryId,
        index,
        kind,
        original,
        ready,
        requireReviewedPin: ready && operation === 'update',
        resolve: kind === 'song' ? resolveCachedSong : resolveCachedSermon,
        exactSermons,
        errors,
      })
      if (prepared) preparedResources.set(index, prepared)
    }
  }

  const linkedSermonEntryIds = new Set<string>()
  for (const row of preparedRows) {
    const { entry, entryId, index, kind } = row
    if (kind === 'song' || kind === 'sermon') {
      const prepared = preparedResources.get(index)
      if (prepared) {
        storedEntries.push(prepared.stored)
        canonicalEntries.push(prepared.canonical)
      }
      continue
    }
    if (kind === 'section') {
      storedEntries.push(basePreparedEntry(entry, entryId))
      canonicalEntries.push({
        id: entryId,
        kind: 'section',
        title: String(entry.title || ''),
      })
      continue
    }
    if (kind === 'scripture') {
      const scripture = record(entry.scripture)
      const range = {
        schemaVersion: 1 as const,
        bookId: String(scripture.bookId || ''),
        start: {
          chapter: Number(scripture.startChapter),
          verse: Number(scripture.startVerse),
        },
        end: {
          chapter: Number(scripture.endChapter),
          verse: Number(scripture.endVerse),
        },
      }
      const rawSermonReading = record(scripture.sermonReading)
      const selectedSermonId = relationId(rawSermonReading.sermon)
      const enteredReferenceId = String(
        rawSermonReading.referenceId ?? '',
      ).trim()
      const sermonPath =
        `entries.${index}.scripture.sermonReading.sermon`
      const referencePath =
        `entries.${index}.scripture.sermonReading.referenceId`
      let storedSermonReading: MutableRecord | null = null
      let canonicalSermonReading: {
        sermonEntryId: string
        referenceId: string
      } | null = null

      if (selectedSermonId === null) {
        if (enteredReferenceId) {
          errors.push({
            path: sermonPath,
            message: 'Choose the sermon this Scripture reading introduces.',
          })
        }
      } else {
        const targets = preparedRows.filter(candidate => (
          candidate.index > index
          && candidate.kind === 'sermon'
          && sameRelation(candidate.entry.sermon, selectedSermonId)
        ))
        if (targets.length === 0) {
          errors.push({
            path: sermonPath,
            message: 'The selected sermon must appear once after this Scripture reading in the service order.',
          })
        } else if (targets.length > 1) {
          errors.push({
            path: sermonPath,
            message: 'The selected sermon appears more than once after this Scripture reading. Keep one exact target row.',
          })
        } else {
          const target = targets[0]
          const preparedTarget = preparedResources.get(target.index)
          if (preparedTarget) {
            const exact = preparedTarget.exactSermon
            if (!exact) {
              errors.push({
                path: referencePath,
                message: 'The linked sermon does not have one exact canonical SyncShow revision.',
              })
            } else {
              const confirmedPrimary = exact.document.references.filter(
                reference => (
                  reference.role === 'primary'
                  && reference.reviewStatus === 'confirmed'
                ),
              )
              let reference = enteredReferenceId
                ? exact.document.references.find(
                    candidate => candidate.id === enteredReferenceId,
                  )
                : undefined
              if (!enteredReferenceId) {
                if (confirmedPrimary.length === 1) {
                  reference = confirmedPrimary[0]
                } else if (confirmedPrimary.length === 0) {
                  errors.push({
                    path: referencePath,
                    message: 'The linked sermon has no confirmed primary passage.',
                  })
                } else {
                  errors.push({
                    path: referencePath,
                    message: 'This sermon has more than one confirmed primary passage. Enter the exact reference ID.',
                  })
                }
              } else if (!reference) {
                errors.push({
                  path: referencePath,
                  message: 'That reference ID is not present in the linked sermon’s exact revision.',
                })
              } else if (reference.role !== 'primary') {
                errors.push({
                  path: referencePath,
                  message: 'The linked sermon reference must be a primary passage.',
                })
              } else if (reference.reviewStatus !== 'confirmed') {
                errors.push({
                  path: referencePath,
                  message: 'The linked sermon reference must be confirmed.',
                })
              }

              if (
                reference
                && reference.role === 'primary'
                && reference.reviewStatus === 'confirmed'
              ) {
                let contained: boolean | null = null
                try {
                  contained = bibleRangeContains(reference.range, range)
                } catch {
                  // The shared service-plan parser below owns malformed range
                  // errors; containment applies only after canonical parsing.
                }
                if (contained === false) {
                  errors.push({
                    path: referencePath,
                    message: 'This Scripture reading is outside the linked sermon’s confirmed primary passage.',
                  })
                } else if (linkedSermonEntryIds.has(target.entryId)) {
                  errors.push({
                    path: sermonPath,
                    message: 'This sermon row already has a linked Scripture reading.',
                  })
                } else {
                  linkedSermonEntryIds.add(target.entryId)
                  storedSermonReading = {
                    sermon: selectedSermonId,
                    referenceId: reference.id,
                  }
                  canonicalSermonReading = {
                    sermonEntryId: target.entryId,
                    referenceId: reference.id,
                  }
                }
              }
            }
          }
        }
      }

      const storedScripture = {
        ...scripture,
        sermonReading: storedSermonReading,
      }
      const prepared = {
        ...basePreparedEntry(entry, entryId),
        scripture: storedScripture,
      }
      storedEntries.push(prepared)
      canonicalEntries.push({
        id: entryId,
        kind: 'scripture',
        title: String(entry.title || ''),
        range,
        translationId: String(scripture.translationId || ''),
        sermonReading: canonicalSermonReading,
      })
      continue
    }
    errors.push({
      path: `entries.${index}.kind`,
      message: 'Choose Section, Song, Scripture, or Sermon.',
    })
  }

  if (errors.length) throw new CommunityServicePlanPreparationError(errors)
  const syncId = operation === 'update' && originalDoc.syncId
    ? String(originalDoc.syncId)
    : `service-${uuid()}`
  const syncVersion = operation === 'create'
    ? 1
    : Number(originalDoc.syncVersion) + 1
  if (!Number.isSafeInteger(syncVersion) || syncVersion < 1) {
    throw new CommunityServicePlanPreparationError([{
      path: 'syncVersion',
      message: 'The stored service-plan version is invalid.',
    }])
  }
  let documentSource: string
  try {
    documentSource = serializeCommunityServicePlan({
      schemaVersion: 2,
      kind: COMMUNITY_SERVICE_PLAN_KIND,
      id: syncId,
      title: source.title,
      serviceDate: dateOnly(source.serviceDate),
      startTime: source.startTime,
      teamNotes: source.teamNotes ?? '',
      entries: canonicalEntries,
    })
  } catch (error) {
    throw new CommunityServicePlanPreparationError([{
      path: 'entries',
      message: error instanceof CommunityServicePlanError
        ? error.message
        : 'The service plan could not be normalized.',
    }])
  }
  const changedAt = nextChangedAt(originalDoc.changedAt, now())
  return {
    ...data,
    status,
    entries: storedEntries,
    syncId,
    syncVersion,
    documentSource,
    revision: createHash('sha256').update(documentSource, 'utf8').digest('hex'),
    changedAt,
  }
}

async function findRelation(
  req: PayloadRequest,
  collection: 'songs' | 'sermons',
  id: number | string,
) {
  try {
    return record(await req.payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
      req,
    }))
  } catch {
    return null
  }
}

export const prepareCommunityServicePlanFields: CollectionBeforeValidateHook =
  async ({ data, operation, originalDoc, req }) => {
    if (!data) return data
    try {
      return await prepareCommunityServicePlanChange({
        data: record(data),
        originalDoc: record(originalDoc),
        operation,
        resolveSong: id => findRelation(req, 'songs', id),
        resolveSermon: id => findRelation(req, 'sermons', id),
      })
    } catch (error) {
      if (error instanceof CommunityServicePlanPreparationError) {
        throw new ValidationError({
          collection: 'service-plans',
          errors: error.errors,
          req,
        })
      }
      throw error
    }
  }
