import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  canonicalBibleRangesIntersect,
  normalizeCanonicalBibleRange,
} from '../src/utils/canonicalBibleRanges.js'
import {
  MAX_PUBLIC_SERMON_DETAIL_BYTES,
  PublicSermonContractError,
  derivePublicSermonId,
  parseAndVerifyPublicSermon,
  parsePublicSermonCatalogSource,
  parsePublicSermonDetailSource,
  publicSermonCacheIdentity,
  queryPublicSermonsForRange,
  serializePublicSermonCatalog,
  serializePublicSermonDetail,
  sha256Hex,
  verifyPublicSermonCatalogDetail,
} from '../src/services/sermonCatalog.js'

const fixture = JSON.parse(await readFile(new URL(
  './fixtures/community-sermon-publication-conformance-v1.json',
  import.meta.url,
), 'utf8'))

async function expectContractCode(code, operation) {
  await assert.rejects(operation, error => {
    assert.equal(error instanceof PublicSermonContractError, true)
    assert.equal(error.code, code)
    return true
  })
}

test('SyncShow golden bytes parse, hash, agree, and produce a revision-keyed cache identity', async () => {
  const catalog = await parsePublicSermonCatalogSource(fixture.catalogSource)
  const detail = await parsePublicSermonDetailSource(fixture.detailSource)
  const verified = await parseAndVerifyPublicSermon({
    catalogSource: fixture.catalogSource,
    detailSource: fixture.detailSource,
  })

  assert.equal(await serializePublicSermonCatalog(catalog), fixture.catalogSource)
  assert.equal(await serializePublicSermonDetail(detail), fixture.detailSource)
  assert.equal(await sha256Hex(fixture.detailSource), fixture.publicationState.detailChecksum)
  assert.equal(await sha256Hex(fixture.catalogSource), fixture.publicationState.catalogChecksum)
  assert.equal(verified.checksum, fixture.publicationState.detailChecksum)
  assert.equal(verified.item.sermonRevision, fixture.publicationState.publicRevision)
  assert.equal(
    verified.cacheIdentity,
    `public-sermon:v1:${fixture.publicationState.publicId}`
      + `:${fixture.publicationState.publicRevision}`
      + `:${fixture.publicationState.detailChecksum}`,
  )
  assert.equal(Object.isFrozen(verified), true)
  assert.equal(Object.isFrozen(verified.detail.references[0].range), true)

  const publicSources = `${fixture.detailSource}\n${fixture.catalogSource}`
  for (const privateValue of [
    'private-pastor-manuscript.docx',
    'private-message-id',
    'Private inbox identity',
    'private-body-en',
    'private-audio-id',
  ]) {
    assert.equal(publicSources.includes(privateValue), false, privateValue)
  }
})

test('raw public objects reject private or unknown fields before generic resource normalization', async () => {
  const detail = JSON.parse(fixture.detailSource)
  detail.sources = [{ fileName: 'private.docx' }]
  await expectContractCode(
    'INVALID_PUBLIC_SERMON',
    () => parsePublicSermonDetailSource(`${JSON.stringify(detail)}\n`),
  )

  const bodyDetail = JSON.parse(fixture.detailSource)
  bodyDetail.body[0].sourceId = 'private-source-id'
  await expectContractCode(
    'INVALID_PUBLIC_SERMON',
    () => parsePublicSermonDetailSource(`${JSON.stringify(bodyDetail)}\n`),
  )

  const mediaDetail = JSON.parse(fixture.detailSource)
  mediaDetail.media[0].fileName = 'private-recording.mp3'
  await expectContractCode(
    'INVALID_PUBLIC_SERMON',
    () => parsePublicSermonDetailSource(`${JSON.stringify(mediaDetail)}\n`),
  )

  const catalog = JSON.parse(fixture.catalogSource)
  catalog.updatedAt = '2026-07-26T20:00:00.000Z'
  await expectContractCode(
    'INVALID_PUBLIC_SERMON',
    () => parsePublicSermonCatalogSource(`${JSON.stringify(catalog)}\n`),
  )
})

test('canonical sources require exact key order, representation, and one trailing newline', async () => {
  await expectContractCode(
    'NONCANONICAL_PUBLIC_DETAIL_SOURCE',
    () => parsePublicSermonDetailSource(fixture.detailSource.trimEnd()),
  )
  await expectContractCode(
    'NONCANONICAL_PUBLIC_DETAIL_SOURCE',
    () => parsePublicSermonDetailSource(`${fixture.detailSource}\n`),
  )
  await expectContractCode(
    'NONCANONICAL_PUBLIC_DETAIL_SOURCE',
    () => parsePublicSermonDetailSource(
      `${JSON.stringify(JSON.parse(fixture.detailSource), null, 2)}\n`,
    ),
  )
  await expectContractCode(
    'INVALID_PUBLIC_DETAIL_SOURCE',
    () => parsePublicSermonDetailSource('x'.repeat(MAX_PUBLIC_SERMON_DETAIL_BYTES + 1)),
  )
})

test('valid canonical detail tampering is caught by the catalog checksum and exact projection', async () => {
  const catalog = await parsePublicSermonCatalogSource(fixture.catalogSource)
  const detail = JSON.parse(fixture.detailSource)
  detail.body[0].text = 'Tampered public body.'
  const tamperedSource = await serializePublicSermonDetail(detail)

  await expectContractCode(
    'PUBLIC_CATALOG_DETAIL_MISMATCH',
    () => verifyPublicSermonCatalogDetail({ catalog, detailSource: tamperedSource }),
  )
})

test('a different valid catalog identity cannot claim the requested sermon detail', async () => {
  const rawCatalog = JSON.parse(fixture.catalogSource)
  const item = rawCatalog.items[0]
  item.sermonId = 'Golden:Sermon:Different'
  item.id = await derivePublicSermonId(item.sermonId)
  item.content.url = `/content/sermons/${item.id}`
  const catalog = await parsePublicSermonCatalogSource(
    await serializePublicSermonCatalog(rawCatalog),
  )

  await expectContractCode(
    'PUBLIC_CATALOG_ITEM_MISSING',
    () => verifyPublicSermonCatalogDetail({
      catalog,
      detailSource: fixture.detailSource,
    }),
  )
})

test('catalog/detail revision, title, speaker, date, and reference drift fail closed', async t => {
  const mutations = [
    ['revision', item => {
      item.sermonRevision = 'f'.repeat(64)
    }],
    ['title', item => {
      item.title = 'A different title'
      item.titles.en = item.title
    }],
    ['speaker', item => {
      item.speaker.name = 'Another speaker'
    }],
    ['date', item => {
      item.serviceDate = '2026-07-25'
    }],
    ['reference', item => {
      item.references[1].range.start.verse = 3
      item.references[1].range.end.verse = 3
    }],
  ]

  for (const [label, mutate] of mutations) {
    await t.test(label, async () => {
      const rawCatalog = JSON.parse(fixture.catalogSource)
      mutate(rawCatalog.items[0])
      const source = await serializePublicSermonCatalog(rawCatalog)
      const catalog = await parsePublicSermonCatalogSource(source)
      await expectContractCode(
        'PUBLIC_CATALOG_DETAIL_MISMATCH',
        () => verifyPublicSermonCatalogDetail({
          catalog,
          detailSource: fixture.detailSource,
        }),
      )
    })
  }
})

test('whole-chapter and cross-chapter Bible ranges intersect canonically', () => {
  const wholeChapter = normalizeCanonicalBibleRange({
    book: 'Ephesians',
    chapter: 3,
  })
  assert.deepEqual(wholeChapter, {
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: null },
    end: { chapter: 3, verse: null },
  })
  assert.equal(canonicalBibleRangesIntersect(wholeChapter, {
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 1 },
    end: { chapter: 3, verse: 99 },
  }), true)
  assert.equal(canonicalBibleRangesIntersect({
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 20 },
    end: { chapter: 4, verse: 5 },
  }, {
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 4, verse: 1 },
    end: { chapter: 4, verse: 2 },
  }), true)
  assert.equal(canonicalBibleRangesIntersect(wholeChapter, {
    schemaVersion: 1,
    bookId: 'Phil',
    start: { chapter: 3, verse: null },
    end: { chapter: 3, verse: null },
  }), false)
  assert.throws(() => normalizeCanonicalBibleRange({
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 4, verse: 1 },
    end: { chapter: 3, verse: 20 },
  }), error => error.code === 'REVERSED_BIBLE_RANGE')
})

test('golden passage queries match SyncShow primary, mentioned, and excluded results', async () => {
  const catalog = await parsePublicSermonCatalogSource(fixture.catalogSource)
  for (const query of fixture.queries) {
    assert.deepEqual(
      await queryPublicSermonsForRange(catalog, query.range),
      query.expected,
      query.id,
    )
  }
})

test('an overlapping primary reference suppresses mentioned matches for the same sermon', async () => {
  const rawCatalog = JSON.parse(fixture.catalogSource)
  rawCatalog.items[0].references.push({
    role: 'mentioned',
    range: {
      schemaVersion: 1,
      bookId: 'Eph',
      start: { chapter: 3, verse: 18 },
      end: { chapter: 3, verse: 19 },
    },
  })
  const catalog = await parsePublicSermonCatalogSource(
    await serializePublicSermonCatalog(rawCatalog),
  )
  const matches = await queryPublicSermonsForRange(catalog, {
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 18 },
    end: { chapter: 3, verse: 18 },
  })

  assert.equal(matches.primary.length, 1)
  assert.equal(matches.mentioned.length, 0)
  assert.deepEqual(matches.primary[0].matches, [{
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 14 },
    end: { chapter: 3, verse: 21 },
  }])
})

test('cache identity changes with either the immutable revision or exact detail checksum', () => {
  const base = {
    publicId: fixture.publicationState.publicId,
    sermonRevision: fixture.publicationState.publicRevision,
    checksum: fixture.publicationState.detailChecksum,
  }
  const identity = publicSermonCacheIdentity(base)
  assert.notEqual(publicSermonCacheIdentity({
    ...base,
    sermonRevision: 'a'.repeat(64),
  }), identity)
  assert.notEqual(publicSermonCacheIdentity({
    ...base,
    checksum: 'b'.repeat(64),
  }), identity)
})
