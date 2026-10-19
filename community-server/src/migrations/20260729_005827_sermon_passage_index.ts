import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import {
  buildPublicSermonPassageIndex,
  parsePublicSermonCatalogSource,
} from '../lib/syncshow/PublicSermonPublication.ts'

type CatalogRow = {
  id?: unknown
  source?: unknown
}

function resultRows(result: unknown): CatalogRow[] {
  if (Array.isArray(result)) return result as CatalogRow[]
  if (
    result
    && typeof result === 'object'
    && 'rows' in result
    && Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: CatalogRow[] }).rows
  }
  return []
}

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "syncshow_sermon_publication_catalogs" ADD COLUMN "passage_index_checksum" varchar;
  ALTER TABLE "syncshow_sermon_publication_catalogs" ADD COLUMN "passage_index_source" varchar;`)

  const catalogs = resultRows(await db.execute(sql`
    SELECT "id", "source"
    FROM "syncshow_sermon_publication_catalogs"
    ORDER BY "id" ASC;
  `))
  for (const row of catalogs) {
    const id = Number(row.id)
    if (!Number.isSafeInteger(id) || id < 1 || typeof row.source !== 'string') {
      throw new Error('Stored sermon catalog authority is invalid.')
    }
    const passageIndex = buildPublicSermonPassageIndex(
      parsePublicSermonCatalogSource(row.source),
    )
    await db.execute(sql`
      UPDATE "syncshow_sermon_publication_catalogs"
      SET
        "passage_index_checksum" = ${passageIndex.checksum},
        "passage_index_source" = ${passageIndex.source}
      WHERE "id" = ${id};
    `)
  }

  await db.execute(sql`
    ALTER TABLE "syncshow_sermon_publication_catalogs"
      ALTER COLUMN "passage_index_checksum" SET NOT NULL;
    ALTER TABLE "syncshow_sermon_publication_catalogs"
      ALTER COLUMN "passage_index_source" SET NOT NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "syncshow_sermon_publication_catalogs" DROP COLUMN "passage_index_checksum";
  ALTER TABLE "syncshow_sermon_publication_catalogs" DROP COLUMN "passage_index_source";`)
}
