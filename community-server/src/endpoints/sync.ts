import { headersWithCors, type Endpoint, type PayloadRequest } from 'payload'
import { currentCommunitySession, relationId } from '@/lib/communitySession'
import {
  lockSyncRecords,
  lockSyncUser,
  nextSyncRevision,
  withSyncTransaction,
} from '@/lib/syncDatabase'
import { decryptSyncPayload, encryptSyncPayload } from '@/lib/syncEncryption'
import { normalizeSyncChanges, type ClientSyncChange } from '@/lib/syncProtocol'

const DEFAULT_PAGE_SIZE = 250
const MAX_PAGE_SIZE = 500

type StoredRecord = Record<string, any>

function responseHeaders(req: PayloadRequest) {
  return headersWithCors({
    headers: new Headers({
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    }),
    req,
  })
}

function unauthorized(req: PayloadRequest) {
  return Response.json({ error: 'Sign in again to synchronize.' }, { status: 401, headers: responseHeaders(req) })
}

async function requestBody(req: PayloadRequest) {
  if (req.json) return req.json().catch(() => ({}))
  if (req.text) return req.text().then(value => JSON.parse(value)).catch(() => ({}))
  return {}
}

function generation(value: unknown) {
  const result = Number(value)
  return Number.isSafeInteger(result) && result >= 1 ? result : 0
}

async function syncContext(req: PayloadRequest, requestedDeviceId?: string) {
  const session = await currentCommunitySession(req)
  const userId = relationId(session?.user)
  const deviceId = String(session?.deviceId || '')
  // The bearer session has already been looked up by its cryptographic token
  // hash. Custom endpoints must not additionally depend on framework-populated
  // req.user, which Payload does not supply reliably for collection strategies.
  if (!session || !userId || !deviceId) return null
  if (requestedDeviceId && requestedDeviceId !== deviceId) return null
  const user = await req.payload.findByID({
    collection: 'users', id: userId, depth: 0, overrideAccess: true, req,
  })
  if (!user || !generation(session.syncGeneration) || generation(session.syncGeneration) !== generation(user.syncGeneration)) {
    return null
  }
  const device = (await req.payload.find({
    collection: 'sync-devices', depth: 0, limit: 1, overrideAccess: true, req,
    where: { and: [
      { user: { equals: userId } },
      { deviceId: { equals: deviceId } },
      { revokedAt: { exists: false } },
    ] },
  })).docs[0]
  return device ? { session, user, userId, deviceId, device } : null
}

function wireEncryptedRecord(req: PayloadRequest, userId: number, record: StoredRecord) {
  const deleted = Boolean(record.deleted)
  return {
    recordType: record.recordType,
    recordId: record.recordId,
    schemaVersion: Number(record.schemaVersion),
    serverRevision: Number(record.serverRevision),
    originDeviceId: record.originDeviceId,
    deleted,
    updatedAt: record.clientUpdatedAt || record.updatedAt,
    contentHash: record.contentHash,
    value: decryptSyncPayload({
      secret: req.payload.secret,
      userId: String(userId),
      recordType: String(record.recordType),
      recordId: String(record.recordId),
      schemaVersion: Number(record.schemaVersion),
      deleted,
      keyId: String(record.keyId),
      iv: String(record.iv),
      authTag: String(record.authTag),
      ciphertext: String(record.ciphertext),
    }),
  }
}

function pageSize(raw: string | null) {
  if (raw == null || raw === '') return DEFAULT_PAGE_SIZE
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGE_SIZE) return 0
  return value
}

async function findRecordsPage(
  req: PayloadRequest,
  userId: number,
  sinceRevision: number,
  limit = DEFAULT_PAGE_SIZE,
) {
  const result = await req.payload.find({
    collection: 'sync-records',
    depth: 0,
    limit,
    page: 1,
    pagination: true,
    sort: 'serverRevision',
    overrideAccess: true,
    req,
    where: { and: [
      { user: { equals: userId } },
      { serverRevision: { greater_than: sinceRevision } },
    ] },
  })
  const records = result.docs.map(record => wireEncryptedRecord(req, userId, record as StoredRecord))
  const nextRevision = records.length ? records[records.length - 1].serverRevision : sinceRevision
  return {
    records,
    nextRevision,
    // The explicit marker prevents a fixed cap from masquerading as a complete pull.
    hasMore: Boolean(result.hasNextPage),
  }
}

function isStrictlyNewer(left: string | null, right: unknown) {
  const leftTime = Date.parse(String(left || ''))
  const rightTime = Date.parse(String(right || ''))
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime > rightTime
}

export function isAuthorizedFirstSyncPreservation({
  existing,
  change,
  sinceRevision,
}: {
  existing: StoredRecord | undefined
  change: ClientSyncChange
  sinceRevision: number
}) {
  return Boolean(
    existing
    && change.preservePrevious
    && sinceRevision === 0
    && change.baseRevision === Number(existing.serverRevision)
    && isStrictlyNewer(change.updatedAt, existing.clientUpdatedAt || existing.updatedAt),
  )
}

export function isIdempotentSyncWrite(
  existing: StoredRecord | undefined,
  change: ClientSyncChange,
  contentHash: string,
) {
  return Boolean(
    existing
    && Number(existing.schemaVersion) === change.schemaVersion
    && existing.contentHash === contentHash
    && Boolean(existing.deleted) === change.deleted,
  )
}

async function createConflict(
  req: PayloadRequest,
  userId: number,
  deviceId: string,
  change: ClientSyncChange,
  serverRevision: number,
  serverRecordMissing: boolean,
  resolvedAt?: string,
) {
  const encrypted = encryptSyncPayload({
    secret: req.payload.secret,
    userId: String(userId),
    recordType: change.recordType,
    recordId: change.recordId,
    schemaVersion: change.schemaVersion,
    deleted: change.deleted,
    value: change.value,
  })
  await req.payload.create({
    collection: 'sync-conflicts', overrideAccess: true, req,
    data: {
      user: userId,
      recordType: change.recordType,
      recordId: change.recordId,
      schemaVersion: change.schemaVersion,
      baseRevision: change.baseRevision,
      serverRevision,
      originDeviceId: deviceId,
      deleted: change.deleted,
      clientUpdatedAt: change.updatedAt,
      serverRecordMissing,
      ...encrypted,
      ...(resolvedAt ? { resolvedAt } : {}),
    },
  })
}

async function preserveExistingRecord(
  req: PayloadRequest,
  userId: number,
  record: StoredRecord,
  resolvedAt: string,
) {
  await req.payload.create({
    collection: 'sync-conflicts', overrideAccess: true, req,
    data: {
      user: userId,
      recordType: record.recordType,
      recordId: record.recordId,
      schemaVersion: Number(record.schemaVersion),
      baseRevision: Number(record.serverRevision),
      serverRevision: Number(record.serverRevision),
      originDeviceId: String(record.originDeviceId),
      deleted: Boolean(record.deleted),
      clientUpdatedAt: record.clientUpdatedAt || null,
      serverRecordMissing: false,
      keyId: record.keyId,
      iv: record.iv,
      authTag: record.authTag,
      ciphertext: record.ciphertext,
      contentHash: record.contentHash,
      resolvedAt,
    },
  })
}

async function updateRecordWithCas(
  req: PayloadRequest,
  existing: StoredRecord,
  data: Record<string, unknown>,
) {
  const result = await req.payload.update({
    collection: 'sync-records',
    overrideAccess: true,
    req,
    where: { and: [
      { id: { equals: existing.id } },
      { serverRevision: { equals: Number(existing.serverRevision) } },
    ] },
    data,
  })
  if (!('docs' in result) || result.docs.length !== 1) {
    throw new Error('A synchronized record changed during its guarded update.')
  }
}

export const syncEndpoints: Endpoint[] = [
  {
    path: '/community/sync/v1/records',
    method: 'get',
    handler: async req => {
      const url = new URL(req.url || 'http://localhost')
      const sinceRevision = Number(url.searchParams.get('since') || 0)
      const limit = pageSize(url.searchParams.get('limit'))
      if (!Number.isSafeInteger(sinceRevision) || sinceRevision < 0) {
        return Response.json({ error: 'The synchronization cursor is invalid.' }, { status: 400, headers: responseHeaders(req) })
      }
      if (!limit) {
        return Response.json({ error: `Request between 1 and ${MAX_PAGE_SIZE} synchronized records at a time.` }, { status: 400, headers: responseHeaders(req) })
      }
      const current = await syncContext(req)
      if (!current) return unauthorized(req)
      const page = await findRecordsPage(req, current.userId, sinceRevision, limit)
      return Response.json({
        schemaVersion: 1,
        ...page,
        // Kept for version-one clients; it is always the safe page cursor.
        latestRevision: page.nextRevision,
      }, { headers: responseHeaders(req) })
    },
  },
  {
    path: '/community/sync/v1/records',
    method: 'post',
    handler: async req => {
      const data = await requestBody(req) as Record<string, unknown>
      const deviceId = String(data.deviceId || '')
      const sinceRevision = Number(data.sinceRevision || 0)
      const responseLimit = data.limit == null ? DEFAULT_PAGE_SIZE : Number(data.limit)
      if (!Number.isSafeInteger(sinceRevision) || sinceRevision < 0) {
        return Response.json({ error: 'The synchronization cursor is invalid.' }, { status: 400, headers: responseHeaders(req) })
      }
      if (!Number.isSafeInteger(responseLimit) || responseLimit < 1 || responseLimit > MAX_PAGE_SIZE) {
        return Response.json({ error: `Request between 1 and ${MAX_PAGE_SIZE} synchronized records at a time.` }, { status: 400, headers: responseHeaders(req) })
      }
      let changes: ClientSyncChange[]
      try {
        changes = normalizeSyncChanges(data.changes)
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'The synchronized changes are invalid.' }, { status: 400, headers: responseHeaders(req) })
      }
      const initial = await syncContext(req, deviceId)
      if (!initial) return unauthorized(req)

      const outcome = await withSyncTransaction(req, async () => {
        await lockSyncUser(req, initial.userId)
        const current = await syncContext(req, deviceId)
        if (!current) return null
        await lockSyncRecords(req, current.userId, changes)

        const acknowledgements: Array<Record<string, unknown>> = []
        const conflicts: Array<Record<string, unknown>> = []
        for (const change of changes) {
          const existing = (await req.payload.find({
            collection: 'sync-records', depth: 0, limit: 1, overrideAccess: true, req,
            where: { and: [
              { user: { equals: current.userId } },
              { recordType: { equals: change.recordType } },
              { recordId: { equals: change.recordId } },
            ] },
          })).docs[0] as StoredRecord | undefined
          const encrypted = encryptSyncPayload({
            secret: req.payload.secret,
            userId: String(current.userId),
            recordType: change.recordType,
            recordId: change.recordId,
            schemaVersion: change.schemaVersion,
            deleted: change.deleted,
            value: change.value,
          })
          if (existing && isIdempotentSyncWrite(existing, change, encrypted.contentHash)) {
            acknowledgements.push({
              recordType: change.recordType,
              recordId: change.recordId,
              schemaVersion: change.schemaVersion,
              serverRevision: Number(existing.serverRevision),
              contentHash: existing.contentHash,
              deleted: Boolean(existing.deleted),
            })
            continue
          }

          const currentRevision = Number(existing?.serverRevision || 0)
          const preserveAuthorized = isAuthorizedFirstSyncPreservation({ existing, change, sinceRevision })
          const invalidPreservation = change.preservePrevious && !preserveAuthorized
          if ((existing && currentRevision !== change.baseRevision) || invalidPreservation) {
            await createConflict(req, current.userId, current.deviceId, change, currentRevision, !existing)
            conflicts.push({
              recordType: change.recordType,
              recordId: change.recordId,
              reason: invalidPreservation
                ? 'first-sync-preservation-not-authorized'
                : 'changed-on-another-device',
              localPreserved: true,
              server: existing ? wireEncryptedRecord(req, current.userId, existing) : null,
            })
            continue
          }

          if (!existing && change.baseRevision > 0) {
            await createConflict(req, current.userId, current.deviceId, change, 0, true)
            conflicts.push({
              recordType: change.recordType,
              recordId: change.recordId,
              reason: 'server-record-missing',
              localPreserved: true,
            })
            continue
          }

          if (existing && preserveAuthorized) {
            await preserveExistingRecord(req, current.userId, existing, new Date().toISOString())
          }

          const serverRevision = await nextSyncRevision(req)
          const recordData = {
            user: current.userId,
            recordType: change.recordType,
            recordId: change.recordId,
            schemaVersion: change.schemaVersion,
            serverRevision,
            originDeviceId: current.deviceId,
            deleted: change.deleted,
            clientUpdatedAt: change.updatedAt,
            ...encrypted,
          }
          if (existing) await updateRecordWithCas(req, existing, recordData)
          else await req.payload.create({ collection: 'sync-records', overrideAccess: true, req, data: recordData })
          acknowledgements.push({
            recordType: change.recordType,
            recordId: change.recordId,
            schemaVersion: change.schemaVersion,
            serverRevision,
            contentHash: encrypted.contentHash,
            deleted: change.deleted,
          })
        }

        const now = new Date().toISOString()
        await req.payload.update({
          collection: 'sync-devices', id: current.device.id, overrideAccess: true, req,
          data: { lastSyncedAt: now },
        })
        await req.payload.update({
          collection: 'community-sessions', id: current.session.id, overrideAccess: true, req,
          data: { lastUsedAt: now },
        })
        const page = await findRecordsPage(req, current.userId, sinceRevision, responseLimit)
        return { acknowledgements, conflicts, ...page, syncedAt: now }
      })
      if (!outcome) return unauthorized(req)

      return Response.json({
        schemaVersion: 1,
        ...outcome,
        latestRevision: outcome.nextRevision,
      }, { headers: responseHeaders(req) })
    },
  },
]
