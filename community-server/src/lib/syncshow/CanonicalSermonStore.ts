import { sql } from '@payloadcms/db-postgres'
import { createHash } from 'node:crypto'
import type {
  PayloadRequest,
  RequiredDataFromCollectionSlug,
} from 'payload'
import { SyncShowProtocolError } from '@/lib/syncShowProtocol'
import type { SermonWriteBody } from './CommunitySermonWire.ts'
import {
  normalizeSermonDocument,
  type CanonicalSermonDocument,
} from './SermonDocument.ts'
import {
  lockedCommunityTimeZone,
  payloadPreachedAtForServiceDate,
} from './SermonDateProjection.ts'

export type CanonicalSermonRecord = Record<string, unknown>

export type CanonicalSermonCreateResult = Readonly<{
  sermon: CanonicalSermonRecord
  created: boolean
}>

type SermonTransactionAdapter = {
  beginTransaction: () => Promise<null | number | string>
  commitTransaction: (id: number | string) => Promise<void>
  rollbackTransaction: (id: number | string) => Promise<void>
  sessions?: Record<string, {
    db: {
      execute: (query: unknown) => Promise<{
        rows?: CanonicalSermonRecord[]
      }>
    }
  }>
}

export type CanonicalSermonTransactionDatabase = NonNullable<
  SermonTransactionAdapter['sessions']
>[string]['db']

export type CanonicalSermonCreateOptions = Readonly<{
  authorize?: (
    transactionDatabase: CanonicalSermonTransactionDatabase,
  ) => Promise<void>
}>

function record(value: unknown): CanonicalSermonRecord {
  return value as CanonicalSermonRecord
}

function requestHash(write: SermonWriteBody): string {
  return createHash('sha256')
    .update(write.syncId, 'utf8')
    .update('\0')
    .update(write.revision, 'utf8')
    .update('\0')
    .update(write.documentSource, 'utf8')
    .digest('hex')
}

function unavailableSourceObjects(document: CanonicalSermonDocument) {
  return document.sources.map(source => ({
    sourceId: source.id,
    sha256: source.sha256,
    sizeBytes: source.sizeBytes,
    available: false,
  }))
}

function canonicalSermonData(
  write: SermonWriteBody,
  document: CanonicalSermonDocument,
  timeZone: string,
) {
  if (document.publication.status === 'published') {
    throw new SyncShowProtocolError(
      'PUBLICATION_NOT_ALLOWED',
      'SyncShow sermon write access cannot publish a sermon.',
      409,
    )
  }
  if (document.publication.status === 'archived'
    && (
      document.publication.visibility !== 'private'
      || document.publication.publishedAt !== null
      || document.publication.canonicalUrl !== null
    )) {
    throw new SyncShowProtocolError(
      'INVALID_ARCHIVE_TOMBSTONE',
      'Archived sermons must be private tombstones without publication residue.',
      409,
    )
  }
  const title = document.titles[document.defaultLanguage]
  const series = document.series?.titles[document.defaultLanguage] || null
  return {
    title,
    slug: `sync-${createHash('sha256').update(write.syncId, 'utf8').digest('hex').slice(0, 24)}`,
    speaker: document.speaker.name,
    preachedAt: payloadPreachedAtForServiceDate(document.serviceDate, timeZone),
    series,
    status: 'draft' as const,
    syncId: write.syncId,
    syncCurrentDocumentSource: write.documentSource,
    syncCurrentRevision: write.revision,
    syncArchived: document.publication.status === 'archived',
    syncPublicationStatus: document.publication.status,
    syncVisibility: document.publication.visibility,
    syncSourceObjects: unavailableSourceObjects(document),
    syncChangedAt: new Date().toISOString(),
  }
}

async function findByIdempotencyKey(
  req: PayloadRequest,
  communityId: number,
  idempotencyKey: string,
): Promise<CanonicalSermonRecord | undefined> {
  const sermon = (await req.payload.find({
    collection: 'sermons',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      and: [
        { community: { equals: communityId } },
        { syncCreateIdempotencyKey: { equals: idempotencyKey } },
      ],
    },
  })).docs[0]
  return sermon ? record(sermon) : undefined
}

async function appendCanonicalSermonChange(
  req: PayloadRequest,
  communityId: number,
  sermon: CanonicalSermonRecord,
): Promise<void> {
  await req.payload.create({
    collection: 'syncshow-sermon-changes' as never,
    overrideAccess: true,
    context: { syncShowSermonChangeMutation: true },
    req,
    data: {
      community: communityId,
      sermon: Number(sermon.id),
      syncId: String(sermon.syncId),
      syncVersion: Number(sermon.syncVersion),
      revision: String(sermon.syncCurrentRevision),
      documentSource: String(sermon.syncCurrentDocumentSource),
      archived: sermon.syncArchived === true,
      changedAt: String(sermon.syncChangedAt),
    } as never,
  })
}

export async function findCanonicalSermon(
  req: PayloadRequest,
  communityId: number,
  syncId: string,
): Promise<CanonicalSermonRecord | undefined> {
  const sermon = (await req.payload.find({
    collection: 'sermons',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      and: [
        { community: { equals: communityId } },
        { syncId: { equals: syncId } },
      ],
    },
  })).docs[0]
  return sermon ? record(sermon) : undefined
}

/**
 * Atomically creates a canonical sermon and its first append-only journal row.
 * A matching idempotency key replays the authoritative current record, while
 * reusing a key for different canonical bytes remains a conflict.
 */
export async function createCanonicalSermon(
  req: PayloadRequest,
  communityId: number,
  write: SermonWriteBody,
  idempotencyKey: string,
  options: CanonicalSermonCreateOptions = {},
): Promise<CanonicalSermonCreateResult> {
  const adapter = req.payload.db as unknown as SermonTransactionAdapter
  const transactionId = await adapter.beginTransaction()
  if (!transactionId || !adapter.sessions?.[String(transactionId)]?.db) {
    throw new SyncShowProtocolError(
      'IDEMPOTENCY_UNAVAILABLE',
      'Atomic sermon creation is temporarily unavailable.',
      503,
    )
  }
  const transactionDb = adapter.sessions[String(transactionId)].db
  const previousTransactionId = req.transactionID
  const hash = requestHash(write)
  let committed = false
  try {
    req.transactionID = transactionId
    // Payload's journal id uses a PostgreSQL sequence. Holding one global
    // transaction lock makes allocation and commit order agree, so a later
    // committed event can never hide an earlier uncommitted event behind a
    // cursor.
    await transactionDb.execute(sql`
      SELECT pg_advisory_xact_lock(hashtext('syncshow-sermon-change-sequence'));
    `)
    const lockKeys = [
      `syncshow-sermon-create:${communityId}:${idempotencyKey}`,
      `syncshow-sermon-id:${communityId}:${write.syncId}`,
    ].sort()
    for (const lockKey of lockKeys) {
      await transactionDb.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}));`)
    }

    // Manager-facing callers can lock and recheck their live authorization in
    // this same transaction before either a replay or a fresh create returns.
    await options.authorize?.(transactionDb)

    const byKey = await findByIdempotencyKey(req, communityId, idempotencyKey)
    if (byKey) {
      if (String(byKey.syncCreateIdempotencyHash || '') !== hash) {
        throw new SyncShowProtocolError(
          'IDEMPOTENCY_KEY_REUSED',
          'This Idempotency-Key was already used for a different sermon create request.',
          409,
        )
      }
      // The key/hash pair proves the original create request. Return the
      // authoritative current representation rather than replaying stale
      // version-1 content after another authorized writer has advanced it.
      await adapter.commitTransaction(transactionId)
      committed = true
      return { sermon: byKey, created: false }
    }

    const bySyncId = await findCanonicalSermon(req, communityId, write.syncId)
    if (bySyncId) {
      throw new SyncShowProtocolError(
        'SYNC_ID_EXISTS',
        'A sermon already uses this syncId. Retry creation with its original Idempotency-Key.',
        409,
      )
    }

    const document = normalizeSermonDocument(JSON.parse(write.documentSource))
    const timeZone = await lockedCommunityTimeZone(transactionDb, communityId)
    const created = await req.payload.create({
      collection: 'sermons',
      overrideAccess: true,
      showHiddenFields: true,
      context: { syncShowSermonMutation: true },
      req,
      data: {
        ...canonicalSermonData(write, document, timeZone),
        community: communityId,
        syncVersion: 1,
        syncCreateIdempotencyKey: idempotencyKey,
        syncCreateIdempotencyHash: hash,
      } as unknown as RequiredDataFromCollectionSlug<'sermons'>,
    })
    await appendCanonicalSermonChange(req, communityId, record(created))
    await adapter.commitTransaction(transactionId)
    committed = true
    return { sermon: record(created), created: true }
  } catch (error) {
    if (!committed) await adapter.rollbackTransaction(transactionId)
    throw error
  } finally {
    req.transactionID = previousTransactionId
  }
}
