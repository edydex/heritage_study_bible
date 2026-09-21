import { sql } from '@payloadcms/db-postgres'
import { createHash } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import {
  MAX_PUBLIC_SERMON_CATALOG_ITEMS,
  buildPublicSermonPassageIndex,
  buildPublicSermonCatalogFromItemSources,
  parsePublicSermonCatalogSource,
  type StoredPublicSermonPublication,
} from './PublicSermonPublication.ts'
import {
  activePublicProjectionRecord,
  nextCanonicalPublicationTime,
  normalizeStoredManagerSermonPublication,
  publicationFieldsFromPayload,
  type StoredManagerSermonPublication,
} from './ManagerSermonPublication.ts'

type RequestDoc = Record<string, unknown>

type PublicDatabaseResult = { rows?: RequestDoc[] } | RequestDoc[]

type PublicPublicationDatabase = {
  drizzle?: {
    execute: (query: unknown) => Promise<PublicDatabaseResult>
  }
}

type PublicPublicationPayload = {
  db: PublicPublicationDatabase
}

export type PublicationTransactionDatabase = {
  execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }>
}

export type StoredPublicSermonCatalog = Readonly<{
  schemaVersion: 1
  generation: number
  changedAt: string
  checksum: string
  source: string
  passageIndexChecksum: string
  passageIndexSource: string
}>

const SHA256_PATTERN = /^[a-f0-9]{64}$/

function canonicalTimestamp(value: unknown): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new Error('Stored sermon catalog timestamp is invalid.')
    }
    return value.toISOString()
  }
  const source = String(value || '')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(source)) {
    if (Number.isFinite(Date.parse(source)) && new Date(source).toISOString() === source) {
      return source
    }
    throw new Error('Stored sermon catalog timestamp is invalid.')
  }
  // Raw node-postgres TIMESTAMPTZ values use PostgreSQL's offset form instead
  // of the ISO bytes returned by Payload's Local API.
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?[+-]\d{2}(?::?\d{2})?$/.test(source)) {
    throw new Error('Stored sermon catalog timestamp is invalid.')
  }
  const parsed = new Date(source)
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error('Stored sermon catalog timestamp is invalid.')
  }
  return parsed.toISOString()
}

function checksum(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

function validatePublicSermonCatalogRow(raw: RequestDoc): StoredPublicSermonCatalog {
  const schemaVersion = Number(raw.schemaVersion)
  const generation = Number(raw.generation)
  const source = raw.source
  const storedChecksum = String(raw.checksum || '')
  const passageIndexSource = raw.passageIndexSource
  const passageIndexChecksum = String(raw.passageIndexChecksum || '')
  if (
    schemaVersion !== 1
    || !Number.isSafeInteger(generation)
    || generation < 1
    || typeof source !== 'string'
    || !SHA256_PATTERN.test(storedChecksum)
    || checksum(source) !== storedChecksum
    || typeof passageIndexSource !== 'string'
    || !SHA256_PATTERN.test(passageIndexChecksum)
    || checksum(passageIndexSource) !== passageIndexChecksum
  ) {
    throw new Error('Stored sermon catalog authority is invalid.')
  }
  const passageIndex = buildPublicSermonPassageIndex(
    parsePublicSermonCatalogSource(source),
  )
  if (
    passageIndex.source !== passageIndexSource
    || passageIndex.checksum !== passageIndexChecksum
  ) {
    throw new Error('Stored sermon catalog authority is invalid.')
  }
  return Object.freeze({
    schemaVersion: 1,
    generation,
    changedAt: canonicalTimestamp(raw.changedAt),
    checksum: storedChecksum,
    source,
    passageIndexChecksum,
    passageIndexSource,
  })
}

export async function findSermonPublication(
  req: PayloadRequest,
  communityId: number,
  sermonId: number,
): Promise<RequestDoc | null> {
  const result = await req.payload.find({
    collection: 'syncshow-sermon-publications' as never,
    depth: 0,
    limit: 2,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      and: [
        { community: { equals: communityId } },
        { sermon: { equals: sermonId } },
      ],
    },
  })
  if (result.docs.length > 1) {
    throw new Error('Sermon publication uniqueness was violated.')
  }
  return result.docs[0] as unknown as RequestDoc || null
}

export function validateSermonPublicationRow(
  raw: unknown,
): StoredManagerSermonPublication {
  return normalizeStoredManagerSermonPublication(publicationFieldsFromPayload(raw))
}

/**
 * Must run inside the caller's transaction after its Sermons row is locked.
 */
export async function deactivateSermonPublicationForArchive(
  req: PayloadRequest,
  communityId: number,
  sermonId: number,
  withdrawnAt: string,
) {
  const row = await findSermonPublication(req, communityId, sermonId)
  if (!row) return null
  const publication = validateSermonPublicationRow(row)
  if (!publication.active) return publication
  const monotonicWithdrawnAt = nextCanonicalPublicationTime(
    publication.publishedAt,
    new Date(withdrawnAt),
  )
  const updated = await req.payload.update({
    collection: 'syncshow-sermon-publications' as never,
    id: row.id as never,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    data: {
      active: false,
      publicationVersion: publication.publicationVersion + 1,
      withdrawnAt: monotonicWithdrawnAt,
    } as never,
  })
  const validated = validateSermonPublicationRow(updated)
  await refreshPublicSermonCatalog(req, communityId, monotonicWithdrawnAt)
  return validated
}

function publicDatabase(payload: PublicPublicationPayload) {
  const database = payload.db.drizzle
  if (!database) throw new Error('Public sermon publication database is unavailable.')
  return database
}

function publicDatabaseRows(result: PublicDatabaseResult): RequestDoc[] {
  if (Array.isArray(result)) return result
  return Array.isArray(result.rows) ? result.rows : []
}

export async function loadStoredPublicSermonCatalog(
  payload: PublicPublicationPayload,
  communityId: number,
): Promise<StoredPublicSermonCatalog | null> {
  const result = await publicDatabase(payload).execute(sql`
    SELECT
      "schema_version" AS "schemaVersion",
      "generation" AS "generation",
      "changed_at" AS "changedAt",
      "checksum" AS "checksum",
      "source" AS "source",
      "passage_index_checksum" AS "passageIndexChecksum",
      "passage_index_source" AS "passageIndexSource"
    FROM "syncshow_sermon_publication_catalogs"
    WHERE "community_id" = ${communityId}
    LIMIT 2;
  `)
  const rows = publicDatabaseRows(result)
  if (rows.length > 1) throw new Error('Sermon catalog authority uniqueness was violated.')
  return rows[0] ? validatePublicSermonCatalogRow(rows[0]) : null
}

export async function loadActivePublicSermonPublication(
  payload: PublicPublicationPayload,
  communityId: number,
  publicId: string,
): Promise<StoredPublicSermonPublication | null> {
  const result = await publicDatabase(payload).execute(sql`
    SELECT
      p."schema_version" AS "schemaVersion",
      p."active" AS "active",
      p."visibility" AS "visibility",
      p."publication_version" AS "publicationVersion",
      p."published_at" AS "publishedAt",
      p."withdrawn_at" AS "withdrawnAt",
      p."sync_id" AS "syncId",
      p."public_id" AS "publicId",
      p."public_revision" AS "publicRevision",
      p."published_document_source" AS "publishedDocumentSource",
      p."selected_body_entry_ids" AS "selectedBodyEntryIds",
      p."selected_media_ids" AS "selectedMediaIds",
      p."detail_checksum" AS "detailChecksum",
      p."detail_source" AS "detailSource",
      p."catalog_item_checksum" AS "catalogItemChecksum",
      p."catalog_item_source" AS "catalogItemSource"
    FROM "syncshow_sermon_publications" p
    INNER JOIN "sermons" s
      ON s."id" = p."sermon_id"
      AND s."community_id" = p."community_id"
      AND s."sync_id" = p."sync_id"
    WHERE p."community_id" = ${communityId}
      AND p."public_id" = ${publicId}
      AND p."active" = true
      AND p."visibility" = 'public'
      AND s."sync_archived" IS NOT TRUE
    LIMIT 2;
  `)
  const rows = publicDatabaseRows(result)
  if (rows.length > 1) throw new Error('Public sermon identity uniqueness was violated.')
  const row = rows[0]
  return row
    ? activePublicProjectionRecord(
        normalizeStoredManagerSermonPublication(publicationFieldsFromPayload({
          ...row,
          schemaVersion: Number(row.schemaVersion),
          publicationVersion: Number(row.publicationVersion),
          publishedAt: canonicalTimestamp(row.publishedAt),
          withdrawnAt: row.withdrawnAt == null
            ? null
            : canonicalTimestamp(row.withdrawnAt),
        })),
      )
    : null
}

async function findSermonCatalog(
  req: PayloadRequest,
  communityId: number,
): Promise<RequestDoc | null> {
  const result = await req.payload.find({
    collection: 'syncshow-sermon-publication-catalogs' as never,
    depth: 0,
    limit: 2,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: { community: { equals: communityId } },
  })
  if (result.docs.length > 1) {
    throw new Error('Sermon publication catalog uniqueness was violated.')
  }
  return result.docs[0] as unknown as RequestDoc || null
}

function transactionDatabase(req: PayloadRequest): PublicationTransactionDatabase {
  const adapter = req.payload.db as unknown as {
    sessions?: Record<string, { db: PublicationTransactionDatabase }>
  }
  const transactionId = req.transactionID
  const database = transactionId == null
    ? null
    : adapter.sessions?.[String(transactionId)]?.db
  if (!database) {
    throw new Error('Sermon catalog update requires the active publication transaction.')
  }
  return database
}

export async function refreshPublicSermonCatalog(
  req: PayloadRequest,
  communityId: number,
  changedAtCandidate: string,
) {
  const database = transactionDatabase(req)
  // Lock the already-initialized singleton before taking the active-item
  // snapshot. A waiter under READ COMMITTED then sees every publication state
  // committed by the previous catalog writer.
  const locked = (await database.execute(sql`
    SELECT "id"
    FROM "syncshow_sermon_publication_catalogs"
    WHERE "community_id" = ${communityId}
    FOR UPDATE;
  `)).rows?.[0]
  if (!locked) {
    throw new Error('Sermon catalog authority has not been initialized.')
  }
  const existingRow = await findSermonCatalog(req, communityId)
  if (!existingRow) throw new Error('Sermon catalog authority has not been initialized.')
  const existing = validatePublicSermonCatalogRow(existingRow)
  const itemResult = await database.execute(sql`
    SELECT p."catalog_item_source" AS "catalogItemSource"
    FROM "syncshow_sermon_publications" p
    INNER JOIN "sermons" s
      ON s."id" = p."sermon_id"
      AND s."community_id" = p."community_id"
      AND s."sync_id" = p."sync_id"
    WHERE p."community_id" = ${communityId}
      AND p."active" = true
      AND p."visibility" = 'public'
      AND s."sync_archived" IS NOT TRUE
    ORDER BY p."public_id" ASC
    LIMIT ${MAX_PUBLIC_SERMON_CATALOG_ITEMS + 1};
  `)
  const rows = itemResult.rows || []
  if (rows.length > MAX_PUBLIC_SERMON_CATALOG_ITEMS) {
    throw new Error('Public sermon catalog exceeds its safe item limit.')
  }
  const catalog = buildPublicSermonCatalogFromItemSources(
    rows.map(row => row.catalogItemSource),
  )
  const passageIndex = buildPublicSermonPassageIndex(catalog.catalog)
  const changedAt = nextCanonicalPublicationTime(
    existing.changedAt,
    new Date(changedAtCandidate),
  )
  const data = {
    community: communityId,
    schemaVersion: 1,
    generation: existing.generation + 1,
    changedAt,
    checksum: catalog.checksum,
    source: catalog.source,
    passageIndexChecksum: passageIndex.checksum,
    passageIndexSource: passageIndex.source,
  }
  const stored = await req.payload.update({
    collection: 'syncshow-sermon-publication-catalogs' as never,
    id: existingRow.id as never,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    data: data as never,
  })
  return validatePublicSermonCatalogRow(stored as unknown as RequestDoc)
}

export async function ensurePublicSermonCatalog(
  payload: Payload,
  communityId: number,
) {
  const find = async () => (await payload.find({
    collection: 'syncshow-sermon-publication-catalogs' as never,
    depth: 0,
    limit: 2,
    overrideAccess: true,
    showHiddenFields: true,
    where: { community: { equals: communityId } },
  })).docs as unknown as RequestDoc[]
  const existing = await find()
  if (existing.length > 1) throw new Error('Sermon catalog authority uniqueness was violated.')
  if (existing[0]) return validatePublicSermonCatalogRow(existing[0])
  const catalog = buildPublicSermonCatalogFromItemSources([])
  const passageIndex = buildPublicSermonPassageIndex(catalog.catalog)
  try {
    const created = await payload.create({
      collection: 'syncshow-sermon-publication-catalogs' as never,
      overrideAccess: true,
      showHiddenFields: true,
      data: {
        community: communityId,
        schemaVersion: 1,
        generation: 1,
        changedAt: new Date().toISOString(),
        checksum: catalog.checksum,
        source: catalog.source,
        passageIndexChecksum: passageIndex.checksum,
        passageIndexSource: passageIndex.source,
      } as never,
    })
    return validatePublicSermonCatalogRow(created as unknown as RequestDoc)
  } catch (error) {
    // Multiple app workers may initialize together. Only a validated winner
    // can satisfy the unique community pointer.
    const afterRace = await find()
    if (afterRace.length === 1) return validatePublicSermonCatalogRow(afterRace[0])
    throw error
  }
}
