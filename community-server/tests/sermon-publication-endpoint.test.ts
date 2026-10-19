import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { SyncShowSermonPublicationCatalogs } from '../src/collections/SyncShowSermonPublicationCatalogs.ts'
import { SyncShowSermonPublications } from '../src/collections/SyncShowSermonPublications.ts'
import { managerSermonPublicationEndpoints } from '../src/endpoints/sermonPublications.ts'
import { syncShowEndpoints } from '../src/endpoints/syncShow.ts'
import {
  buildPublicSermonCatalogFromItemSources,
  buildPublicSermonPassageIndex,
  derivePublicSermonId,
  parsePublicSermonCatalogSource,
  serializePublicSermonCatalogItem,
} from '../src/lib/syncshow/PublicSermonPublication.ts'
import {
  buildManagerSermonPublicationTransition,
  deriveManagerDirectAudioId,
  nextCanonicalPublicationTime,
  normalizeManagerSermonPublishIntent,
  normalizeStoredManagerSermonPublication,
  publicationFieldsFromPayload,
} from '../src/lib/syncshow/ManagerSermonPublication.ts'
import {
  createSermonRevision,
  parseSermonDocument,
} from '../src/lib/syncshow/SermonDocument.ts'
import { payloadPreachedAtForServiceDate } from '../src/lib/syncshow/SermonDateProjection.ts'
import { sermonMediaCommunityNamespace } from '../src/lib/syncshow/SermonMediaStore.ts'
import {
  sermonMediaObjectKey,
} from '../src/lib/syncshow/SermonMediaStorage.ts'
import {
  publicSermonMediaUrl,
} from '../src/lib/syncshow/SermonPublicationStore.ts'
import { servePublicSermonMedia } from '../src/lib/syncshow/PublicSermonMediaRoute.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'
import {
  SYNCSHOW_SERMON_READ_SCOPE,
  SYNCSHOW_SERMON_WRITE_SCOPE,
} from '../src/lib/syncShowProtocol.ts'

type AnyRecord = Record<string, any>

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/syncshow-sermon-contract-v1.json', import.meta.url),
  'utf8',
)) as {
  sermons: {
    v3: {
      document: AnyRecord
      canonicalSource: string
      revision: string
    }
  }
}
const golden = fixture.sermons.v3

const previousCommunityPublicUrl = process.env.COMMUNITY_PUBLIC_URL
const previousSermonMediaPath = process.env.HERITAGE_SERMON_MEDIA_PATH
const managedMediaStorageRoot = mkdtempSync(join(
  tmpdir(),
  'heritage-publication-endpoint-media-',
))
process.env.COMMUNITY_PUBLIC_URL = 'https://community.example.church'
process.env.HERITAGE_SERMON_MEDIA_PATH = managedMediaStorageRoot
test.after(() => {
  if (previousCommunityPublicUrl === undefined) {
    delete process.env.COMMUNITY_PUBLIC_URL
  } else {
    process.env.COMMUNITY_PUBLIC_URL = previousCommunityPublicUrl
  }
  if (previousSermonMediaPath === undefined) {
    delete process.env.HERITAGE_SERMON_MEDIA_PATH
  } else {
    process.env.HERITAGE_SERMON_MEDIA_PATH = previousSermonMediaPath
  }
  rmSync(managedMediaStorageRoot, { recursive: true, force: true })
})

function endpoint(
  endpoints: typeof managerSermonPublicationEndpoints,
  path: string,
  method: string,
) {
  const handler = endpoints.find(candidate =>
    candidate.path === path && candidate.method === method)?.handler
  assert.ok(handler, `missing ${method.toUpperCase()} ${path}`)
  return handler
}

const publishSermon = endpoint(
  managerSermonPublicationEndpoints,
  '/community/sermon-publications/:syncId/publish',
  'post',
)
const withdrawSermon = endpoint(
  managerSermonPublicationEndpoints,
  '/community/sermon-publications/:syncId/withdraw',
  'post',
)
const listPublicationReview = endpoint(
  managerSermonPublicationEndpoints,
  '/community/sermon-publications',
  'get',
)
const getPublicationReview = endpoint(
  managerSermonPublicationEndpoints,
  '/community/sermon-publications/:syncId',
  'get',
)
const updateFromSyncShow = endpoint(
  syncShowEndpoints,
  '/community/syncshow/v1/sermons/:syncId',
  'put',
)
const archiveFromSyncShow = endpoint(
  syncShowEndpoints,
  '/community/syncshow/v1/sermons/:syncId',
  'delete',
)

function clone<T>(value: T): T {
  return structuredClone(value)
}

function relationValue(value: any): any {
  return value && typeof value === 'object' && 'id' in value ? value.id : value
}

function matchesWhere(document: AnyRecord, where: AnyRecord | undefined): boolean {
  if (!where) return true
  if (Array.isArray(where.and) && !where.and.every((part: AnyRecord) =>
    matchesWhere(document, part))) return false
  if (Array.isArray(where.or) && !where.or.some((part: AnyRecord) =>
    matchesWhere(document, part))) return false
  for (const [field, condition] of Object.entries(where)) {
    if (field === 'and' || field === 'or') continue
    const actual = relationValue(document[field])
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      if (actual !== condition) return false
      continue
    }
    const operation = condition as AnyRecord
    if ('equals' in operation && actual !== relationValue(operation.equals)) return false
    if ('exists' in operation) {
      const exists = actual !== undefined && actual !== null
      if (exists !== operation.exists) return false
    }
    if ('greater_than' in operation && !(actual > operation.greater_than)) return false
    if ('in' in operation && !operation.in.includes(actual)) return false
  }
  return true
}

function queryParts(query: AnyRecord) {
  let text = ''
  const parameters: unknown[] = []
  for (const chunk of query?.queryChunks || []) {
    if (chunk && typeof chunk === 'object' && Array.isArray(chunk.value)) {
      text += chunk.value.join('')
    } else {
      text += '?'
      parameters.push(chunk)
    }
  }
  return { text, parameters }
}

function makeHarness() {
  const emptyCatalog = buildPublicSermonCatalogFromItemSources([])
  const emptyPassageIndex = buildPublicSermonPassageIndex(emptyCatalog.catalog)
  const state = {
    communities: [{
      id: 7,
      slug: 'local-church',
      timeZone: 'America/Los_Angeles',
    }] as AnyRecord[],
    memberships: [{ id: 1, community: 7, user: 11, role: 'leader' }] as AnyRecord[],
    connections: [{
      id: 1,
      community: 7,
      user: 11,
      tokenHash: hashOpaqueToken('syncshow-sermon-token'),
      scopes: [SYNCSHOW_SERMON_READ_SCOPE, SYNCSHOW_SERMON_WRITE_SCOPE],
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      lastUsedAt: new Date().toISOString(),
    }] as AnyRecord[],
    sermons: [{
      id: 1,
      community: 7,
      title: golden.document.titles[golden.document.defaultLanguage],
      speaker: golden.document.speaker.name,
      preachedAt: payloadPreachedAtForServiceDate(
        golden.document.serviceDate,
        'America/Los_Angeles',
      ),
      series: golden.document.series?.titles[golden.document.defaultLanguage] || null,
      status: 'draft',
      syncId: golden.document.id,
      syncVersion: 1,
      syncCurrentDocumentSource: golden.canonicalSource,
      syncCurrentRevision: golden.revision,
      syncArchived: false,
      syncPublicationStatus: 'ready',
      syncVisibility: 'private',
      syncSourceObjects: [],
      syncChangedAt: '2026-07-28T12:00:00.000Z',
      syncCreateIdempotencyKey: 'publication-test-create',
      syncCreateIdempotencyHash: 'f'.repeat(64),
    }] as AnyRecord[],
    publications: [] as AnyRecord[],
    mediaObjects: [] as AnyRecord[],
    mediaUploads: [] as AnyRecord[],
    catalogs: [{
      id: 1,
      community: 7,
      schemaVersion: 1,
      generation: 1,
      changedAt: '2026-07-28T12:00:00.000Z',
      checksum: emptyCatalog.checksum,
      source: emptyCatalog.source,
      passageIndexChecksum: emptyPassageIndex.checksum,
      passageIndexSource: emptyPassageIndex.source,
    }] as AnyRecord[],
    changes: [] as AnyRecord[],
    nextPublicationId: 1,
    nextCatalogId: 2,
    nextChangeId: 1,
    nextTransactionId: 1,
    transactions: 0,
    commits: 0,
    rollbacks: 0,
    revokeAfterManagerPreflight: false,
  }
  const sessions: Record<string, {
    db: { execute: (query: unknown) => Promise<{ rows: AnyRecord[] }> }
  }> = {}
  let advisoryOwner: number | null = null
  const advisoryWaiters: Array<{ id: number; resolve: () => void }> = []

  async function acquireAdvisory(id: number) {
    if (advisoryOwner === null) {
      advisoryOwner = id
      return
    }
    await new Promise<void>(resolve => advisoryWaiters.push({ id, resolve }))
  }

  function releaseAdvisory(id: number) {
    if (advisoryOwner !== id) return
    const next = advisoryWaiters.shift()
    advisoryOwner = next?.id || null
    next?.resolve()
  }

  function documentsFor(collection: string): AnyRecord[] {
    if (collection === 'communities') return state.communities
    if (collection === 'memberships') return state.memberships
    if (collection === 'syncshow-connections') return state.connections
    if (collection === 'sermons') return state.sermons
    if (collection === 'syncshow-sermon-publications') return state.publications
    if (collection === 'syncshow-sermon-publication-catalogs') return state.catalogs
    if (collection === 'syncshow-sermon-changes') return state.changes
    return []
  }

  function localApiResult(
    collection: string,
    document: AnyRecord,
    showHiddenFields: boolean,
  ) {
    const result = clone(document)
    if (showHiddenFields) return result
    if (
      collection === 'syncshow-sermon-publications'
      || collection === 'syncshow-sermon-publication-catalogs'
    ) {
      return Object.fromEntries(Object.entries(result).filter(([field]) =>
        ['id', 'createdAt', 'updatedAt'].includes(field)))
    }
    return result
  }

  async function transactionQuery(query: unknown, transactionId: number) {
    const { text, parameters } = queryParts(query as AnyRecord)
    if (text.includes('pg_advisory_xact_lock')) {
      await acquireAdvisory(transactionId)
      return { rows: [] }
    }
    if (text.includes('FROM "memberships"')) {
      const userId = Number(parameters[0])
      const communityId = Number(parameters[1])
      return {
        rows: state.memberships
          .filter(row => Number(row.user) === userId
            && Number(row.community) === communityId
            && ['owner', 'admin', 'leader'].includes(String(row.role)))
          .slice(0, 1),
      }
    }
    if (
      text.includes('FROM "syncshow_sermon_media_uploads" u')
      && text.includes('FOR UPDATE OF u, o')
    ) {
      const communityId = Number(parameters[0])
      const sermonId = Number(parameters[1])
      const syncId = String(parameters[2])
      const uploadId = String(parameters[3])
      return {
        rows: state.mediaUploads.flatMap(upload => {
          if (
            upload.community !== communityId
            || upload.sermon !== sermonId
            || upload.syncId !== syncId
            || upload.uploadId !== uploadId
            || !['complete', 'superseded'].includes(upload.state)
            || upload.objectId == null
          ) return []
          const object = state.mediaObjects.find(candidate => (
            candidate.id === upload.objectId
            && candidate.community === upload.community
          ))
          if (!object) return []
          return [{
            uploadId: upload.uploadId,
            schemaVersion: upload.schemaVersion,
            uploadCommunityId: upload.community,
            sermonId: upload.sermon,
            state: upload.state,
            syncId: upload.syncId,
            expectedSyncVersion: upload.expectedSyncVersion,
            expectedCurrentRevision: upload.expectedCurrentRevision,
            recordingId: upload.recordingId,
            kind: upload.kind,
            language: upload.language,
            mediaType: upload.mediaType,
            fileName: upload.fileName,
            sha256: upload.sha256,
            sizeBytes: upload.sizeBytes,
            durationSeconds: upload.durationSeconds,
            completedAt: upload.completedAt,
            objectId: upload.objectId,
            objectRowId: object.id,
            objectCommunityId: object.community,
            objectSha256: object.sha256,
            objectSizeBytes: object.sizeBytes,
            objectMediaType: object.mediaType,
            storageKey: object.storageKey,
          }]
        }),
      }
    }
    if (
      text.includes('FROM "syncshow_sermon_media_objects"')
      && text.includes('FOR UPDATE')
    ) {
      const communityId = Number(parameters[0])
      const sha256 = String(parameters[1])
      return {
        rows: state.mediaObjects
          .filter(object => (
            object.community === communityId && object.sha256 === sha256
          ))
          .map(object => ({
            objectId: object.id,
            communityId: object.community,
            sha256: object.sha256,
            sizeBytes: object.sizeBytes,
            mediaType: object.mediaType,
            storageKey: object.storageKey,
          })),
      }
    }
    if (text.includes('FROM "communities"')) {
      const communityId = Number(parameters[0])
      return {
        rows: state.communities
          .filter(row => Number(row.id) === communityId)
          .map(row => ({ timeZone: row.timeZone })),
      }
    }
    if (
      text.includes('SELECT p."catalog_item_source"')
      && text.includes('FROM "syncshow_sermon_publications"')
    ) {
      const communityId = Number(parameters[0])
      return {
        rows: state.publications
          .filter(publication => {
            const sermon = state.sermons.find(row => row.id === publication.sermon)
            return publication.community === communityId
              && publication.active === true
              && publication.visibility === 'public'
              && sermon
              && sermon.syncArchived !== true
              && sermon.syncId === publication.syncId
          })
          .map(publication => ({ catalogItemSource: publication.catalogItemSource })),
      }
    }
    if (text.includes('FROM "sermons"') && text.includes('FOR UPDATE')) {
      if (text.includes('WHERE "id"')) {
        const id = Number(parameters[0])
        const sermon = state.sermons.find(row => row.id === id)
        return { rows: sermon ? [{ id: sermon.id }] : [] }
      }
      const communityId = Number(parameters[0])
      const syncId = String(parameters[1])
      const sermon = state.sermons.find(row =>
        row.community === communityId && row.syncId === syncId)
      return { rows: sermon ? [{ id: sermon.id }] : [] }
    }
    if (
      text.includes('FROM "syncshow_sermon_publications"')
      && text.includes('FOR UPDATE')
    ) {
      return { rows: state.publications.slice(0, 1).map(row => ({ id: row.id })) }
    }
    if (
      text.includes('FROM "syncshow_sermon_publication_catalogs"')
      && text.includes('FOR UPDATE')
    ) {
      return { rows: state.catalogs.slice(0, 1).map(row => ({ id: row.id })) }
    }
    throw new Error(`unexpected transaction SQL: ${text}`)
  }

  async function managerListQuery(query: unknown) {
    const { text, parameters } = queryParts(query as AnyRecord)
    if (text.includes('INNER JOIN "syncshow_sermon_media_objects" o')) {
      const sha256 = String(parameters[0])
      const communityId = Number(parameters[1])
      const publicId = String(parameters[2])
      const publication = state.publications.find(candidate => (
        candidate.community === communityId
        && candidate.publicId === publicId
        && candidate.active === true
        && candidate.visibility === 'public'
        && candidate.withdrawnAt == null
      ))
      const sermon = publication && state.sermons.find(candidate => (
        candidate.id === publication.sermon
        && candidate.community === publication.community
        && candidate.syncId === publication.syncId
        && candidate.syncArchived !== true
      ))
      const object = publication && state.mediaObjects.find(candidate => (
        candidate.community === communityId && candidate.sha256 === sha256
      ))
      return publication && sermon && object
        ? [{
            schemaVersion: publication.schemaVersion,
            active: publication.active,
            visibility: publication.visibility,
            publicationVersion: publication.publicationVersion,
            publishedAt: publication.publishedAt,
            withdrawnAt: publication.withdrawnAt,
            syncId: publication.syncId,
            publicId: publication.publicId,
            publicRevision: publication.publicRevision,
            publishedDocumentSource: publication.publishedDocumentSource,
            selectedBodyEntryIds: publication.selectedBodyEntryIds,
            selectedMediaIds: publication.selectedMediaIds,
            detailChecksum: publication.detailChecksum,
            detailSource: publication.detailSource,
            catalogItemChecksum: publication.catalogItemChecksum,
            catalogItemSource: publication.catalogItemSource,
            objectCommunityId: object.community,
            objectSha256: object.sha256,
            objectSizeBytes: object.sizeBytes,
            objectMediaType: object.mediaType,
            objectStorageKey: object.storageKey,
          }]
        : []
    }
    if (!text.includes('LEFT JOIN "syncshow_sermon_publications"')) {
      throw new Error(`unexpected direct SQL: ${text}`)
    }
    const communityId = Number(parameters[0])
    return state.sermons
        .filter(sermon => sermon.community === communityId && sermon.syncId != null)
        .filter(sermon => {
          const publication = state.publications.find(row =>
            row.community === communityId
              && row.sermon === sermon.id
              && row.syncId === sermon.syncId)
          return sermon.syncArchived !== true
            && (sermon.syncPublicationStatus === 'ready' || publication?.active === true)
        })
        .slice(0, 1001)
        .map(sermon => {
          const publication = state.publications.find(row =>
            row.community === communityId
              && row.sermon === sermon.id
              && row.syncId === sermon.syncId)
          return {
            sermonRowId: sermon.id,
            syncId: sermon.syncId,
            syncVersion: String(sermon.syncVersion),
            currentRevision: sermon.syncCurrentRevision,
            updatedAt: new Date(sermon.syncChangedAt)
              .toISOString()
              .replace('T', ' ')
              .replace('Z', '+00'),
            archived: sermon.syncArchived,
            title: sermon.title,
            speaker: sermon.speaker,
            serviceDate: new Date(sermon.preachedAt),
            timeZone: state.communities.find(
              community => community.id === sermon.community,
            )?.timeZone,
            publicationStatus: sermon.syncPublicationStatus,
            visibility: sermon.syncVisibility,
            publicationRowId: publication?.id ?? null,
            publicationSchemaVersion: publication?.schemaVersion ?? null,
            publicationActive: publication?.active ?? null,
            publicationVisibility: publication?.visibility ?? null,
            publicationVersion: publication?.publicationVersion ?? null,
            publishedAt: publication
              ? new Date(publication.publishedAt)
                  .toISOString()
                  .replace('T', ' ')
                  .replace('Z', '+00')
              : null,
            withdrawnAt: publication?.withdrawnAt
              ? new Date(publication.withdrawnAt)
                  .toISOString()
                  .replace('T', ' ')
                  .replace('Z', '+00')
              : null,
            publicId: publication?.publicId ?? null,
            publicRevision: publication?.publicRevision ?? null,
            selectedBodyEntryIds: publication?.selectedBodyEntryIds ?? null,
            selectedMediaIds: publication?.selectedMediaIds ?? null,
            detailChecksum: publication?.detailChecksum ?? null,
          }
        })
  }

  const payload = {
    secret: 'publication-endpoint-test-secret',
    config: { cors: '*' },
    logger: { error: () => undefined },
    auth: async ({ headers }: { headers: Headers }) => {
      const authenticated = headers.get('authorization') === 'Community manager-session'
      return { user: authenticated ? { id: 11, systemRole: 'member' } : null }
    },
    db: {
      sessions,
      drizzle: { execute: managerListQuery },
      beginTransaction: async () => {
        const id = state.nextTransactionId
        state.nextTransactionId += 1
        state.transactions += 1
        sessions[String(id)] = {
          db: { execute: query => transactionQuery(query, id) },
        }
        return id
      },
      commitTransaction: async (id: number) => {
        state.commits += 1
        releaseAdvisory(Number(id))
      },
      rollbackTransaction: async (id: number) => {
        state.rollbacks += 1
        releaseAdvisory(Number(id))
      },
    },
    find: async (args: AnyRecord) => {
      const collection = String(args.collection)
      const documents = documentsFor(collection)
        .filter(document => matchesWhere(document, args.where))
      const limit = Number.isSafeInteger(args.limit) ? Number(args.limit) : documents.length
      const docs = documents
        .slice(0, limit)
        .map(document => localApiResult(collection, document, args.showHiddenFields === true))
      if (
        args.collection === 'memberships'
        && state.revokeAfterManagerPreflight
        && docs.length
      ) {
        state.revokeAfterManagerPreflight = false
        state.memberships[0].role = 'member'
      }
      return { docs, totalDocs: documents.length }
    },
    create: async (args: AnyRecord) => {
      const collection = String(args.collection)
      if (collection === 'syncshow-sermon-publications') {
        const row = { id: state.nextPublicationId, ...clone(args.data) }
        state.nextPublicationId += 1
        state.publications.push(row)
        return localApiResult(collection, row, args.showHiddenFields === true)
      }
      if (collection === 'syncshow-sermon-publication-catalogs') {
        const row = { id: state.nextCatalogId, ...clone(args.data) }
        state.nextCatalogId += 1
        state.catalogs.push(row)
        return localApiResult(collection, row, args.showHiddenFields === true)
      }
      if (collection === 'syncshow-sermon-changes') {
        const row = { id: state.nextChangeId, ...clone(args.data) }
        state.nextChangeId += 1
        state.changes.push(row)
        return row
      }
      throw new Error(`unexpected create collection: ${collection}`)
    },
    update: async (args: AnyRecord) => {
      const collection = String(args.collection)
      const document = documentsFor(collection)
        .find(candidate => candidate.id === args.id)
      if (!document) throw new Error(`missing ${collection} ${String(args.id)}`)
      Object.assign(document, clone(args.data))
      return localApiResult(collection, document, args.showHiddenFields === true)
    },
  }

  function managerRequest({
    action = 'publish',
    body,
    syncId = golden.document.id,
    authorization = 'Community manager-session',
  }: {
    action?: 'publish' | 'withdraw' | 'detail' | 'list'
    body?: AnyRecord
    syncId?: string
    authorization?: string
  }) {
    const suffix = action === 'list'
      ? ''
      : action === 'detail'
        ? `/${syncId}`
        : `/${syncId}/${action}`
    return {
      headers: new Headers({
        authorization,
        'content-type': 'application/json',
      }),
      payload,
      routeParams: action === 'list' ? {} : { syncId },
      text: async () => JSON.stringify(body || {}),
      transactionID: undefined,
      url: `http://localhost/api/community/sermon-publications${suffix}`,
    }
  }

  function syncShowRequest({
    method,
    body,
    version,
  }: {
    method: 'put' | 'delete'
    body?: AnyRecord
    version: number
  }) {
    return {
      headers: new Headers({
        authorization: 'SyncShow syncshow-sermon-token',
        'content-type': 'application/json',
        'if-match': `"sermon:${golden.document.id}:${version}"`,
      }),
      payload,
      routeParams: { syncId: golden.document.id },
      text: async () => JSON.stringify(body || {}),
      transactionID: undefined,
      url: `http://localhost/api/community/syncshow/v1/sermons/${golden.document.id}`,
      method,
    }
  }

  function addSecondSermon() {
    const document = clone(golden.document)
    document.id = 'sermon-golden-v3-second'
    document.titles[document.defaultLanguage] = 'A Second Ready Sermon'
    const revision = createSermonRevision(document)
    state.sermons.push({
      ...clone(state.sermons[0]),
      id: 2,
      title: revision.document.titles[revision.document.defaultLanguage],
      syncId: revision.document.id,
      syncCurrentDocumentSource: revision.source,
      syncCurrentRevision: revision.sha256,
      syncCreateIdempotencyKey: 'publication-test-create-second',
      syncCreateIdempotencyHash: 'e'.repeat(64),
    })
    return {
      syncId: revision.document.id,
      revision: revision.sha256,
      documentSource: revision.source,
    }
  }

  function installManagedRecording() {
    const recordingBytes = Buffer.from(
      'Heritage managed sermon publication object\n'.repeat(64),
      'utf8',
    )
    const sha256 = createHash('sha256').update(recordingBytes).digest('hex')
    const slot = {
      id: 'post-service:recording:main',
      kind: 'audio',
      status: 'pending',
      title: 'Sunday sermon recording',
      language: 'en',
      mediaType: 'audio/mpeg',
      fileName: 'faithful-shepherd.mp3',
      sha256,
      sizeBytes: recordingBytes.byteLength,
      durationSeconds: 2484.5,
      url: null,
    }
    const document = clone(golden.document)
    document.media = [...document.media, slot]
    const revision = createSermonRevision(document)
    Object.assign(state.sermons[0], {
      syncCurrentDocumentSource: revision.source,
      syncCurrentRevision: revision.sha256,
      syncPublicationStatus: 'ready',
      syncVisibility: 'private',
    })

    const storageKey = sermonMediaObjectKey(
      sermonMediaCommunityNamespace(7),
      sha256,
    )
    const objectPath = join(managedMediaStorageRoot, storageKey)
    mkdirSync(dirname(objectPath), { recursive: true })
    writeFileSync(objectPath, recordingBytes)
    const object = {
      id: state.mediaObjects.length + 71,
      community: 7,
      sha256,
      sizeBytes: recordingBytes.byteLength,
      mediaType: 'audio/mpeg',
      storageKey,
    }
    const upload = {
      uploadId: 'm'.repeat(43),
      schemaVersion: 1,
      community: 7,
      sermon: 1,
      state: 'complete',
      syncId: golden.document.id,
      expectedSyncVersion: 1,
      expectedCurrentRevision: revision.sha256,
      recordingId: slot.id,
      kind: 'audio',
      language: slot.language,
      mediaType: slot.mediaType,
      fileName: slot.fileName,
      sha256,
      sizeBytes: recordingBytes.byteLength,
      durationSeconds: slot.durationSeconds,
      completedAt: '2026-07-28T13:00:00.000Z',
      objectId: object.id,
    }
    state.mediaObjects.push(object)
    state.mediaUploads.push(upload)
    return { object, objectPath, revision, slot, upload }
  }

  function prepareCurrentSermonAsReady() {
    const document = clone(parseSermonDocument(
      String(state.sermons[0].syncCurrentDocumentSource),
    )) as AnyRecord
    document.publication = {
      status: 'ready',
      visibility: 'private',
      publishedAt: null,
      canonicalUrl: null,
    }
    const revision = createSermonRevision(document)
    state.sermons[0].syncVersion += 1
    Object.assign(state.sermons[0], {
      syncCurrentDocumentSource: revision.source,
      syncCurrentRevision: revision.sha256,
      syncPublicationStatus: 'ready',
      syncVisibility: 'private',
      syncChangedAt: '2026-07-28T14:00:00.000Z',
    })
    return {
      syncId: golden.document.id,
      revision: revision.sha256,
      syncVersion: state.sermons[0].syncVersion,
    }
  }

  return {
    addSecondSermon,
    installManagedRecording,
    managerRequest,
    payload,
    prepareCurrentSermonAsReady,
    state,
    syncShowRequest,
  }
}

function publishIntent(
  source: {
    syncId: string
    revision: string
  } = {
    syncId: golden.document.id,
    revision: golden.revision,
  },
) {
  return {
    schemaVersion: 1,
    action: 'publish',
    syncId: source.syncId,
    expectedSyncVersion: 1,
    expectedCurrentRevision: source.revision,
    expectedPublicationVersion: null,
    expectedPublicRevision: null,
    selectedBodyEntryIds: ['manuscript-opening'],
    selectedMediaIds: [],
    publicAudienceConfirmed: true,
    canonicalLinkConfirmed: true,
  }
}

function publishIntentV2(
  overrides: AnyRecord = {},
): AnyRecord {
  return {
    ...publishIntent(),
    schemaVersion: 2,
    directAudio: {
      url: 'https://media.example.church/sermons/faithful-shepherd.mp3',
      title: 'Sunday sermon recording',
      language: 'en',
      mediaType: 'audio/mpeg',
      durationSeconds: 2484.5,
    },
    recordingRightsAndPrivacyConfirmed: true,
    ...overrides,
  }
}

function publishIntentV3(
  revision: string,
  overrides: AnyRecord = {},
): AnyRecord {
  return {
    ...publishIntent({ syncId: golden.document.id, revision }),
    schemaVersion: 3,
    managedRecordingReviewId: 'm'.repeat(43),
    recordingRightsAndPrivacyConfirmed: true,
    ...overrides,
  }
}

function v1RepublishIntent(
  harness: ReturnType<typeof makeHarness>,
  selectedMediaIds: readonly string[],
) {
  const sermon = harness.state.sermons[0]
  const publication = harness.state.publications[0]
  return {
    schemaVersion: 1,
    action: 'publish',
    syncId: sermon.syncId,
    expectedSyncVersion: sermon.syncVersion,
    expectedCurrentRevision: sermon.syncCurrentRevision,
    expectedPublicationVersion: publication.publicationVersion,
    expectedPublicRevision: publication.publicRevision,
    selectedBodyEntryIds: ['manuscript-opening'],
    selectedMediaIds: [...selectedMediaIds],
    publicAudienceConfirmed: true,
    canonicalLinkConfirmed: true,
  }
}

async function body(response: Response) {
  return await response.json() as AnyRecord
}

async function publicManagedRecordingHead(
  harness: ReturnType<typeof makeHarness>,
  sha256: string,
) {
  const publicId = derivePublicSermonId(golden.document.id)
  return servePublicSermonMedia({
    request: new Request(publicSermonMediaUrl(publicId, sha256), {
      method: 'HEAD',
    }),
    payload: harness.payload,
    communityId: 7,
    publicId,
    sha256,
    head: true,
  })
}

test('authority collections protect rows at the collection boundary without redacting overrideAccess results', async () => {
  for (const collection of [
    SyncShowSermonPublications,
    SyncShowSermonPublicationCatalogs,
  ]) {
    assert.equal(collection.admin?.hidden, true)

    const read = collection.access?.read
    assert.equal(typeof read, 'function')
    assert.equal(await (read as Function)({ req: { user: null } }), false)
    assert.equal(await (read as Function)({
      req: { user: { id: 11, systemRole: 'member' } },
    }), false)
    assert.equal(await (read as Function)({
      req: { user: { id: 12, systemRole: 'system-admin' } },
    }), true)

    for (const action of ['create', 'update', 'delete'] as const) {
      const access = collection.access?.[action]
      assert.equal(typeof access, 'function')
      assert.equal(await (access as Function)({ req: { user: null } }), false)
    }

    for (const field of collection.fields) {
      assert.equal(
        'access' in field,
        false,
        `${collection.slug}.${'name' in field ? field.name : field.type} must not redact internal rows`,
      )
    }
  }
})

test('manager transition retains exact immutable published source and rejects malformed audit state', () => {
  const publishedAt = '2026-07-29T00:00:00.000Z'
  const transition = buildManagerSermonPublicationTransition({
    documentSource: golden.canonicalSource,
    publishedAt,
    selectedBodyEntryIds: ['manuscript-opening'],
    selectedMediaIds: [],
  })
  assert.equal(transition.document.publication.status, 'published')
  assert.equal(transition.document.publication.visibility, 'public')
  assert.equal(transition.document.publication.publishedAt, publishedAt)
  assert.notEqual(transition.documentSource, golden.canonicalSource)

  const catalogItemSource = serializePublicSermonCatalogItem(
    transition.projection.catalogItem,
  )
  const stored = {
    schemaVersion: 1,
    active: true,
    visibility: 'public',
    publicationVersion: 1,
    publishedAt,
    withdrawnAt: null,
    syncId: golden.document.id,
    publicId: transition.projection.detail.publicId,
    publicRevision: transition.publicRevision,
    publishedDocumentSource: transition.documentSource,
    selectedBodyEntryIds: transition.selectedBodyEntryIds,
    selectedMediaIds: transition.selectedMediaIds,
    detailChecksum: transition.projection.detailChecksum,
    detailSource: transition.projection.detailSource,
    catalogItemChecksum: createHash('sha256')
      .update(catalogItemSource, 'utf8')
      .digest('hex'),
    catalogItemSource,
  }
  assert.equal(
    normalizeStoredManagerSermonPublication(stored).publishedDocumentSource,
    transition.documentSource,
  )
  assert.equal(
    nextCanonicalPublicationTime(
      '2099-01-01T00:00:00.000Z',
      new Date('2026-01-01T00:00:00.000Z'),
    ),
    '2099-01-01T00:00:00.001Z',
  )
  const corrupted = { ...stored, publishedDocumentSource: `${transition.documentSource} ` }
  assert.throws(
    () => normalizeStoredManagerSermonPublication(corrupted),
    /audit identity/i,
  )
})

test('schema 3 intent and transition bind only the exact reviewed managed slot', () => {
  const normalized = normalizeManagerSermonPublishIntent(
    publishIntentV3(golden.revision),
  )
  assert.equal(normalized.schemaVersion, 3)
  assert.equal(normalized.managedRecordingReviewId, 'm'.repeat(43))
  assert.equal('directAudio' in normalized, false)
  assert.throws(
    () => normalizeManagerSermonPublishIntent(publishIntentV3(golden.revision, {
      directAudio: publishIntentV2().directAudio,
    })),
    /unsupported field/i,
  )
  assert.throws(
    () => normalizeManagerSermonPublishIntent({
      ...publishIntentV2(),
      managedRecordingReviewId: 'm'.repeat(43),
    }),
    /unsupported field/i,
  )

  const slot = {
    id: 'post-service:recording:main',
    kind: 'audio',
    status: 'pending',
    title: 'Sunday sermon recording',
    language: 'en',
    mediaType: 'audio/mpeg',
    fileName: 'faithful-shepherd.mp3',
    sha256: 'b'.repeat(64),
    sizeBytes: 8192,
    durationSeconds: 2484.5,
    url: null,
  }
  const document = clone(golden.document)
  document.media.push(slot)
  const revision = createSermonRevision(document)
  const url = publicSermonMediaUrl(
    derivePublicSermonId(golden.document.id),
    slot.sha256,
  )
  const transition = buildManagerSermonPublicationTransition({
    documentSource: revision.source,
    publishedAt: '2026-07-29T00:00:00.000Z',
    selectedBodyEntryIds: ['manuscript-opening'],
    selectedMediaIds: [],
    managedRecording: {
      slotId: slot.id,
      title: slot.title,
      language: slot.language,
      mediaType: slot.mediaType as 'audio/mpeg',
      fileName: slot.fileName,
      sha256: slot.sha256,
      sizeBytes: slot.sizeBytes,
      durationSeconds: slot.durationSeconds,
      url,
    },
  })
  assert.deepEqual(transition.selectedMediaIds, [slot.id])
  assert.deepEqual(transition.document.media[0], {
    ...slot,
    status: 'ready',
    url,
  })
  assert.deepEqual(transition.projection.detail.media, [{
    kind: 'audio',
    title: slot.title,
    language: slot.language,
    mediaType: slot.mediaType,
    durationSeconds: slot.durationSeconds,
    url,
  }])

  assert.throws(
    () => buildManagerSermonPublicationTransition({
      documentSource: revision.source,
      publishedAt: '2026-07-29T00:00:00.000Z',
      selectedBodyEntryIds: ['manuscript-opening'],
      selectedMediaIds: [],
      managedRecording: {
        slotId: slot.id,
        title: slot.title,
        language: slot.language,
        mediaType: 'audio/mpeg',
        fileName: slot.fileName,
        sha256: slot.sha256,
        sizeBytes: 1_073_741_825,
        durationSeconds: slot.durationSeconds,
        url,
      },
    }),
    /1073741824 bytes/i,
  )
})

test('manager transition appends and selects one deterministic direct recording without leaking private media fields', () => {
  const directAudio = publishIntentV2().directAudio
  const mediaId = deriveManagerDirectAudioId(directAudio)
  const transition = buildManagerSermonPublicationTransition({
    documentSource: golden.canonicalSource,
    publishedAt: '2026-07-29T00:00:00.000Z',
    selectedBodyEntryIds: ['manuscript-opening'],
    selectedMediaIds: [],
    directAudio,
  })

  assert.deepEqual(transition.selectedMediaIds, [mediaId])
  assert.deepEqual(transition.document.media.at(-1), {
    id: mediaId,
    kind: 'audio',
    status: 'ready',
    title: 'Sunday sermon recording',
    language: 'en',
    mediaType: 'audio/mpeg',
    fileName: null,
    sha256: null,
    sizeBytes: null,
    durationSeconds: 2484.5,
    url: 'https://media.example.church/sermons/faithful-shepherd.mp3',
  })
  assert.deepEqual(transition.projection.detail.media, [{
    kind: 'audio',
    title: 'Sunday sermon recording',
    language: 'en',
    mediaType: 'audio/mpeg',
    durationSeconds: 2484.5,
    url: 'https://media.example.church/sermons/faithful-shepherd.mp3',
  }])

  const correctable = clone(golden.document)
  correctable.media.push({
    ...transition.document.media.at(-1),
    title: 'Uncorrected recording title',
    language: 'ru',
    mediaType: 'audio/mp4',
    durationSeconds: null,
  })
  const correctionRevision = createSermonRevision(correctable)
  const corrected = buildManagerSermonPublicationTransition({
    documentSource: correctionRevision.source,
    publishedAt: '2026-07-29T00:00:00.000Z',
    selectedBodyEntryIds: ['manuscript-opening'],
    selectedMediaIds: [],
    directAudio,
  })
  assert.equal(corrected.document.media.length, 1)
  assert.deepEqual(corrected.document.media[0], transition.document.media.at(-1))
  assert.deepEqual(corrected.selectedMediaIds, [mediaId])

  assert.throws(
    () => buildManagerSermonPublicationTransition({
      documentSource: correctionRevision.source,
      publishedAt: '2026-07-29T00:00:00.000Z',
      selectedBodyEntryIds: [],
      selectedMediaIds: [mediaId],
    }),
    /audio requires at least one selected written sermon section/i,
  )

  const conflicting = clone(golden.document)
  conflicting.media.push({
    ...transition.document.media.at(-1),
    url: 'https://media.example.church/sermons/different.mp3',
  })
  const conflictRevision = createSermonRevision(conflicting)
  assert.throws(
    () => buildManagerSermonPublicationTransition({
      documentSource: conflictRevision.source,
      publishedAt: '2026-07-29T00:00:00.000Z',
      selectedBodyEntryIds: ['manuscript-opening'],
      selectedMediaIds: [],
      directAudio,
    }),
    /deterministic direct recording ID already belongs to different media/,
  )
})

test('v2 endpoint atomically publishes the direct recording into current, receipt, detail, and journal', async () => {
  const harness = makeHarness()
  const intent = publishIntentV2()
  const mediaId = deriveManagerDirectAudioId(intent.directAudio)
  const response = await publishSermon(harness.managerRequest({
    body: intent,
  }) as never)

  assert.equal(response.status, 200)
  const document = parseSermonDocument(
    String(harness.state.sermons[0].syncCurrentDocumentSource),
  )
  assert.equal(document.media.at(-1)?.id, mediaId)
  assert.equal(document.media.at(-1)?.url, intent.directAudio.url)
  assert.deepEqual(harness.state.publications[0].selectedMediaIds, [mediaId])
  const detail = JSON.parse(String(harness.state.publications[0].detailSource))
  assert.equal(detail.media[0].url, intent.directAudio.url)
  assert.equal('id' in detail.media[0], false)
  assert.equal('fileName' in detail.media[0], false)
  assert.equal('sha256' in detail.media[0], false)
  assert.equal(
    harness.state.changes[0].documentSource,
    harness.state.sermons[0].syncCurrentDocumentSource,
  )
  assert.equal(
    createHash('sha256')
      .update(String(harness.state.changes[0].documentSource), 'utf8')
      .digest('hex'),
    harness.state.changes[0].revision,
  )
})

test('v3 endpoint atomically publishes one reviewed managed object with its exact canonical descriptor', async () => {
  const harness = makeHarness()
  const installed = harness.installManagedRecording()
  const intent = publishIntentV3(installed.revision.sha256)
  const response = await publishSermon(harness.managerRequest({ body: intent }) as never)

  assert.equal(response.status, 200)
  const receipt = await body(response)
  const expectedUrl = publicSermonMediaUrl(
    derivePublicSermonId(golden.document.id),
    installed.slot.sha256,
  )
  const document = parseSermonDocument(
    String(harness.state.sermons[0].syncCurrentDocumentSource),
  )
  assert.deepEqual(document.media[0], {
    ...installed.slot,
    status: 'ready',
    url: expectedUrl,
  })
  assert.deepEqual(harness.state.publications[0].selectedMediaIds, [installed.slot.id])
  assert.equal(
    harness.state.publications[0].publishedDocumentSource,
    harness.state.sermons[0].syncCurrentDocumentSource,
  )
  const detail = JSON.parse(String(harness.state.publications[0].detailSource))
  assert.deepEqual(detail.media, [{
    kind: 'audio',
    title: installed.slot.title,
    language: installed.slot.language,
    mediaType: installed.slot.mediaType,
    durationSeconds: installed.slot.durationSeconds,
    url: expectedUrl,
  }])
  assert.equal(expectedUrl.includes(installed.upload.uploadId), false)
  assert.equal(expectedUrl.includes(String(installed.object.id)), false)
  assert.equal(expectedUrl.includes(installed.object.storageKey), false)
  assert.equal(JSON.stringify(receipt).includes(installed.upload.uploadId), false)
  assert.equal(
    String(harness.state.publications[0].publishedDocumentSource)
      .includes(installed.upload.uploadId),
    false,
  )
  assert.equal(harness.state.commits, 1)
  assert.equal(harness.state.rollbacks, 0)
})

test('v3 stale, historical, cross-tenant, corrupt, or unavailable recording authority rolls back before writes', async () => {
  const cases: Array<[
    string,
    number,
    string,
    (installed: ReturnType<ReturnType<typeof makeHarness>['installManagedRecording']>) => void,
  ]> = [
    ['stale revision', 409, 'MANAGED_RECORDING_NOT_PUBLISHABLE', installed => {
      installed.upload.expectedSyncVersion = 2
    }],
    ['superseded upload', 409, 'MANAGED_RECORDING_NOT_PUBLISHABLE', installed => {
      installed.upload.state = 'superseded'
    }],
    ['cross-tenant upload', 404, 'MANAGED_RECORDING_NOT_FOUND', installed => {
      installed.upload.community = 8
      installed.object.community = 8
    }],
    ['corrupt object tuple', 500, 'INVALID_MANAGED_RECORDING_STATE', installed => {
      installed.object.sizeBytes += 1
    }],
    ['wrong-size private object', 503, 'STORAGE_UNAVAILABLE', installed => {
      writeFileSync(installed.objectPath, Buffer.from('truncated', 'utf8'))
    }],
  ]

  for (const [label, expectedStatus, expectedCode, mutate] of cases) {
    const harness = makeHarness()
    const installed = harness.installManagedRecording()
    mutate(installed)
    const response = await publishSermon(harness.managerRequest({
      body: publishIntentV3(installed.revision.sha256),
    }) as never)
    assert.equal(response.status, expectedStatus, label)
    assert.equal((await body(response)).code, expectedCode, label)
    assert.equal(harness.state.sermons[0].syncVersion, 1, label)
    assert.equal(harness.state.sermons[0].syncPublicationStatus, 'ready', label)
    assert.equal(harness.state.publications.length, 0, label)
    assert.equal(harness.state.changes.length, 0, label)
    assert.equal(harness.state.commits, 0, label)
    assert.equal(harness.state.rollbacks, 1, label)
  }
})

test('v2 endpoint rejects unsafe or unconfirmed direct recording requests before mutation', async () => {
  const cases: Array<[string, AnyRecord]> = [
    ['HTTP URL', {
      directAudio: {
        ...publishIntentV2().directAudio,
        url: 'http://media.example.church/sermon.mp3',
      },
    }],
    ['query string', {
      directAudio: {
        ...publishIntentV2().directAudio,
        url: 'https://media.example.church/sermon.mp3?signature=secret',
      },
    }],
    ['private IP', {
      directAudio: {
        ...publishIntentV2().directAudio,
        url: 'https://127.0.0.1/sermon.mp3',
      },
    }],
    ['reserved host', {
      directAudio: {
        ...publishIntentV2().directAudio,
        url: 'https://media.church.example/sermon.mp3',
      },
    }],
    ['unsupported type', {
      directAudio: {
        ...publishIntentV2().directAudio,
        mediaType: 'application/octet-stream',
      },
    }],
    ['missing rights confirmation', {
      recordingRightsAndPrivacyConfirmed: false,
    }],
    ['missing written alternative', {
      selectedBodyEntryIds: [],
    }],
    ['version 2 without a recording', {
      directAudio: null,
      recordingRightsAndPrivacyConfirmed: false,
    }],
  ]

  for (const [label, overrides] of cases) {
    const harness = makeHarness()
    const response = await publishSermon(harness.managerRequest({
      body: publishIntentV2(overrides),
    }) as never)
    assert.equal(response.status, 400, label)
    assert.equal((await body(response)).code, 'INVALID_PUBLICATION_INTENT', label)
    assert.equal(harness.state.sermons[0].syncVersion, 1, label)
    assert.equal(harness.state.publications.length, 0, label)
    assert.equal(harness.state.changes.length, 0, label)
    assert.equal(harness.state.transactions, 0, label)
  }
})

test('v1 and v2 cannot bootstrap valid or malformed URLs in the reserved managed-media namespace', async () => {
  const publicId = derivePublicSermonId(golden.document.id)
  const sha256 = 'c'.repeat(64)
  const reservedUrls = [
    publicSermonMediaUrl(publicId, sha256),
    'https://community.example.church/content/sermon-media',
    'https://community.example.church/content/%73ermon-media/not-valid/not-valid',
    'https://community.example.church/content/sermon-media%ZZ',
  ]

  for (const url of reservedUrls) {
    const v1Harness = makeHarness()
    const forged = clone(golden.document)
    forged.media.push({
      id: 'forged-managed-recording',
      kind: 'audio',
      status: 'ready',
      title: 'Unreviewed managed recording',
      language: 'en',
      mediaType: 'audio/mpeg',
      fileName: 'unreviewed.mp3',
      sha256,
      sizeBytes: 4096,
      durationSeconds: 120,
      url,
    })
    const revision = createSermonRevision(forged)
    Object.assign(v1Harness.state.sermons[0], {
      syncCurrentDocumentSource: revision.source,
      syncCurrentRevision: revision.sha256,
    })
    const v1 = await publishSermon(v1Harness.managerRequest({
      body: {
        ...publishIntent({
          syncId: golden.document.id,
          revision: revision.sha256,
        }),
        selectedMediaIds: ['forged-managed-recording'],
      },
    }) as never)
    assert.equal(v1.status, 409, url)
    assert.equal((await body(v1)).code, 'MANAGED_RECORDING_REVIEW_REQUIRED', url)
    assert.equal(v1Harness.state.publications.length, 0, url)
    assert.equal(v1Harness.state.changes.length, 0, url)
    assert.equal(v1Harness.state.rollbacks, 1, url)

    const v2Harness = makeHarness()
    const v2 = await publishSermon(v2Harness.managerRequest({
      body: publishIntentV2({
        directAudio: {
          ...publishIntentV2().directAudio,
          url,
        },
      }),
    }) as never)
    assert.equal(v2.status, 409, url)
    assert.equal((await body(v2)).code, 'MANAGED_RECORDING_REVIEW_REQUIRED', url)
    assert.equal(v2Harness.state.publications.length, 0, url)
    assert.equal(v2Harness.state.changes.length, 0, url)
    assert.equal(v2Harness.state.rollbacks, 1, url)
  }
})

test('v1 preserves an exact active managed binding only while its locked private object remains readable', async () => {
  const harness = makeHarness()
  const installed = harness.installManagedRecording()
  const first = await publishSermon(harness.managerRequest({
    body: publishIntentV3(installed.revision.sha256),
  }) as never)
  assert.equal(first.status, 200)
  const firstMedia = clone(parseSermonDocument(
    String(harness.state.publications[0].publishedDocumentSource),
  ).media[0])
  harness.prepareCurrentSermonAsReady()

  const preserved = await publishSermon(harness.managerRequest({
    body: v1RepublishIntent(harness, [installed.slot.id]),
  }) as never)
  assert.equal(preserved.status, 200)
  assert.equal(harness.state.publications[0].publicationVersion, 2)
  assert.deepEqual(harness.state.publications[0].selectedMediaIds, [installed.slot.id])
  assert.deepEqual(parseSermonDocument(
    String(harness.state.publications[0].publishedDocumentSource),
  ).media[0], firstMedia)

  const unavailableHarness = makeHarness()
  const unavailable = unavailableHarness.installManagedRecording()
  assert.equal((await publishSermon(unavailableHarness.managerRequest({
    body: publishIntentV3(unavailable.revision.sha256),
  }) as never)).status, 200)
  unavailableHarness.prepareCurrentSermonAsReady()
  writeFileSync(unavailable.objectPath, Buffer.from('truncated', 'utf8'))
  const failed = await publishSermon(unavailableHarness.managerRequest({
    body: v1RepublishIntent(unavailableHarness, [unavailable.slot.id]),
  }) as never)
  assert.equal(failed.status, 503)
  assert.equal((await body(failed)).code, 'STORAGE_UNAVAILABLE')
  assert.equal(unavailableHarness.state.publications[0].publicationVersion, 1)
  assert.equal(unavailableHarness.state.sermons[0].syncVersion, 3)
  assert.equal(unavailableHarness.state.changes.length, 1)
  assert.equal(unavailableHarness.state.commits, 1)
  assert.equal(unavailableHarness.state.rollbacks, 1)
})

test('v1 rejects inactive or descriptor-drifted managed bindings without partial writes', async () => {
  const inactiveHarness = makeHarness()
  const inactive = inactiveHarness.installManagedRecording()
  assert.equal((await publishSermon(inactiveHarness.managerRequest({
    body: publishIntentV3(inactive.revision.sha256),
  }) as never)).status, 200)
  inactiveHarness.prepareCurrentSermonAsReady()
  Object.assign(inactiveHarness.state.publications[0], {
    active: false,
    publicationVersion: 2,
    withdrawnAt: '2099-01-01T00:00:00.000Z',
  })
  const inactiveResponse = await publishSermon(inactiveHarness.managerRequest({
    body: v1RepublishIntent(inactiveHarness, [inactive.slot.id]),
  }) as never)
  assert.equal(inactiveResponse.status, 409)
  assert.equal((await body(inactiveResponse)).code, 'MANAGED_RECORDING_REVIEW_REQUIRED')
  assert.equal(inactiveHarness.state.publications[0].publicationVersion, 2)
  assert.equal(inactiveHarness.state.changes.length, 1)

  const driftCases: Array<[
    string,
    (media: AnyRecord) => void,
  ]> = [
    ['slot id', media => { media.id = 'post-service:recording:alternate' }],
    ['hash', media => { media.sha256 = 'd'.repeat(64) }],
    ['size', media => { media.sizeBytes += 1 }],
    ['type', media => { media.mediaType = 'audio/mp4' }],
    ['title', media => { media.title = 'Changed recording title' }],
    ['file name', media => { media.fileName = 'changed-recording.mp3' }],
    ['language', media => { media.language = 'ru' }],
    ['duration', media => { media.durationSeconds += 1 }],
    ['status', media => { media.status = 'processing' }],
    ['url', media => {
      media.url = publicSermonMediaUrl(
        derivePublicSermonId(golden.document.id),
        'e'.repeat(64),
      )
    }],
  ]
  for (const [label, mutate] of driftCases) {
    const harness = makeHarness()
    const installed = harness.installManagedRecording()
    assert.equal((await publishSermon(harness.managerRequest({
      body: publishIntentV3(installed.revision.sha256),
    }) as never)).status, 200, label)
    harness.prepareCurrentSermonAsReady()
    const document = clone(parseSermonDocument(
      String(harness.state.sermons[0].syncCurrentDocumentSource),
    ))
    mutate(document.media[0])
    const revision = createSermonRevision(document)
    Object.assign(harness.state.sermons[0], {
      syncCurrentDocumentSource: revision.source,
      syncCurrentRevision: revision.sha256,
    })
    const response = await publishSermon(harness.managerRequest({
      body: v1RepublishIntent(harness, [document.media[0].id]),
    }) as never)
    assert.equal(response.status, 409, label)
    assert.equal((await body(response)).code, 'MANAGED_RECORDING_REVIEW_REQUIRED', label)
    assert.equal(harness.state.publications[0].publicationVersion, 1, label)
    assert.equal(harness.state.changes.length, 1, label)
    assert.equal(harness.state.commits, 1, label)
    assert.equal(harness.state.rollbacks, 1, label)
  }
})

test('deselecting or externally replacing a managed binding immediately removes public byte authority', async () => {
  const harness = makeHarness()
  const installed = harness.installManagedRecording()
  assert.equal((await publishSermon(harness.managerRequest({
    body: publishIntentV3(installed.revision.sha256),
  }) as never)).status, 200)
  assert.equal((await publicManagedRecordingHead(harness, installed.slot.sha256)).status, 200)

  harness.prepareCurrentSermonAsReady()
  const deselected = await publishSermon(harness.managerRequest({
    body: v1RepublishIntent(harness, []),
  }) as never)
  assert.equal(deselected.status, 200)
  assert.deepEqual(harness.state.publications[0].selectedMediaIds, [])
  assert.equal((await publicManagedRecordingHead(harness, installed.slot.sha256)).status, 404)

  harness.prepareCurrentSermonAsReady()
  const replaceIntent = {
    ...v1RepublishIntent(harness, []),
    schemaVersion: 2,
    directAudio: publishIntentV2().directAudio,
    recordingRightsAndPrivacyConfirmed: true,
  }
  const replaced = await publishSermon(harness.managerRequest({
    body: replaceIntent,
  }) as never)
  assert.equal(replaced.status, 200)
  assert.deepEqual(
    harness.state.publications[0].selectedMediaIds,
    [deriveManagerDirectAudioId(replaceIntent.directAudio)],
  )
  assert.equal((await publicManagedRecordingHead(harness, installed.slot.sha256)).status, 404)

  const conflictHarness = makeHarness()
  const conflict = conflictHarness.installManagedRecording()
  assert.equal((await publishSermon(conflictHarness.managerRequest({
    body: publishIntentV3(conflict.revision.sha256),
  }) as never)).status, 200)
  conflictHarness.prepareCurrentSermonAsReady()
  const mixed = await publishSermon(conflictHarness.managerRequest({
    body: {
      ...v1RepublishIntent(conflictHarness, [conflict.slot.id]),
      schemaVersion: 2,
      directAudio: publishIntentV2().directAudio,
      recordingRightsAndPrivacyConfirmed: true,
    },
  }) as never)
  assert.equal(mixed.status, 409)
  assert.equal((await body(mixed)).code, 'MANAGED_RECORDING_SELECTION_CONFLICT')
  assert.equal(conflictHarness.state.publications[0].publicationVersion, 1)
})

test('direct recording ID collisions roll back without partial publication writes', async () => {
  const harness = makeHarness()
  const directAudio = publishIntentV2().directAudio
  const mediaId = deriveManagerDirectAudioId(directAudio)
  const conflicting = clone(golden.document)
  conflicting.media.push({
    id: mediaId,
    kind: 'audio',
    status: 'ready',
    title: 'Different recording',
    language: 'en',
    mediaType: 'audio/mpeg',
    fileName: null,
    sha256: null,
    sizeBytes: null,
    durationSeconds: null,
    url: 'https://media.example.church/sermons/different.mp3',
  })
  const revision = createSermonRevision(conflicting)
  harness.state.sermons[0].syncCurrentDocumentSource = revision.source
  harness.state.sermons[0].syncCurrentRevision = revision.sha256

  const response = await publishSermon(harness.managerRequest({
    body: publishIntentV2({ expectedCurrentRevision: revision.sha256 }),
  }) as never)

  assert.equal(response.status, 409)
  assert.equal((await body(response)).code, 'DIRECT_AUDIO_ID_CONFLICT')
  assert.equal(harness.state.sermons[0].syncVersion, 1)
  assert.equal(harness.state.publications.length, 0)
  assert.equal(harness.state.changes.length, 0)
  assert.equal(harness.state.commits, 0)
  assert.equal(harness.state.rollbacks, 1)
})

test('unsafe selected canonical media returns a client error and rolls back atomically', async () => {
  const harness = makeHarness()
  const unsafe = clone(golden.document)
  unsafe.media.push({
    id: 'unsafe-existing-audio',
    kind: 'audio',
    status: 'ready',
    title: 'Expiring recording link',
    language: 'en',
    mediaType: 'audio/mpeg',
    fileName: null,
    sha256: null,
    sizeBytes: null,
    durationSeconds: null,
    url: 'https://media.example.church/sermons/service.mp3?token=temporary',
  })
  const revision = createSermonRevision(unsafe)
  harness.state.sermons[0].syncCurrentDocumentSource = revision.source
  harness.state.sermons[0].syncCurrentRevision = revision.sha256

  const response = await publishSermon(harness.managerRequest({
    body: {
      ...publishIntent({
        syncId: golden.document.id,
        revision: revision.sha256,
      }),
      selectedMediaIds: ['unsafe-existing-audio'],
    },
  }) as never)

  assert.equal(response.status, 400)
  assert.equal((await body(response)).code, 'PUBLIC_MEDIA_NOT_READY')
  assert.equal(harness.state.sermons[0].syncVersion, 1)
  assert.equal(harness.state.publications.length, 0)
  assert.equal(harness.state.changes.length, 0)
  assert.equal(harness.state.commits, 0)
  assert.equal(harness.state.rollbacks, 1)
})

test('two concurrent Ready publishes serialize; one wins and one fails both CAS guards', async () => {
  const harness = makeHarness()
  const request = () => harness.managerRequest({ body: publishIntent() })
  const responses = await Promise.all([
    publishSermon(request() as never),
    publishSermon(request() as never),
  ])
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 412])
  const conflict = responses.find(response => response.status === 412)!
  assert.equal((await body(conflict)).code, 'SERMON_VERSION_CONFLICT')
  assert.equal(harness.state.sermons[0].syncVersion, 2)
  assert.equal(harness.state.sermons[0].syncPublicationStatus, 'published')
  assert.equal(
    harness.state.sermons[0].preachedAt,
    `${golden.document.serviceDate}T19:00:00.000Z`,
  )
  assert.equal(harness.state.publications.length, 1)
  assert.equal(harness.state.changes.length, 1)
  assert.equal(harness.state.catalogs[0].generation, 2)
  assert.equal(parsePublicSermonCatalogSource(harness.state.catalogs[0].source).items.length, 1)
  assert.equal(
    harness.state.changes[0].documentSource,
    harness.state.sermons[0].syncCurrentDocumentSource,
  )
  assert.equal(
    createHash('sha256')
      .update(String(harness.state.changes[0].documentSource), 'utf8')
      .digest('hex'),
    harness.state.changes[0].revision,
  )

  const publication = normalizeStoredManagerSermonPublication(
    publicationFieldsFromPayload(harness.state.publications[0]),
  )
  assert.equal(publication.publishedDocumentSource, harness.state.sermons[0].syncCurrentDocumentSource)
  assert.equal(publication.publicRevision, harness.state.sermons[0].syncCurrentRevision)
  assert.equal(publication.detailSource.includes('providedBy'), false)
  assert.equal(publication.detailSource.includes('fileName'), false)
})

test('two concurrent different-sermon publishes preserve both materialized catalog items', async () => {
  const harness = makeHarness()
  const second = harness.addSecondSermon()
  const responses = await Promise.all([
    publishSermon(harness.managerRequest({
      body: publishIntent(),
      syncId: golden.document.id,
    }) as never),
    publishSermon(harness.managerRequest({
      body: publishIntent(second),
      syncId: second.syncId,
    }) as never),
  ])
  assert.deepEqual(responses.map(response => response.status), [200, 200])
  assert.equal(harness.state.publications.length, 2)
  assert.equal(harness.state.catalogs[0].generation, 3)
  const catalog = parsePublicSermonCatalogSource(harness.state.catalogs[0].source)
  assert.deepEqual(
    new Set(catalog.items.map(item => item.sermonId)),
    new Set([golden.document.id, second.syncId]),
  )
})

test('manager publication makes an old SyncShow write stale', async () => {
  const harness = makeHarness()
  assert.equal((await publishSermon(harness.managerRequest({
    body: publishIntent(),
  }) as never)).status, 200)

  const stale = await updateFromSyncShow(harness.syncShowRequest({
    method: 'put',
    version: 1,
    body: {
      syncId: golden.document.id,
      revision: golden.revision,
      documentSource: golden.canonicalSource,
    },
  }) as never)
  assert.equal(stale.status, 412)
  assert.equal((await body(stale)).code, 'VERSION_CONFLICT')
  assert.equal(harness.state.sermons[0].syncVersion, 2)
  assert.equal(harness.state.publications[0].active, true)
  assert.equal(harness.state.changes.length, 1)
})

test('withdraw and archive atomically deactivate the pointer and materialized catalog', async () => {
  const withdrawnHarness = makeHarness()
  const published = await publishSermon(withdrawnHarness.managerRequest({
    body: publishIntent(),
  }) as never)
  const publishedBody = await body(published)
  const withdrawIntent = {
    schemaVersion: 1,
    action: 'withdraw',
    syncId: golden.document.id,
    expectedSyncVersion: publishedBody.sermon.syncVersion,
    expectedCurrentRevision: publishedBody.sermon.currentRevision,
    expectedPublicationVersion: publishedBody.publication.publicationVersion,
    expectedPublicRevision: publishedBody.publication.publicRevision,
  }
  const withdrawn = await withdrawSermon(withdrawnHarness.managerRequest({
    action: 'withdraw',
    body: withdrawIntent,
  }) as never)
  assert.equal(withdrawn.status, 200)
  const withdrawnBody = await body(withdrawn)
  assert.equal(withdrawnBody.publication.active, false)
  assert.equal(withdrawnBody.publication.publicationVersion, 2)
  assert.equal(withdrawnHarness.state.sermons[0].syncVersion, 2)
  assert.equal(withdrawnHarness.state.catalogs[0].generation, 3)
  assert.equal(
    parsePublicSermonCatalogSource(withdrawnHarness.state.catalogs[0].source).items.length,
    0,
  )

  const archivedHarness = makeHarness()
  assert.equal((await publishSermon(archivedHarness.managerRequest({
    body: publishIntent(),
  }) as never)).status, 200)
  const archived = await archiveFromSyncShow(archivedHarness.syncShowRequest({
    method: 'delete',
    version: 2,
  }) as never)
  assert.equal(archived.status, 200)
  assert.equal(archivedHarness.state.sermons[0].syncArchived, true)
  assert.equal(archivedHarness.state.sermons[0].syncVersion, 3)
  assert.equal(archivedHarness.state.publications[0].active, false)
  assert.equal(archivedHarness.state.publications[0].publicationVersion, 2)
  assert.equal(archivedHarness.state.catalogs[0].generation, 3)
  assert.equal(
    parsePublicSermonCatalogSource(archivedHarness.state.catalogs[0].source).items.length,
    0,
  )
  assert.equal(archivedHarness.state.changes.length, 2)
})

test('service tokens cannot approve publication and the transaction rechecks live manager role', async () => {
  const serviceHarness = makeHarness()
  const serviceResponse = await publishSermon(serviceHarness.managerRequest({
    body: publishIntent(),
    authorization: 'SyncShow syncshow-sermon-token',
  }) as never)
  assert.equal(serviceResponse.status, 401)
  assert.equal((await body(serviceResponse)).code, 'COMMUNITY_AUTH_REQUIRED')
  assert.equal(serviceHarness.state.transactions, 0)

  const revokedHarness = makeHarness()
  revokedHarness.state.revokeAfterManagerPreflight = true
  const revoked = await publishSermon(revokedHarness.managerRequest({
    body: publishIntent(),
  }) as never)
  assert.equal(revoked.status, 403)
  assert.equal((await body(revoked)).code, 'MANAGER_REQUIRED')
  assert.equal(revokedHarness.state.publications.length, 0)
  assert.equal(revokedHarness.state.rollbacks, 1)
})

test('manager list is bounded metadata while detail validates the exact canonical source', async () => {
  const harness = makeHarness()
  const list = await listPublicationReview(harness.managerRequest({
    action: 'list',
  }) as never)
  assert.equal(list.status, 200)
  const listBody = await body(list)
  assert.deepEqual(Object.keys(listBody), ['schemaVersion', 'items'])
  assert.equal(listBody.items.length, 1)
  assert.equal('documentSource' in listBody.items[0], false)
  assert.equal(listBody.items[0].publicationStatus, 'ready')
  assert.equal(listBody.items[0].serviceDate, golden.document.serviceDate)

  harness.state.communities[0].timeZone = 'Pacific/Kiritimati'
  harness.state.sermons[0].preachedAt = payloadPreachedAtForServiceDate(
    golden.document.serviceDate,
    'Pacific/Kiritimati',
  )
  const easternList = await listPublicationReview(harness.managerRequest({
    action: 'list',
  }) as never)
  assert.equal(easternList.status, 200)
  assert.equal((await body(easternList)).items[0].serviceDate, golden.document.serviceDate)

  const detail = await getPublicationReview(harness.managerRequest({
    action: 'detail',
  }) as never)
  assert.equal(detail.status, 200)
  assert.equal((await body(detail)).sermon.documentSource, golden.canonicalSource)

  harness.state.sermons[0].syncCurrentDocumentSource = '{"corrupt":true}\n'
  const stillBounded = await listPublicationReview(harness.managerRequest({
    action: 'list',
  }) as never)
  assert.equal(stillBounded.status, 200)
  const invalidDetail = await getPublicationReview(harness.managerRequest({
    action: 'detail',
  }) as never)
  assert.equal(invalidDetail.status, 500)
})

test('irrelevant private drafts do not consume the bounded publication review queue', async () => {
  const harness = makeHarness()
  for (let index = 0; index < 1100; index += 1) {
    harness.state.sermons.push({
      ...clone(harness.state.sermons[0]),
      id: index + 2,
      syncId: `private-draft-${String(index).padStart(4, '0')}`,
      syncPublicationStatus: 'draft',
      syncCurrentRevision: index.toString(16).padStart(64, '0'),
    })
  }
  const response = await listPublicationReview(harness.managerRequest({
    action: 'list',
  }) as never)
  assert.equal(response.status, 200)
  const responseBody = await body(response)
  assert.deepEqual(responseBody.items.map((item: AnyRecord) => item.syncId), [
    golden.document.id,
  ])
})
