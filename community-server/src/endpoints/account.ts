import { headersWithCors, type Endpoint, type PayloadRequest, type Where } from 'payload'
import { recordAccountSecurityEvent } from '@/lib/accountSecurityNotification'
import { currentCommunitySession, relationId } from '@/lib/communitySession'
import {
  lockSyncRecords,
  lockSyncUser,
  nextSyncRevision,
  withSyncTransaction,
} from '@/lib/syncDatabase'
import { decryptSyncPayload } from '@/lib/syncEncryption'
import { hashStrictPassword, validateStrictPassword } from '@/lib/strictPassword'

const RECENT_REVERIFICATION_MS = 10 * 60_000
const EXPORT_PAGE_SIZE = 500
const MAX_EXPORT_ROWS_PER_COLLECTION = 50_000
const MAX_CONFLICT_PAGE_SIZE = 100

type StoredRecord = Record<string, any> & { recordType: string; recordId: string }

class ExportTooLargeError extends Error {}

function headers(req: PayloadRequest) {
  return headersWithCors({
    headers: new Headers({
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    }),
    req,
  })
}

function unauthorized(req: PayloadRequest) {
  return Response.json({ error: 'Sign in again to continue.' }, { status: 401, headers: headers(req) })
}

function generation(value: unknown) {
  const result = Number(value)
  return Number.isSafeInteger(result) && result >= 1 ? result : 0
}

async function context(req: PayloadRequest) {
  const session = await currentCommunitySession(req)
  const userId = relationId(session?.user)
  // Custom Payload endpoints do not consistently receive req.user from a
  // collection auth strategy. The independently validated, hashed Community
  // session is the authority here; its stored user relationship scopes every
  // subsequent account query.
  if (!session || !userId) return null
  const user = await req.payload.findByID({
    collection: 'users', id: userId, depth: 0, overrideAccess: true, req,
  })
  if (!user || !generation(session.syncGeneration) || generation(session.syncGeneration) !== generation(user.syncGeneration)) {
    return null
  }
  return { session, user, userId }
}

async function body(req: PayloadRequest) {
  if (req.json) return req.json().catch(() => ({}))
  if (req.text) return req.text().then(text => JSON.parse(text)).catch(() => ({}))
  return {}
}

function isRecent(value: unknown) {
  const time = Date.parse(String(value || ''))
  return Number.isFinite(time) && Date.now() - time <= RECENT_REVERIFICATION_MS
}

function deviceWire(device: Record<string, unknown>, currentDeviceId: string) {
  return {
    id: device.id,
    deviceId: device.deviceId,
    name: device.friendlyName,
    platform: device.platform,
    firstConnectedAt: device.firstConnectedAt,
    lastSyncedAt: device.lastSyncedAt || null,
    revokedAt: device.revokedAt || null,
    current: device.deviceId === currentDeviceId,
  }
}

function decryptedValue(req: PayloadRequest, userId: number, record: StoredRecord) {
  return decryptSyncPayload({
    secret: req.payload.secret,
    userId: String(userId),
    recordType: String(record.recordType),
    recordId: String(record.recordId),
    schemaVersion: Number(record.schemaVersion),
    deleted: Boolean(record.deleted),
    keyId: String(record.keyId),
    iv: String(record.iv),
    authTag: String(record.authTag),
    ciphertext: String(record.ciphertext),
  })
}

function conflictWire(req: PayloadRequest, userId: number, conflict: StoredRecord) {
  return {
    id: conflict.id,
    recordType: conflict.recordType,
    recordId: conflict.recordId,
    schemaVersion: Number(conflict.schemaVersion),
    baseRevision: Number(conflict.baseRevision),
    serverRevision: Number(conflict.serverRevision),
    originDeviceId: conflict.originDeviceId,
    deleted: Boolean(conflict.deleted),
    updatedAt: conflict.clientUpdatedAt || conflict.updatedAt,
    serverRecordMissing: Boolean(conflict.serverRecordMissing),
    resolvedAt: conflict.resolvedAt || null,
    value: decryptedValue(req, userId, conflict),
  }
}

function syncRecordWire(req: PayloadRequest, userId: number, record: StoredRecord) {
  return {
    recordType: record.recordType,
    recordId: record.recordId,
    schemaVersion: Number(record.schemaVersion),
    serverRevision: Number(record.serverRevision),
    originDeviceId: record.originDeviceId,
    deleted: Boolean(record.deleted),
    updatedAt: record.clientUpdatedAt || record.updatedAt,
    contentHash: record.contentHash,
    value: decryptedValue(req, userId, record),
  }
}

async function allOwnedDocuments(
  req: PayloadRequest,
  collection: 'sync-records' | 'sync-conflicts',
  userId: number,
) {
  const documents: StoredRecord[] = []
  let page = 1
  while (true) {
    const result = await req.payload.find({
      collection,
      depth: 0,
      limit: EXPORT_PAGE_SIZE,
      page,
      pagination: true,
      sort: 'id',
      overrideAccess: true,
      req,
      where: { user: { equals: userId } },
    })
    documents.push(...result.docs as StoredRecord[])
    if (documents.length > MAX_EXPORT_ROWS_PER_COLLECTION) throw new ExportTooLargeError()
    if (!result.hasNextPage) return documents
    page += 1
  }
}

async function preserveCurrentAsResolvedConflict(
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

export const accountEndpoints: Endpoint[] = [
  {
    path: '/community/account',
    method: 'get',
    handler: async req => {
      const current = await context(req)
      if (!current) return unauthorized(req)
      const [devices, events, conflicts] = await Promise.all([
        req.payload.find({
          collection: 'sync-devices', depth: 0, limit: 100, sort: '-lastSyncedAt', overrideAccess: true, req,
          where: { user: { equals: current.userId } },
        }),
        req.payload.find({
          collection: 'sync-account-events', depth: 0, limit: 20, sort: '-occurredAt', overrideAccess: true, req,
          where: { user: { equals: current.userId } },
        }),
        req.payload.count({
          collection: 'sync-conflicts', overrideAccess: true, req,
          where: { and: [
            { user: { equals: current.userId } },
            { resolvedAt: { exists: false } },
          ] },
        }),
      ])
      const currentDeviceId = String(current.session.deviceId || '')
      return Response.json({
        member: {
          id: current.user.id,
          email: current.user.email,
          displayName: current.user.displayName,
        },
        accountProtection: current.user.accountProtection || 'email',
        recentEmailVerification: isRecent(current.session.emailVerifiedAt),
        syncGeneration: generation(current.user.syncGeneration),
        currentDeviceId,
        conflicts: conflicts.totalDocs,
        devices: devices.docs.map(device => deviceWire(device as unknown as Record<string, unknown>, currentDeviceId)),
        devicesHasMore: Boolean(devices.hasNextPage),
        events: events.docs.map(event => ({
          id: event.id,
          type: event.eventType,
          deviceId: event.deviceId || null,
          occurredAt: event.occurredAt,
        })),
        eventsHasMore: Boolean(events.hasNextPage),
      }, { headers: headers(req) })
    },
  },
  {
    path: '/community/account/protection',
    method: 'post',
    handler: async req => {
      const initial = await context(req)
      if (!initial) return unauthorized(req)
      const data = await body(req) as Record<string, unknown>
      const mode = data.mode === 'strict-password' ? 'strict-password' : data.mode === 'email' ? 'email' : ''
      if (!mode) return Response.json({ error: 'Choose an account-protection option.' }, { status: 400, headers: headers(req) })
      const password = typeof data.password === 'string' ? data.password : ''
      if (mode === 'strict-password') {
        const error = validateStrictPassword(password)
        if (error) return Response.json({ error }, { status: 400, headers: headers(req) })
        if (data.passwordConfirmation !== password) {
          return Response.json({ error: 'The two passwords do not match.' }, { status: 400, headers: headers(req) })
        }
        if (data.acknowledgedLockoutRisk !== true) {
          return Response.json({ error: 'Acknowledge the password lockout risk before continuing.' }, { status: 400, headers: headers(req) })
        }
      }
      const protectedPassword = mode === 'strict-password' ? await hashStrictPassword(password) : null
      const changed = await withSyncTransaction(req, async () => {
        await lockSyncUser(req, initial.userId)
        const current = await context(req)
        if (!current) return null
        if (!isRecent(current.session.emailVerifiedAt)) return 'reverify' as const
        const now = new Date().toISOString()
        await req.payload.update({
          collection: 'users', id: current.user.id, overrideAccess: true, req,
          data: mode === 'strict-password'
            ? {
                accountProtection: 'strict-password',
                strictPasswordHash: protectedPassword?.encoded,
                strictPasswordAlgorithm: protectedPassword?.algorithm,
                strictPasswordParams: protectedPassword?.params,
              }
            : {
                accountProtection: 'email',
                strictPasswordHash: null,
                strictPasswordAlgorithm: null,
                strictPasswordParams: null,
              },
        })
        await req.payload.update({
          collection: 'community-sessions', id: current.session.id, overrideAccess: true, req,
          data: { emailVerifiedAt: null, lastUsedAt: now },
        })
        return { current, now }
      })
      if (!changed) return unauthorized(req)
      if (changed === 'reverify') {
        return Response.json({ error: 'Verify your email again before changing account protection.', reverifyRequired: true }, { status: 403, headers: headers(req) })
      }
      await recordAccountSecurityEvent({
        payload: req.payload,
        userId: changed.current.user.id,
        email: changed.current.user.email,
        eventType: 'protection-changed',
        deviceId: String(changed.current.session.deviceId || ''),
      })
      return Response.json({ ok: true, accountProtection: mode }, { headers: headers(req) })
    },
  },
  {
    path: '/community/account/devices/revoke',
    method: 'post',
    handler: async req => {
      const initial = await context(req)
      if (!initial) return unauthorized(req)
      const data = await body(req) as Record<string, unknown>
      const deviceId = String(data.deviceId || '')
      const revoked = await withSyncTransaction(req, async () => {
        await lockSyncUser(req, initial.userId)
        const current = await context(req)
        if (!current) return null
        const device = (await req.payload.find({
          collection: 'sync-devices', depth: 0, limit: 1, overrideAccess: true, req,
          where: { and: [
            { user: { equals: current.userId } },
            { deviceId: { equals: deviceId } },
          ] },
        })).docs[0]
        if (!device) return 'missing' as const
        const now = new Date().toISOString()
        await req.payload.update({ collection: 'sync-devices', id: device.id, overrideAccess: true, req, data: { revokedAt: now } })
        await req.payload.update({
          collection: 'community-sessions', overrideAccess: true, req,
          where: { and: [
            { user: { equals: current.userId } },
            { deviceId: { equals: deviceId } },
            { revokedAt: { exists: false } },
          ] },
          data: { revokedAt: now },
        })
        return { current, device }
      })
      if (!revoked) return unauthorized(req)
      if (revoked === 'missing') return Response.json({ error: 'That device is no longer connected.' }, { status: 404, headers: headers(req) })
      await recordAccountSecurityEvent({
        payload: req.payload,
        userId: revoked.current.user.id,
        email: revoked.current.user.email,
        eventType: 'device-revoked',
        deviceId,
        deviceName: String(revoked.device.friendlyName || 'Heritage device'),
      })
      return Response.json({ ok: true, currentDeviceRevoked: deviceId === revoked.current.session.deviceId }, { headers: headers(req) })
    },
  },
  {
    path: '/community/account/conflicts',
    method: 'get',
    handler: async req => {
      const current = await context(req)
      if (!current) return unauthorized(req)
      const url = new URL(req.url || 'http://localhost')
      const limit = Number(url.searchParams.get('limit') || 50)
      const after = Number(url.searchParams.get('after') || 0)
      const includeResolved = url.searchParams.get('includeResolved') === '1'
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_CONFLICT_PAGE_SIZE || !Number.isSafeInteger(after) || after < 0) {
        return Response.json({ error: 'The conflict page is invalid.' }, { status: 400, headers: headers(req) })
      }
      const clauses: Where[] = [
        { user: { equals: current.userId } },
        { id: { greater_than: after } },
      ]
      if (!includeResolved) clauses.push({ resolvedAt: { exists: false } })
      const result = await req.payload.find({
        collection: 'sync-conflicts', depth: 0, limit, page: 1, pagination: true,
        sort: 'id', overrideAccess: true, req, where: { and: clauses },
      })
      const conflicts = result.docs.map(conflict => conflictWire(req, current.userId, conflict as StoredRecord))
      return Response.json({
        schemaVersion: 1,
        conflicts,
        hasMore: Boolean(result.hasNextPage),
        nextAfter: conflicts.length ? conflicts[conflicts.length - 1].id : after,
      }, { headers: headers(req) })
    },
  },
  {
    path: '/community/account/conflicts/resolve',
    method: 'post',
    handler: async req => {
      const initial = await context(req)
      if (!initial) return unauthorized(req)
      const data = await body(req) as Record<string, unknown>
      const conflictId = Number(data.conflictId)
      const action = data.action === 'use-conflict' ? 'use-conflict' : data.action === 'discard-conflict' ? 'discard-conflict' : ''
      if (!Number.isSafeInteger(conflictId) || conflictId < 1 || !action) {
        return Response.json({ error: 'Choose a valid conflict and resolution.' }, { status: 400, headers: headers(req) })
      }
      const result = await withSyncTransaction(req, async () => {
        await lockSyncUser(req, initial.userId)
        const current = await context(req)
        if (!current) return null
        let conflict = await req.payload.findByID({
          collection: 'sync-conflicts', id: conflictId, depth: 0, overrideAccess: true, req,
        }).catch(() => null) as StoredRecord | null
        if (!conflict || relationId(conflict.user) !== current.userId || conflict.resolvedAt) return 'missing' as const
        await lockSyncRecords(req, current.userId, [conflict])
        conflict = await req.payload.findByID({
          collection: 'sync-conflicts', id: conflictId, depth: 0, overrideAccess: true, req,
        }).catch(() => null) as StoredRecord | null
        if (!conflict || relationId(conflict.user) !== current.userId || conflict.resolvedAt) return 'missing' as const
        const resolvedAt = new Date().toISOString()
        let serverRevision: number | null = null
        if (action === 'use-conflict') {
          const existing = (await req.payload.find({
            collection: 'sync-records', depth: 0, limit: 1, overrideAccess: true, req,
            where: { and: [
              { user: { equals: current.userId } },
              { recordType: { equals: conflict.recordType } },
              { recordId: { equals: conflict.recordId } },
            ] },
          })).docs[0] as StoredRecord | undefined
          if (existing) await preserveCurrentAsResolvedConflict(req, current.userId, existing, resolvedAt)
          serverRevision = await nextSyncRevision(req)
          const recordData = {
            user: current.userId,
            recordType: conflict.recordType,
            recordId: conflict.recordId,
            schemaVersion: Number(conflict.schemaVersion),
            serverRevision,
            originDeviceId: String(conflict.originDeviceId),
            deleted: Boolean(conflict.deleted),
            clientUpdatedAt: conflict.clientUpdatedAt || resolvedAt,
            keyId: conflict.keyId,
            iv: conflict.iv,
            authTag: conflict.authTag,
            ciphertext: conflict.ciphertext,
            contentHash: conflict.contentHash,
          }
          if (existing) {
            const updated = await req.payload.update({
              collection: 'sync-records', overrideAccess: true, req,
              where: { and: [
                { id: { equals: existing.id } },
                { serverRevision: { equals: Number(existing.serverRevision) } },
              ] },
              data: recordData,
            })
            if (!('docs' in updated) || updated.docs.length !== 1) throw new Error('The synchronized record changed during conflict resolution.')
          } else {
            await req.payload.create({ collection: 'sync-records', overrideAccess: true, req, data: recordData })
          }
        }
        await req.payload.update({
          collection: 'sync-conflicts', id: conflict.id, overrideAccess: true, req,
          data: { resolvedAt },
        })
        const authoritative = (await req.payload.find({
          collection: 'sync-records', depth: 0, limit: 1, overrideAccess: true, req,
          where: { and: [
            { user: { equals: current.userId } },
            { recordType: { equals: conflict.recordType } },
            { recordId: { equals: conflict.recordId } },
          ] },
        })).docs[0] as StoredRecord | undefined
        return {
          serverRevision: authoritative ? Number(authoritative.serverRevision) : serverRevision,
          record: authoritative ? syncRecordWire(req, current.userId, authoritative) : null,
        }
      })
      if (!result) return unauthorized(req)
      if (result === 'missing') return Response.json({ error: 'That conflict is no longer available.' }, { status: 404, headers: headers(req) })
      return Response.json({ ok: true, action, ...result }, { headers: headers(req) })
    },
  },
  {
    path: '/community/account/export',
    method: 'get',
    handler: async req => {
      const initial = await context(req)
      if (!initial) return unauthorized(req)
      try {
        const snapshot = await withSyncTransaction(req, async () => {
          await lockSyncUser(req, initial.userId)
          const current = await context(req)
          if (!current) return null
          const records = await allOwnedDocuments(req, 'sync-records', current.userId)
          const conflicts = await allOwnedDocuments(req, 'sync-conflicts', current.userId)
          return { current, records, conflicts, exportedAt: new Date().toISOString() }
        })
        if (!snapshot) return unauthorized(req)
        return Response.json({
          schemaVersion: 1,
          exportedAt: snapshot.exportedAt,
          member: { email: snapshot.current.user.email },
          records: snapshot.records.map(record => ({
            recordType: record.recordType,
            recordId: record.recordId,
            schemaVersion: Number(record.schemaVersion),
            serverRevision: Number(record.serverRevision),
            deleted: Boolean(record.deleted),
            updatedAt: record.clientUpdatedAt || record.updatedAt,
            value: decryptedValue(req, snapshot.current.userId, record),
          })),
          conflicts: snapshot.conflicts.map(conflict => conflictWire(req, snapshot.current.userId, conflict)),
        }, { headers: headers(req) })
      } catch (error) {
        if (error instanceof ExportTooLargeError) {
          return Response.json({ error: 'This account is too large for one export. Contact the server operator for a complete export.' }, { status: 413, headers: headers(req) })
        }
        throw error
      }
    },
  },
  {
    path: '/community/account/erase-synchronized-data',
    method: 'post',
    handler: async req => {
      const initial = await context(req)
      if (!initial) return unauthorized(req)
      const data = await body(req) as Record<string, unknown>
      if (data.confirmation !== 'ERASE') {
        return Response.json({ error: 'Type ERASE to remove synchronized account data.' }, { status: 400, headers: headers(req) })
      }
      const erased = await withSyncTransaction(req, async () => {
        await lockSyncUser(req, initial.userId)
        const current = await context(req)
        if (!current) return null
        const now = new Date().toISOString()
        const nextGeneration = generation(current.user.syncGeneration) + 1
        await req.payload.update({
          collection: 'users', id: current.user.id, overrideAccess: true, req,
          data: { syncGeneration: nextGeneration },
        })
        await req.payload.update({
          collection: 'community-sessions', overrideAccess: true, req,
          where: { and: [{ user: { equals: current.userId } }, { revokedAt: { exists: false } }] },
          data: { revokedAt: now },
        })
        for (const collection of [
          'sync-conflicts',
          'sync-records',
          'encrypted-sync',
          'sync-devices',
          'sync-account-events',
        ] as const) {
          await req.payload.delete({ collection, overrideAccess: true, req, where: { user: { equals: current.userId } } })
        }
        return { nextGeneration }
      })
      if (!erased) return unauthorized(req)
      return Response.json({ ok: true, signedOut: true }, { headers: headers(req) })
    },
  },
]
