import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from '@payloadcms/db-postgres'
import {
  parseSermonDocument,
  serializeSermonDocument,
} from '../lib/syncshow/SermonDocument.ts'
import {
  lockedCommunityTimeZone,
  payloadPreachedAtForServiceDate,
  type SermonDateProjectionDatabase,
} from '../lib/syncshow/SermonDateProjection.ts'

type CanonicalSermonProjectionCandidate = {
  communityId?: unknown
  documentSource?: unknown
  sermonId?: unknown
  syncId?: unknown
}

function resultRows(result: unknown): CanonicalSermonProjectionCandidate[] {
  if (Array.isArray(result)) return result as CanonicalSermonProjectionCandidate[]
  if (
    result
    && typeof result === 'object'
    && 'rows' in result
    && Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: CanonicalSermonProjectionCandidate[] }).rows
  }
  return []
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const candidates = resultRows(await db.execute(sql`
    SELECT
      "id" AS "sermonId",
      "community_id" AS "communityId",
      "sync_id" AS "syncId",
      "sync_current_document_source" AS "documentSource"
    FROM "sermons"
    WHERE "sync_id" IS NOT NULL
      OR "sync_current_document_source" IS NOT NULL
    ORDER BY "id" ASC
    FOR UPDATE;
  `))

  for (const candidate of candidates) {
    const sermonId = Number(candidate.sermonId)
    const communityId = Number(candidate.communityId)
    const syncId = typeof candidate.syncId === 'string' ? candidate.syncId : ''
    const documentSource = typeof candidate.documentSource === 'string'
      ? candidate.documentSource
      : ''
    if (
      !Number.isSafeInteger(sermonId)
      || sermonId < 1
      || !Number.isSafeInteger(communityId)
      || communityId < 1
      || !syncId
      || !documentSource
    ) {
      throw new Error(
        'Cannot repair a canonical sermon date projection with incomplete canonical identity.',
      )
    }

    let document
    try {
      document = parseSermonDocument(documentSource)
    } catch {
      throw new Error(
        `Cannot repair canonical sermon ${syncId}: its authoritative document is invalid.`,
      )
    }
    if (
      document.id !== syncId
      || serializeSermonDocument(document) !== documentSource
    ) {
      throw new Error(
        `Cannot repair canonical sermon ${syncId}: its authoritative identity is inconsistent.`,
      )
    }

    const timeZone = await lockedCommunityTimeZone(
      db as unknown as SermonDateProjectionDatabase,
      communityId,
    )
    const preachedAt = payloadPreachedAtForServiceDate(
      document.serviceDate,
      timeZone,
    )
    await db.execute(sql`
      UPDATE "sermons"
      SET "preached_at" = ${preachedAt}::timestamptz
      WHERE "id" = ${sermonId}
        AND "community_id" = ${communityId}
        AND "sync_id" = ${syncId}
        AND "sync_current_document_source" = ${documentSource}
        AND "preached_at" IS DISTINCT FROM ${preachedAt}::timestamptz;
    `)
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // This is a projection-only data correction. Reintroducing midnight UTC on
  // rollback would knowingly restore the previous-day admin display, so the
  // corrected derived values intentionally remain in place.
}
