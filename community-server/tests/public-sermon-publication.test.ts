import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  PUBLIC_SERMON_CATALOG_MEDIA_TYPE,
  PUBLIC_SERMON_CATALOG_PATH,
  PUBLIC_SERMON_CONTENT_BASE_PATH,
  PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
  PUBLIC_SERMON_DISCOVERY_DESCRIPTOR,
  PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
  PUBLIC_SERMON_PASSAGE_INDEX_PATH,
  PUBLIC_SERMON_PUBLICATION_KIND,
  PublicSermonPublicationError,
  buildPublicSermonCatalog,
  buildPublicSermonPassageIndex,
  buildPublicSermonProjection,
  derivePublicSermonId,
  normalizeStoredPublicSermonPublication,
  parsePublicSermonDetailSource,
  parsePublicSermonPassageIndexSource,
  publicSermonDetailFromPublications,
  publicSermonSourceResponse,
  serializePublicSermonDetail,
} from '../src/lib/syncshow/PublicSermonPublication.ts'

type Fixture = {
  documentSource: string
  publicationState: {
    publicRevision: string
    publicId: string
    detailChecksum: string
    passageIndexChecksum: string
    publishedAt: string
    selectedBodyEntryIds: string[]
    selectedMediaIds: string[]
  }
  detailSource: string
  catalogSource: string
  passageIndexSource: string
}

const fixture = JSON.parse(readFileSync(
  new URL('../../tests/fixtures/community-sermon-publication-conformance-v1.json', import.meta.url),
  'utf8',
)) as Fixture

function sha256(source: string) {
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

function projectionOptions(overrides: Record<string, unknown> = {}) {
  return {
    documentSource: fixture.documentSource,
    publicRevision: fixture.publicationState.publicRevision,
    selectedBodyEntryIds: fixture.publicationState.selectedBodyEntryIds,
    selectedMediaIds: fixture.publicationState.selectedMediaIds,
    ...overrides,
  }
}

function storedPublication(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    active: true,
    visibility: 'public',
    publicationVersion: 1,
    publishedAt: fixture.publicationState.publishedAt,
    sermonId: 'Golden:Sermon:2026-07-26',
    publicId: fixture.publicationState.publicId,
    publicRevision: fixture.publicationState.publicRevision,
    selectedBodyEntryIds: fixture.publicationState.selectedBodyEntryIds,
    selectedMediaIds: fixture.publicationState.selectedMediaIds,
    detailChecksum: fixture.publicationState.detailChecksum,
    detailSource: fixture.detailSource,
    ...overrides,
  }
}

function expectCode(code: string, callback: () => unknown) {
  assert.throws(callback, (error: unknown) => {
    assert.ok(error instanceof PublicSermonPublicationError)
    assert.equal(error.code, code)
    return true
  })
}

test('positive descriptor is exact and points only to the strict publication lane', () => {
  assert.deepEqual(PUBLIC_SERMON_DISCOVERY_DESCRIPTOR, {
    schemaVersion: 1,
    kind: PUBLIC_SERMON_PUBLICATION_KIND,
    catalog: {
      url: PUBLIC_SERMON_CATALOG_PATH,
      mediaType: PUBLIC_SERMON_CATALOG_MEDIA_TYPE,
    },
    detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
    passageIndex: {
      url: PUBLIC_SERMON_PASSAGE_INDEX_PATH,
      mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
    },
  })
  assert.equal(PUBLIC_SERMON_CATALOG_PATH, '/publications/sermons/catalog.json')
  assert.equal(PUBLIC_SERMON_CONTENT_BASE_PATH, '/content/sermons')
  assert.equal(PUBLIC_SERMON_PASSAGE_INDEX_PATH, '/indexes/sermon-passages')
  assert.equal(PUBLIC_SERMON_DETAIL_MEDIA_TYPE, 'application/vnd.heritage.sermon+json')
})

test('explicit golden selections produce exact cross-repository public bytes', () => {
  const projection = buildPublicSermonProjection(projectionOptions())
  assert.equal(projection.detailSource, fixture.detailSource)
  assert.equal(projection.detailChecksum, fixture.publicationState.detailChecksum)
  assert.equal(projection.detail.publicId, fixture.publicationState.publicId)
  assert.equal(
    projection.catalogItem.content.url,
    `${PUBLIC_SERMON_CONTENT_BASE_PATH}/${fixture.publicationState.publicId}`,
  )

  for (const privateValue of [
    'private-pastor-manuscript.docx',
    'private-message-id',
    'Private inbox identity',
    'private-body-en',
    'private-audio-id',
    'private-pending-notes-id',
    'Проверенный русский текст проповеди.',
  ]) {
    assert.equal(projection.detailSource.includes(privateValue), false, privateValue)
  }
})

test('projection requires exact revision plus explicit, valid body and media selections', () => {
  expectCode('PUBLIC_REVISION_MISMATCH', () => buildPublicSermonProjection(
    projectionOptions({ publicRevision: 'f'.repeat(64) }),
  ))
  expectCode('UNKNOWN_PUBLIC_BODY_SELECTION', () => buildPublicSermonProjection(
    projectionOptions({ selectedBodyEntryIds: ['private-body-missing'] }),
  ))
  expectCode('PUBLIC_MEDIA_NOT_READY', () => buildPublicSermonProjection(
    projectionOptions({ selectedMediaIds: ['private-pending-notes-id'] }),
  ))
  expectCode('DUPLICATE_PUBLIC_SELECTION', () => buildPublicSermonProjection(
    projectionOptions({
      selectedBodyEntryIds: [
        fixture.publicationState.selectedBodyEntryIds[0],
        fixture.publicationState.selectedBodyEntryIds[0],
      ],
    }),
  ))
})

test('selected public media rejects query strings and private or IP hosts', () => {
  for (const [label, url] of [
    ['HTTP', 'http://media.example.church/sermons/prayer.mp3'],
    ['query string', 'https://media.example.church/sermons/prayer.mp3?token=temporary'],
    ['fragment', 'https://media.example.church/sermons/prayer.mp3#player'],
    ['single-label host', 'https://sermons/prayer.mp3'],
    ['nonstandard port', 'https://media.example.church:8443/sermons/prayer.mp3'],
    ['private IP', 'https://10.0.0.7/sermons/prayer.mp3'],
    ['private-style host', 'https://sermons.church.internal/prayer.mp3'],
    ['reserved example host', 'https://sermons.church.example/prayer.mp3'],
    ['reserved onion host', 'https://sermons.church.onion/prayer.mp3'],
  ]) {
    const document = JSON.parse(fixture.documentSource)
    const selectedId = fixture.publicationState.selectedMediaIds[0]
    const media = document.media.find((item: { id: string }) => item.id === selectedId)
    assert.ok(media, label)
    media.url = url
    const documentSource = `${JSON.stringify(document)}\n`
    expectCode('PUBLIC_MEDIA_NOT_READY', () => buildPublicSermonProjection({
      ...projectionOptions(),
      documentSource,
      publicRevision: sha256(documentSource),
    }))
  }
})

test('private, members, and unlisted canonical revisions all fail closed', () => {
  for (const visibility of ['private', 'members', 'unlisted']) {
    const document = JSON.parse(fixture.documentSource)
    document.publication.visibility = visibility
    const documentSource = `${JSON.stringify(document)}\n`
    expectCode('SERMON_NOT_PUBLICLY_ELIGIBLE', () => buildPublicSermonProjection({
      ...projectionOptions(),
      documentSource,
      publicRevision: sha256(documentSource),
    }))
  }
})

test('strict detail parser rejects private fields, identity drift, and noncanonical bytes', () => {
  const privateDetail = JSON.parse(fixture.detailSource)
  privateDetail.sources = [{ fileName: 'private.docx' }]
  expectCode(
    'INVALID_PUBLIC_SERMON',
    () => parsePublicSermonDetailSource(`${JSON.stringify(privateDetail)}\n`),
  )

  const identityDrift = JSON.parse(fixture.detailSource)
  identityDrift.publicId = derivePublicSermonId('Different:Sermon')
  expectCode(
    'PUBLIC_ID_MISMATCH',
    () => serializePublicSermonDetail(identityDrift),
  )
  expectCode(
    'NONCANONICAL_PUBLIC_DETAIL_SOURCE',
    () => parsePublicSermonDetailSource(fixture.detailSource.trimEnd()),
  )

  const unstableMedia = JSON.parse(fixture.detailSource)
  unstableMedia.media[0].url += '?token=temporary'
  expectCode(
    'INVALID_PUBLIC_URL',
    () => serializePublicSermonDetail(unstableMedia),
  )
})

test('stored publications require active public state and exact checksummed bytes', () => {
  const normalized = normalizeStoredPublicSermonPublication(storedPublication())
  assert.equal(normalized.detail.publicId, fixture.publicationState.publicId)
  assert.equal(normalized.catalogItem.checksum, fixture.publicationState.detailChecksum)

  for (const unsafe of [
    { visibility: 'unlisted' },
    { visibility: 'members' },
    { active: false },
  ]) {
    expectCode(
      'PUBLICATION_NOT_ACTIVE',
      () => normalizeStoredPublicSermonPublication(storedPublication(unsafe)),
    )
  }
  expectCode(
    'PUBLIC_DETAIL_CHECKSUM_MISMATCH',
    () => normalizeStoredPublicSermonPublication(
      storedPublication({ detailChecksum: 'f'.repeat(64) }),
    ),
  )
  expectCode(
    'STORED_PUBLICATION_IDENTITY_MISMATCH',
    () => normalizeStoredPublicSermonPublication(
      storedPublication({ publicRevision: 'e'.repeat(64) }),
    ),
  )
  expectCode(
    'INVALID_STORED_PUBLICATION',
    () => normalizeStoredPublicSermonPublication(
      storedPublication({ canonicalDocumentSource: fixture.documentSource }),
    ),
  )
})

test('catalog bytes match the gateway fixture and sort deterministically', () => {
  const one = buildPublicSermonCatalog([storedPublication()])
  assert.equal(one.source, fixture.catalogSource)

  const secondDetail = JSON.parse(fixture.detailSource)
  secondDetail.sermonId = 'Golden:Sermon:Earlier'
  secondDetail.publicId = derivePublicSermonId(secondDetail.sermonId)
  secondDetail.sermonRevision = 'a'.repeat(64)
  secondDetail.serviceDate = '2026-07-19'
  secondDetail.titles = { en: 'Earlier sermon' }
  secondDetail.defaultLanguage = 'en'
  const secondSource = serializePublicSermonDetail(secondDetail)
  const second = storedPublication({
    sermonId: secondDetail.sermonId,
    publicId: secondDetail.publicId,
    publicRevision: secondDetail.sermonRevision,
    detailSource: secondSource,
    detailChecksum: sha256(secondSource),
    publishedAt: '2026-07-19T20:00:00.000Z',
  })
  const forward = buildPublicSermonCatalog([second, storedPublication()])
  const reverse = buildPublicSermonCatalog([storedPublication(), second])
  assert.equal(forward.source, reverse.source)
  assert.deepEqual(
    forward.catalog.items.map(item => item.serviceDate),
    ['2026-07-26', '2026-07-19'],
  )
})

test('passage-index bytes and checksum match the exact cross-runtime contract', () => {
  const catalog = buildPublicSermonCatalog([storedPublication()])
  const index = buildPublicSermonPassageIndex(catalog.catalog)
  assert.equal(index.source, fixture.passageIndexSource)
  assert.equal(index.checksum, fixture.publicationState.passageIndexChecksum)
  assert.deepEqual(
    parsePublicSermonPassageIndexSource(index.source),
    index.passageIndex,
  )
  expectCode(
    'NONCANONICAL_PUBLIC_PASSAGE_INDEX_SOURCE',
    () => parsePublicSermonPassageIndexSource(index.source.trimEnd()),
  )
})

test('detail lookup and source response preserve exact revision/checksum identity', async () => {
  const record = publicSermonDetailFromPublications(
    [storedPublication()],
    fixture.publicationState.publicId,
  )
  if (!record) throw new Error('Expected the golden public sermon publication.')
  const response = publicSermonSourceResponse(
    record.detailSource,
    PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
    record.detailChecksum,
  )
  assert.equal(response.status, 200)
  assert.equal(
    response.headers.get('content-type'),
    `${PUBLIC_SERMON_DETAIL_MEDIA_TYPE}; charset=utf-8`,
  )
  assert.equal(
    response.headers.get('etag'),
    `"sha256:${fixture.publicationState.detailChecksum}"`,
  )
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(await response.text(), fixture.detailSource)
  assert.equal(
    publicSermonDetailFromPublications([storedPublication()], 'sermon-no-such-publication'),
    null,
  )
})
