import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  buildPublicSermonCatalogFromItemSources,
  buildPublicSermonPassageIndex,
  serializePublicSermonCatalogItem,
} from '../src/lib/syncshow/PublicSermonPublication.ts'
import {
  buildManagerSermonPublicationTransition,
} from '../src/lib/syncshow/ManagerSermonPublication.ts'
import {
  loadActivePublicSermonPublication,
  loadStoredPublicSermonCatalog,
} from '../src/lib/syncshow/SermonPublicationStore.ts'

type AnyRecord = Record<string, any>

const golden = (JSON.parse(readFileSync(
  new URL('./fixtures/syncshow-sermon-contract-v1.json', import.meta.url),
  'utf8',
)) as AnyRecord).sermons.v3

function queryText(query: AnyRecord) {
  let text = ''
  for (const chunk of query?.queryChunks || []) {
    text += chunk && typeof chunk === 'object' && Array.isArray(chunk.value)
      ? chunk.value.join('')
      : '?'
  }
  return text
}

function authoritativeRows() {
  const publishedAt = '2026-07-29T00:00:00.000Z'
  const transition = buildManagerSermonPublicationTransition({
    documentSource: golden.canonicalSource,
    publishedAt,
    selectedBodyEntryIds: ['manuscript-opening'],
    selectedMediaIds: [],
  })
  const catalogItemSource = serializePublicSermonCatalogItem(
    transition.projection.catalogItem,
  )
  const catalog = buildPublicSermonCatalogFromItemSources([catalogItemSource])
  const passageIndex = buildPublicSermonPassageIndex(catalog.catalog)
  return {
    catalog: {
      schemaVersion: 1,
      generation: 2,
      changedAt: new Date(publishedAt),
      checksum: catalog.checksum,
      source: catalog.source,
      passageIndexChecksum: passageIndex.checksum,
      passageIndexSource: passageIndex.source,
    },
    publication: {
      schemaVersion: 1,
      active: true,
      visibility: 'public',
      publicationVersion: 1,
      publishedAt: new Date(publishedAt),
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
    },
  }
}

test('catalog serving reads and validates only the bounded materialized singleton', async () => {
  const rows = authoritativeRows()
  let executed = ''
  const postgresTimestamp = '2026-07-28 17:00:00.000-07'
  const payload = {
    db: {
      drizzle: {
        execute: async (query: unknown) => {
          executed = queryText(query as AnyRecord)
          return [{ ...rows.catalog, changedAt: postgresTimestamp }]
        },
      },
    },
  }
  const catalog = await loadStoredPublicSermonCatalog(payload, 7)
  assert.ok(catalog)
  assert.equal(catalog.source, rows.catalog.source)
  assert.equal(catalog.passageIndexSource, rows.catalog.passageIndexSource)
  assert.equal(catalog.passageIndexChecksum, rows.catalog.passageIndexChecksum)
  assert.equal(catalog.changedAt, '2026-07-29T00:00:00.000Z')
  assert.match(executed, /FROM "syncshow_sermon_publication_catalogs"/)
  assert.doesNotMatch(
    executed,
    /published_document_source|detail_source|syncshow_sermon_publications/,
  )

  const corruptPayload = {
    db: {
      drizzle: {
        execute: async () => ({
          rows: [{ ...rows.catalog, checksum: '0'.repeat(64) }],
        }),
      },
    },
  }
  await assert.rejects(
    loadStoredPublicSermonCatalog(corruptPayload, 7),
    /authority is invalid/i,
  )

  const divergentPassageIndex = {
    db: {
      drizzle: {
        execute: async () => ({
          rows: [{
            ...rows.catalog,
            passageIndexSource: `${rows.catalog.passageIndexSource} `,
            passageIndexChecksum: createHash('sha256')
              .update(`${rows.catalog.passageIndexSource} `, 'utf8')
              .digest('hex'),
          }],
        }),
      },
    },
  }
  await assert.rejects(
    loadStoredPublicSermonCatalog(divergentPassageIndex, 7),
    /authority is invalid/i,
  )
})

test('detail serving validates one joined authority row and returns its exact stored bytes', async () => {
  const rows = authoritativeRows()
  let executed = ''
  const payload = {
    db: {
      drizzle: {
        execute: async (query: unknown) => {
          executed = queryText(query as AnyRecord)
          return {
            rows: [{
              ...rows.publication,
              schemaVersion: String(rows.publication.schemaVersion),
              publicationVersion: String(rows.publication.publicationVersion),
              publishedAt: '2026-07-28 17:00:00.000-07',
            }],
          }
        },
      },
    },
  }
  const publication = await loadActivePublicSermonPublication(
    payload,
    7,
    rows.publication.publicId,
  )
  assert.ok(publication)
  assert.equal(publication.detailSource, rows.publication.detailSource)
  assert.equal(publication.detailChecksum, rows.publication.detailChecksum)
  assert.equal(publication.publishedAt, '2026-07-29T00:00:00.000Z')
  assert.match(executed, /INNER JOIN "sermons"/)
  assert.match(executed, /s\."sync_archived" IS NOT TRUE/)
  assert.match(executed, /p\."active" = true/)

  const corruptPayload = {
    db: {
      drizzle: {
        execute: async () => ({
          rows: [{
            ...rows.publication,
            publishedDocumentSource: `${rows.publication.publishedDocumentSource} `,
          }],
        }),
      },
    },
  }
  await assert.rejects(
    loadActivePublicSermonPublication(
      corruptPayload,
      7,
      rows.publication.publicId,
    ),
    /audit identity/i,
  )
})
