import test from 'node:test'
import assert from 'node:assert/strict'
import {
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
