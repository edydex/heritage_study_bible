import { createHash, randomUUID } from 'node:crypto'
import {
  headersWithCors,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import serviceCore from '../../packages/service-core/node.js'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import {
  serializeSongForSync,
  SYNCSHOW_SERVICE_DOCUMENT_READ_SCOPE,
  SYNCSHOW_SERVICE_DOCUMENT_WRITE_SCOPE,
  SyncShowProtocolError,
} from '@/lib/syncShowProtocol'
import {
  HeritageServiceBibleLookupError,
  loadHeritageServiceBiblePassage,
} from '@/lib/syncshow/HeritageServiceBibleLookup'
import { CANONICAL_BIBLE_BOOKS } from '@/lib/syncshow/BibleRange'
import {
  authorizeSyncShow,
  findServiceDocument,
  mutateServiceDocument,
  serviceDocumentResponse,
  serviceDocumentSummary,
} from './syncShow'
import {
  ServiceDocumentAssetError,
  readServiceDocumentAsset,
  serviceDocumentAssetId,
  storeServiceDocumentAsset,
} from '@/lib/syncshow/ServiceDocumentAssetStore'

type RequestDoc = Record<string, unknown>

const MAX_REQUEST_BYTES = 32 * 1024 * 1024

class ServiceDocumentEditorError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ServiceDocumentEditorError'
    this.code = code
    this.status = status
  }
}

function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

function responseHeaders(req: PayloadRequest, extra: HeadersInit = {}) {
  const headers = headersWithCors({ headers: new Headers(extra), req })
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Vary', 'Authorization, Cookie')
  headers.set('X-Content-Type-Options', 'nosniff')
  return headers
}

function json(req: PayloadRequest, value: unknown, init: ResponseInit = {}) {
  return Response.json(value, {
    ...init,
    headers: responseHeaders(req, init.headers),
  })
}

function editorError(req: PayloadRequest, error: unknown) {
  if (error instanceof ServiceDocumentEditorError) {
    return json(req, { code: error.code, error: error.message }, { status: error.status })
  }
  if (error instanceof SyncShowProtocolError) {
    return json(req, { code: error.code, error: error.message }, { status: error.status })
  }
  if (error instanceof ServiceDocumentAssetError) {
    return json(req, { code: error.code, error: error.message }, {
      status: error.status,
      headers: error.retryable ? { 'Retry-After': '5' } : {},
    })
  }
  if (error instanceof HeritageServiceBibleLookupError) {
    return json(req, { code: error.code, error: error.message }, { status: error.status })
  }
  req.payload.logger.error({ err: error }, 'Manager service-document endpoint failed')
  return json(req, {
    code: 'SERVICE_DOCUMENT_EDITOR_SERVER_ERROR',
    error: 'Heritage Community could not safely save the service.',
  }, { status: 500 })
}

async function boundedJson(req: PayloadRequest) {
  const contentType = String(req.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (contentType !== 'application/json' || !req.text) {
    throw new ServiceDocumentEditorError(
      'INVALID_REQUEST',
      'Service edits must use application/json.',
      415,
    )
  }
  const declared = Number(req.headers.get('content-length') || 0)
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw new ServiceDocumentEditorError('REQUEST_TOO_LARGE', 'That service is too large.', 413)
  }
  const source = await req.text()
  if (Buffer.byteLength(source, 'utf8') > MAX_REQUEST_BYTES) {
    throw new ServiceDocumentEditorError('REQUEST_TOO_LARGE', 'That service is too large.', 413)
  }
  try {
    const value = JSON.parse(source || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid')
    return value as RequestDoc
  } catch {
    throw new ServiceDocumentEditorError('INVALID_JSON', 'The service edit is not valid JSON.', 400)
  }
}

async function managerContext(
  req: PayloadRequest,
  access: 'read' | 'write' = 'read',
) {
  if ((req.headers.get('authorization') || '').startsWith('SyncShow ')) {
    const authorized = await authorizeSyncShow(
      req,
      access === 'write'
        ? SYNCSHOW_SERVICE_DOCUMENT_WRITE_SCOPE
        : SYNCSHOW_SERVICE_DOCUMENT_READ_SCOPE,
    )
    return { communityId: authorized.communityId }
  }
  const current = req.user || (await req.payload.auth({ headers: req.headers })).user
  const userId = relationId(current)
  const communityId = await getConfiguredCommunityId(req.payload)
  if (!userId || communityId == null) {
    throw new ServiceDocumentEditorError(
      'COMMUNITY_AUTH_REQUIRED',
      'Sign in to Heritage Community to plan a service.',
      401,
    )
  }
  const membership = (await req.payload.find({
    collection: 'memberships',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      and: [
        { user: { equals: userId } },
        { community: { equals: communityId } },
        { role: { in: ['owner', 'admin', 'leader'] } },
      ],
    },
  })).docs[0]
  if (!membership) {
    throw new ServiceDocumentEditorError(
      'MANAGER_REQUIRED',
      'Your Community role cannot plan services.',
      403,
    )
  }
  return { communityId }
}

function exactKeys(value: RequestDoc, keys: string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
}

function identifier(value: unknown, label: string) {
  const result = String(value || '').trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(result)) {
    throw new ServiceDocumentEditorError('INVALID_SERVICE', `${label} is invalid.`, 400)
  }
  return result
}

export function managerWrite(data: RequestDoc, routeId: string | null = null) {
  if (!exactKeys(data, [
    'schemaVersion',
    'requestId',
    'syncId',
    'baseSyncVersion',
    'baseRevision',
    'documentSource',
    'status',
  ]) || data.schemaVersion !== 1) {
    throw new ServiceDocumentEditorError('INVALID_SERVICE', 'The service edit is incomplete.', 400)
  }
  const syncId = identifier(data.syncId, 'Service identity')
  if (routeId && routeId !== syncId) {
    throw new ServiceDocumentEditorError('IMMUTABLE_SYNC_ID', 'Service identity cannot change.', 409)
  }
  const requestId = identifier(data.requestId, 'Save request')
  const source = String(data.documentSource || '')
  let document
  try {
    document = serviceCore.parseHeritageServiceDocumentSource(source)
  } catch {
    throw new ServiceDocumentEditorError('INVALID_SERVICE', 'The service content is invalid.', 400)
  }
  const canonicalSource = serviceCore.serializeHeritageServiceDocument(document)
  if (canonicalSource !== source || document.id !== syncId) {
    throw new ServiceDocumentEditorError('INVALID_SERVICE', 'The service content is not canonical.', 400)
  }
  const revision = createHash('sha256').update(source, 'utf8').digest('hex')
  const status = String(data.status || '')
  if (!['planning', 'ready', 'archived', 'cancelled'].includes(status)) {
    throw new ServiceDocumentEditorError('INVALID_SERVICE', 'Service status is invalid.', 400)
  }
  const baseSyncVersion = data.baseSyncVersion === null
    ? null
    : Number(data.baseSyncVersion)
  const baseRevision = data.baseRevision === null
    ? null
    : String(data.baseRevision)
  if ((baseSyncVersion === null) !== (baseRevision === null)
    || (baseSyncVersion !== null
      && (!Number.isSafeInteger(baseSyncVersion)
        || baseSyncVersion < 1
        || !/^[a-f0-9]{64}$/.test(baseRevision || '')))) {
    throw new ServiceDocumentEditorError('INVALID_SERVICE_BASE', 'Reload this service before saving.', 412)
  }
  return {
    write: {
      syncId,
      documentSource: source,
      revision,
      status,
      baseSyncVersion,
      baseRevision,
    },
    idempotencyKey: `manager-service-${requestId}`,
  }
}

export function blankServiceDocument(data: RequestDoc) {
  if (!exactKeys(data, ['schemaVersion', 'requestId', 'syncId', 'title', 'serviceDate'])) {
    throw new ServiceDocumentEditorError('INVALID_SERVICE', 'New service details are incomplete.', 400)
  }
  const syncId = identifier(data.syncId, 'Service identity')
  const title = String(data.title || '').trim()
  const serviceDate = String(data.serviceDate || '')
  const requestId = identifier(data.requestId, 'Save request')
  if (!title || title.length > 200 || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    throw new ServiceDocumentEditorError('INVALID_SERVICE', 'Enter a service title and date.', 400)
  }
  const now = new Date().toISOString()
  const project = {
    schemaVersion: 1,
    kind: 'syncshow-service-project',
    id: syncId,
    title,
    serviceDate,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    preferredProfileId: 'main-sanctuary',
    channelIds: ['english', 'russian', 'media'],
    channels: {
      english: { id: 'english', label: 'English', language: 'en' },
      russian: { id: 'russian', label: 'Russian', language: 'ru' },
      media: { id: 'media', label: 'Media', language: 'und' },
    },
    rootItemIds: [],
    items: {},
    resources: {},
    assets: {},
    presetPack: { id: 'main-sanctuary', version: 1, sha256: null },
  }
  const documentSource = serviceCore.serializeHeritageServiceDocument(
    serviceCore.createHeritageServiceDocument(project),
  )
  return managerWrite({
    schemaVersion: 1,
    requestId,
    syncId,
    baseSyncVersion: null,
    baseRevision: null,
    documentSource,
    status: 'planning',
  })
}

const list: Endpoint = {
  path: '/community/service-documents',
  method: 'get',
  handler: async req => {
    try {
      const { communityId } = await managerContext(req)
      const found = await req.payload.find({
        collection: 'service-documents' as never,
        depth: 0,
        limit: 100,
        sort: ['-serviceDate', '-id'],
        overrideAccess: true,
        showHiddenFields: true,
        req,
        where: { community: { equals: communityId } },
      })
      return json(req, {
        schemaVersion: 1,
        items: found.docs.map(value => serviceDocumentSummary(value as RequestDoc)),
      })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

const create: Endpoint = {
  path: '/community/service-documents',
  method: 'post',
  handler: async req => {
    try {
      const { communityId } = await managerContext(req, 'write')
      const mutation = blankServiceDocument(await boundedJson(req))
      const result = await mutateServiceDocument(
        req,
        communityId,
        mutation.write,
        mutation.idempotencyKey,
      )
      return json(req, {
        schemaVersion: 1,
        serviceDocument: serviceDocumentResponse(result.document),
      }, { status: result.created ? 201 : 200 })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

const read: Endpoint = {
  path: '/community/service-documents/:syncId',
  method: 'get',
  handler: async req => {
    try {
      const { communityId } = await managerContext(req)
      const syncId = identifier(req.routeParams?.syncId, 'Service identity')
      const document = await findServiceDocument(req, communityId, syncId)
      if (!document) {
        throw new ServiceDocumentEditorError('SERVICE_NOT_FOUND', 'Service not found.', 404)
      }
      return json(req, {
        schemaVersion: 1,
        serviceDocument: serviceDocumentResponse(document),
      })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

const update: Endpoint = {
  path: '/community/service-documents/:syncId',
  method: 'put',
  handler: async req => {
    try {
      const { communityId } = await managerContext(req, 'write')
      const syncId = identifier(req.routeParams?.syncId, 'Service identity')
      const mutation = managerWrite(await boundedJson(req), syncId)
      const result = await mutateServiceDocument(
        req,
        communityId,
        mutation.write,
        mutation.idempotencyKey,
      )
      return json(req, {
        schemaVersion: 1,
        serviceDocument: serviceDocumentResponse(result.document),
      })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

const songLibraryList: Endpoint = {
  path: '/community/service-documents/library/songs',
  method: 'get',
  handler: async req => {
    try {
      const { communityId } = await managerContext(req)
      const found = await req.payload.find({
        collection: 'songs',
        depth: 0,
        limit: 100,
        sort: ['title', 'id'],
        overrideAccess: true,
        showHiddenFields: true,
        req,
        where: {
          and: [
            { community: { equals: communityId } },
            { status: { not_equals: 'archived' } },
          ],
        },
      })
      const items = found.docs
        .map(value => serializeSongForSync(value as unknown as RequestDoc))
        .filter(value => value.syncDocuments.length > 0)
        .map(value => ({
          syncId: value.syncId,
          syncVersion: value.syncVersion,
          title: value.title,
          russianTitle: value.russianTitle,
          rightsStatus: value.rightsStatus,
          visibility: value.visibility,
          documentCount: value.syncDocuments.length,
          updatedAt: value.updatedAt,
        }))
      return json(req, { schemaVersion: 1, items })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

const songLibraryRead: Endpoint = {
  path: '/community/service-documents/library/songs/:syncId',
  method: 'get',
  handler: async req => {
    try {
      const { communityId } = await managerContext(req)
      const syncId = identifier(req.routeParams?.syncId, 'Song identity')
      const song = (await req.payload.find({
        collection: 'songs',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        showHiddenFields: true,
        req,
        where: {
          and: [
            { community: { equals: communityId } },
            { syncId: { equals: syncId } },
            { status: { not_equals: 'archived' } },
          ],
        },
      })).docs[0]
      if (!song) {
        throw new ServiceDocumentEditorError('SONG_NOT_FOUND', 'Song not found.', 404)
      }
      const item = serializeSongForSync(song as unknown as RequestDoc)
      if (!item.syncDocuments.length) {
        throw new ServiceDocumentEditorError(
          'SONG_NOT_READY',
          'This song has no reviewed SyncShow document to pin.',
          409,
        )
      }
      return json(req, {
        schemaVersion: 1,
        item: {
          syncId: item.syncId,
          syncVersion: item.syncVersion,
          title: item.title,
          russianTitle: item.russianTitle,
          rightsStatus: item.rightsStatus,
          visibility: item.visibility,
          syncDocuments: item.syncDocuments,
          updatedAt: item.updatedAt,
        },
      })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

const bibleLibraryRead: Endpoint = {
  path: '/community/service-documents/library/bible-passage',
  method: 'post',
  handler: async req => {
    try {
      await managerContext(req)
      const data = await boundedJson(req)
      if (!exactKeys(data, ['schemaVersion', 'bookId', 'chapter', 'startVerse', 'endVerse'])
        || data.schemaVersion !== 1) {
        throw new ServiceDocumentEditorError(
          'INVALID_BIBLE_RANGE',
          'Bible lookup details are incomplete.',
          400,
        )
      }
      const passage = await loadHeritageServiceBiblePassage({
        schemaVersion: 1,
        bookId: data.bookId,
        start: { chapter: data.chapter, verse: data.startVerse },
        end: { chapter: data.chapter, verse: data.endVerse },
      })
      return json(req, { schemaVersion: 1, passage })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

const bibleLibraryCatalog: Endpoint = {
  path: '/community/service-documents/library/bible-passage',
  method: 'get',
  handler: async req => {
    try {
      await managerContext(req)
      return json(req, {
        schemaVersion: 1,
        books: CANONICAL_BIBLE_BOOKS.map(book => ({
          id: book.id,
          name: book.name,
          chapters: book.chapters,
        })),
      })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

const uploadAsset: Endpoint = {
  path: '/community/service-documents/assets/:assetId',
  method: 'put',
  handler: async req => {
    try {
      const { communityId } = await managerContext(req, 'write')
      const asset = await storeServiceDocumentAsset(
        req,
        communityId,
        req.routeParams?.assetId,
        { requireDeclaredMetadata: false },
      )
      return json(req, { schemaVersion: 1, asset }, {
        status: 201,
        headers: {
          ETag: `"${asset.sha256}"`,
          Location: `/api/community/service-documents/assets/${encodeURIComponent(asset.id)}`,
        },
      })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

const readAsset: Endpoint = {
  path: '/community/service-documents/:syncId/assets/:assetId',
  method: 'get',
  handler: async req => {
    try {
      const { communityId } = await managerContext(req)
      const syncId = identifier(req.routeParams?.syncId, 'Service identity')
      const identity = serviceDocumentAssetId(req.routeParams?.assetId)
      const stored = await findServiceDocument(req, communityId, syncId)
      if (!stored) {
        throw new ServiceDocumentEditorError('SERVICE_NOT_FOUND', 'Service not found.', 404)
      }
      let document
      try {
        document = serviceCore.parseHeritageServiceDocumentSource(
          String(stored.documentSource || ''),
        )
      } catch {
        throw new ServiceDocumentEditorError(
          'INVALID_SERVICE_STATE',
          'Stored service content is invalid.',
          500,
        )
      }
      const asset = document.project.assets[identity.id]
      if (!asset || !['image', 'video'].includes(asset.kind)) {
        throw new ServiceDocumentAssetError(
          'SERVICE_ASSET_NOT_FOUND',
          'That media file is not part of this service revision.',
          404,
        )
      }
      const bytes = await readServiceDocumentAsset(communityId, asset)
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: responseHeaders(req, {
          'Content-Type': asset.mediaType,
          'Content-Length': String(asset.size),
          ETag: `"${asset.sha256}"`,
        }),
      })
    } catch (error) {
      return editorError(req, error)
    }
  },
}

export const managerServiceDocumentEndpoints: Endpoint[] = [
  list,
  create,
  songLibraryList,
  songLibraryRead,
  bibleLibraryCatalog,
  bibleLibraryRead,
  read,
  update,
  uploadAsset,
  readAsset,
]
