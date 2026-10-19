import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
  PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
  normalizeContentServerManifestUrl,
  validateContentCatalog,
  validateContentServerManifest,
} from '../src/utils/contentProtocol.js'

test('server URLs resolve to the conventional static manifest', () => {
  assert.equal(
    normalizeContentServerManifestUrl('https://church.example/resources/'),
    'https://church.example/resources/heritage-content.json'
  )
  assert.equal(
    normalizeContentServerManifestUrl('church.example/resources/'),
    'https://church.example/resources/heritage-content.json'
  )
  assert.equal(
    normalizeContentServerManifestUrl('localhost:3000'),
    'https://localhost:3000/heritage-content.json'
  )
})

test('manifest and catalogs resolve relative static URLs', () => {
  const manifestUrl = 'https://church.example/heritage-content.json'
  const manifest = validateContentServerManifest({
    schemaVersion: 2,
    kind: 'heritage-content-server',
    id: 'example-church',
    name: 'Example Church',
    catalogs: { readingPlans: 'catalogs/plans.json' },
  }, manifestUrl)
  assert.equal(manifest.catalogs.readingPlans, 'https://church.example/catalogs/plans.json')

  const catalog = validateContentCatalog({
    schemaVersion: 2,
    contentType: 'readingPlans',
    items: [{
      id: 'summer-plan',
      title: 'Summer Plan',
      content: { url: '../plans/summer.json', mediaType: 'application/json' },
    }],
  }, 'readingPlans', manifest.catalogs.readingPlans)
  assert.equal(catalog.items[0].content.url, 'https://church.example/plans/summer.json')
})

test('unsupported or duplicate catalog records are rejected', () => {
  assert.throws(() => validateContentCatalog({
    schemaVersion: 2,
    contentType: 'songs',
    items: [
      { id: 'same', title: 'One', content: { url: 'one.md' } },
      { id: 'same', title: 'Two', content: { url: 'two.md' } },
    ],
  }, 'songs', 'https://church.example/catalogs/songs.json'), /repeats item id/)
})

test('an exact public sermon marker supports a publication-only content server', () => {
  const manifest = validateContentServerManifest({
    schemaVersion: 2,
    kind: 'heritage-content-server',
    id: 'example-church',
    name: 'Example Church',
    publications: {
      sermons: {
        schemaVersion: 1,
        kind: 'heritage-public-sermon-publication',
        catalog: {
          url: '/publications/sermons/catalog.json',
          mediaType: 'application/json',
        },
        detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
        passageIndex: {
          url: '/indexes/sermon-passages',
          mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
        },
      },
    },
  }, 'https://church.example/heritage-content.json')

  assert.deepEqual(manifest.catalogs, {})
  assert.deepEqual(manifest.publications.sermons, {
    schemaVersion: 1,
    kind: 'heritage-public-sermon-publication',
    catalog: {
      url: 'https://church.example/publications/sermons/catalog.json',
      mediaType: 'application/json',
    },
    detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
    passageIndex: {
      url: 'https://church.example/indexes/sermon-passages',
      mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
    },
  })
})

test('the legacy exact sermon marker remains supported without inventing an index', () => {
  const manifest = validateContentServerManifest({
    schemaVersion: 2,
    kind: 'heritage-content-server',
    id: 'legacy-church',
    name: 'Legacy Church',
    publications: {
      sermons: {
        schemaVersion: 1,
        kind: 'heritage-public-sermon-publication',
        catalog: {
          url: '/publications/sermons/catalog.json',
          mediaType: 'application/json',
        },
        detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      },
    },
  }, 'https://legacy.example/heritage-content.json')

  assert.equal(
    manifest.publications.sermons.catalog.url,
    'https://legacy.example/publications/sermons/catalog.json',
  )
  assert.equal('passageIndex' in manifest.publications.sermons, false)
})

test('malformed, cross-origin, and legacy sermon declarations never become discovery markers', () => {
  const base = {
    schemaVersion: 2,
    kind: 'heritage-content-server',
    id: 'example-church',
    name: 'Example Church',
    catalogs: {
      sermons: '/legacy/sermons.json',
    },
  }
  const legacyOnly = validateContentServerManifest(
    base,
    'https://church.example/heritage-content.json',
  )
  assert.equal(legacyOnly.catalogs.sermons, 'https://church.example/legacy/sermons.json')
  assert.deepEqual(legacyOnly.publications, {})

  for (const sermons of [
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: 'https://other.example/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
    },
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      permissiveFallback: true,
    },
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      passageIndex: {
        url: 'https://other.example/indexes/sermon-passages',
        mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
      },
    },
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      passageIndex: {
        url: '/indexes/sermon-passages',
        mediaType: 'application/vnd.heritage.sermon+json',
      },
    },
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      passageIndex: {
        url: 'http://church.example/indexes/sermon-passages',
        mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
      },
    },
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      passageIndex: {
        url: 'https://user:secret@church.example/indexes/sermon-passages',
        mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
      },
    },
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      passageIndex: {
        url: '/indexes/sermon-passages#fragment',
        mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
      },
    },
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      passageIndex: {
        url: '/indexes\\sermon-passages',
        mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
      },
    },
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      passageIndex: {
        url: '/indexes/sermon-passages',
        mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
        permissiveFallback: true,
      },
    },
    {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/vnd.heritage.sermon+json',
      },
      detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
    },
  ]) {
    const manifest = validateContentServerManifest(
      { ...base, publications: { sermons } },
      'https://church.example/heritage-content.json',
    )
    assert.deepEqual(manifest.publications, {})
  }
})

test('an invalid sermon marker cannot make an otherwise empty manifest installable', () => {
  assert.throws(() => validateContentServerManifest({
    schemaVersion: 2,
    kind: 'heritage-content-server',
    id: 'example-church',
    name: 'Example Church',
    publications: {
      sermons: {
        schemaVersion: 2,
        kind: 'heritage-public-sermon-publication',
        catalog: {
          url: '/publications/sermons/catalog.json',
          mediaType: 'application/json',
        },
        detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
      },
    },
  }, 'https://church.example/heritage-content.json'), /does not publish a supported catalog/)
})
