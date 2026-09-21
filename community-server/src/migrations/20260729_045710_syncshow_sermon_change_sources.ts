import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import {
  parseSermonDocument,
  serializeSermonDocument,
} from '../lib/syncshow/SermonDocument.ts'

type BackfillCandidate = {
  archived?: unknown
  documentSource?: unknown
  journalId?: unknown
  syncId?: unknown
}

function resultRows(result: unknown): BackfillCandidate[] {
  if (Array.isArray(result)) return result as BackfillCandidate[]
  if (
    result
    && typeof result === 'object'
    && 'rows' in result
    && Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: BackfillCandidate[] }).rows
  }
  return []
}

function assertCanonicalBackfillCandidate(row: BackfillCandidate) {
  const journalId = Number(row.journalId)
  const syncId = typeof row.syncId === 'string' ? row.syncId : ''
  const documentSource = typeof row.documentSource === 'string'
    ? row.documentSource
    : ''
  if (
    !Number.isSafeInteger(journalId)
    || journalId < 1
    || !syncId
    || typeof row.archived !== 'boolean'
    || !documentSource
  ) {
    throw new Error(
      `Cannot retain exact sermon revision history: journal row ${String(row.journalId)} has no reconstructable canonical source.`,
    )
  }

  let document
  try {
    document = parseSermonDocument(documentSource)
  } catch {
    throw new Error(
      `Cannot retain exact sermon revision history: journal row ${journalId} has no reconstructable canonical source.`,
    )
  }
  if (
    serializeSermonDocument(document) !== documentSource
    || document.id !== syncId
    || (document.publication.status === 'archived') !== row.archived
  ) {
    throw new Error(
      `Cannot retain exact sermon revision history: journal row ${journalId} has no reconstructable canonical source.`,
    )
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // SQL can prove exact byte hashes and row identity, but it cannot reproduce
  // SyncShow's version-aware canonical serializer. Validate every otherwise
  // reconstructable source with the shared parser before making any schema
  // change, so legacy whitespace/key-order drift cannot become authoritative
  // immutable history.
  const candidates = resultRows(await db.execute(sql`
    SELECT
      journal."id" AS "journalId",
      journal."sync_id" AS "syncId",
      journal."archived",
      sermon."sync_current_document_source" AS "documentSource"
    FROM "syncshow_sermon_changes" AS journal
    JOIN "sermons" AS sermon
      ON journal."sermon_id" = sermon."id"
    WHERE journal."community_id" = sermon."community_id"
      AND journal."sync_id" = sermon."sync_id"
      AND journal."revision" = sermon."sync_current_revision"
      AND journal."archived" IS NOT DISTINCT FROM sermon."sync_archived"
      AND sermon."sync_current_document_source" IS NOT NULL
      AND encode(
        sha256(convert_to(sermon."sync_current_document_source", 'UTF8')),
        'hex'
      ) = journal."revision"
    ORDER BY journal."id" ASC;
  `))
  for (const candidate of candidates) {
    assertCanonicalBackfillCandidate(candidate)
  }

  await db.execute(sql`
    ALTER TABLE "syncshow_sermon_changes"
      ADD COLUMN "document_source" varchar;

    -- A current sermon row can safely reconstruct any journal row with the
    -- same exact revision. Never substitute the current bytes for an older,
    -- different revision.
    UPDATE "syncshow_sermon_changes" AS journal
    SET "document_source" = sermon."sync_current_document_source"
    FROM "sermons" AS sermon
    WHERE journal."sermon_id" = sermon."id"
      AND journal."community_id" = sermon."community_id"
      AND journal."sync_id" = sermon."sync_id"
      AND journal."revision" = sermon."sync_current_revision"
      AND journal."archived" IS NOT DISTINCT FROM sermon."sync_archived"
      AND sermon."sync_current_document_source" IS NOT NULL
      AND encode(
        sha256(convert_to(sermon."sync_current_document_source", 'UTF8')),
        'hex'
      ) = journal."revision"
      AND (
        sermon."sync_current_document_source"::jsonb ->> 'id'
      ) = journal."sync_id"
      AND (
        (
          sermon."sync_current_document_source"::jsonb
            #>> '{publication,status}'
        ) = 'archived'
      ) IS NOT DISTINCT FROM journal."archived";

    -- Older revisions cannot be reconstructed from the mutable current row.
    -- Abort the whole transactional migration rather than inventing bytes,
    -- deleting history, or leaving partially authoritative nullable rows.
    DO $migration$
    DECLARE
      unreconstructable_count bigint;
      first_unreconstructable_id integer;
    BEGIN
      SELECT COUNT(*), MIN("id")
      INTO unreconstructable_count, first_unreconstructable_id
      FROM "syncshow_sermon_changes"
      WHERE "document_source" IS NULL;

      IF unreconstructable_count > 0 THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = format(
            'Cannot retain exact sermon revision history: %s journal row(s) have no reconstructable canonical source; first row id %s.',
            unreconstructable_count,
            first_unreconstructable_id
          );
      END IF;
    END
    $migration$;

    ALTER TABLE "syncshow_sermon_changes"
      ALTER COLUMN "document_source" SET NOT NULL;
    ALTER TABLE "syncshow_sermon_changes"
      ADD CONSTRAINT "syncshow_sermon_changes_document_revision_check"
      CHECK (
        "revision" ~ '^[0-9a-f]{64}$'
        AND encode(
          sha256(convert_to("document_source", 'UTF8')),
          'hex'
        ) = "revision"
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Removing this column is reversible only while every retained source is
    -- still exactly reconstructable from the mutable current sermon row.
    -- Once distinct historical revisions exist, fail closed instead of
    -- destroying the only copy of their canonical bytes.
    DO $migration$
    DECLARE
      historical_count bigint;
      first_historical_id integer;
    BEGIN
      SELECT COUNT(*), MIN(journal."id")
      INTO historical_count, first_historical_id
      FROM "syncshow_sermon_changes" AS journal
      LEFT JOIN "sermons" AS sermon
        ON journal."sermon_id" = sermon."id"
      WHERE sermon."id" IS NULL
        OR journal."community_id" IS DISTINCT FROM sermon."community_id"
        OR journal."sync_id" IS DISTINCT FROM sermon."sync_id"
        OR journal."revision" IS DISTINCT FROM sermon."sync_current_revision"
        OR journal."archived" IS DISTINCT FROM sermon."sync_archived"
        OR journal."document_source"
          IS DISTINCT FROM sermon."sync_current_document_source";

      IF historical_count > 0 THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = format(
            'Cannot roll back exact sermon revision history: %s journal row(s) contain canonical source bytes not reconstructable from the current sermon; first row id %s.',
            historical_count,
            first_historical_id
          );
      END IF;
    END
    $migration$;

    ALTER TABLE "syncshow_sermon_changes"
      DROP CONSTRAINT "syncshow_sermon_changes_document_revision_check";
    ALTER TABLE "syncshow_sermon_changes"
      DROP COLUMN "document_source";
  `)
}
