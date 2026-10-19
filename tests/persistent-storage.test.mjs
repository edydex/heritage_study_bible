import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeCommunityRegistry,
  sanitizeContentServerRegistry,
} from '../src/services/persistentStorage.js'

function contentServerRecord(overrides = {}) {
  return {
    manifestUrl: 'https://church.example/heritage-content.json',
    manifest: {
      schemaVersion: 2,
      kind: 'heritage-content-server',
      id: 'example-church',
      name: 'Example Church',
      catalogs: { songs: 'https://church.example/catalogs/songs.json' },
    },
    catalogs: {
      songs: {
        schemaVersion: 2,
        contentType: 'songs',
        items: [{
          id: 'doxology',
          title: 'Doxology',
          content: { url: 'https://church.example/content/doxology.json', mediaType: 'application/vnd.heritage.song+json' },
          unsafeExtra: { script: true },
        }],
      },
    },
    enabled: true,
    untrustedRecordData: 'drop me',
    ...overrides,
  }
}

test('backup restore keeps only validated content-server metadata', () => {
  const records = sanitizeContentServerRegistry(JSON.stringify([contentServerRecord()]))
  assert.equal(records.length, 1)
  assert.equal(records[0].manifest.id, 'example-church')
  assert.equal(records[0].catalogs.songs.items[0].content.url, 'https://church.example/content/doxology.json')
  assert.equal(records[0].catalogs.songs.items[0].unsafeExtra, undefined)
  assert.equal(records[0].untrustedRecordData, undefined)
})

test('backup restore drops content servers with unsafe catalog URLs', () => {
  const record = contentServerRecord()
  record.catalogs.songs.items[0].content.url = 'javascript:alert(1)'
  assert.deepEqual(sanitizeContentServerRegistry([record]), [])
})

test('backup restore preserves only a revalidated public sermon publication marker', () => {
  const record = contentServerRecord()
  record.manifest.publications = {
    sermons: {
      schemaVersion: 1,
      kind: 'heritage-public-sermon-publication',
      catalog: {
        url: '/publications/sermons/catalog.json',
        mediaType: 'application/json',
      },
      detailMediaType: 'application/vnd.heritage.sermon+json',
      passageIndex: {
        url: '/indexes/sermon-passages',
        mediaType: 'application/json',
      },
    },
  }

  const [restored] = sanitizeContentServerRegistry([record])
  assert.equal(
    restored.manifest.publications.sermons.catalog.url,
    'https://church.example/publications/sermons/catalog.json',
  )
  assert.equal(
    restored.manifest.publications.sermons.passageIndex.url,
    'https://church.example/indexes/sermon-passages',
  )

  record.manifest.publications.sermons.passageIndex.url = 'https://other.example/sermons.json'
  const [withoutMarker] = sanitizeContentServerRegistry([record])
  assert.deepEqual(withoutMarker.manifest.publications, {})
})

test('backup restore revalidates community endpoints and linked content', () => {
  const contentPreview = contentServerRecord()
  const community = {
    manifestUrl: 'https://church.example/.well-known/heritage-community.json',
    manifest: {
      schemaVersion: 1,
      kind: 'heritage-community',
      id: 'example-community',
      name: 'Example Community',
      apiBaseUrl: 'https://church.example/api',
      contentServerUrl: 'https://church.example/heritage-content.json',
      auth: {
        method: 'email-magic-link',
        requestUrl: 'https://church.example/api/community/auth/magic-link',
        sessionUrl: 'https://church.example/api/community/auth/session',
      },
      capabilities: { sharedPlanNotes: true, injected: 'not-a-boolean' },
    },
    contentPreview,
    status: 'joined',
    primary: true,
    member: { id: 'member-1', displayName: 'Reader', unexpected: { admin: true } },
  }

  const records = sanitizeCommunityRegistry([community])
  assert.equal(records.length, 1)
  assert.equal(records[0].manifest.auth.sessionUrl, 'https://church.example/api/community/auth/session')
  assert.deepEqual(records[0].manifest.capabilities, { sharedPlanNotes: true })
  assert.deepEqual(records[0].member, { id: 'member-1', displayName: 'Reader' })

  community.manifest.apiBaseUrl = 'file:///tmp/community-api'
  assert.deepEqual(sanitizeCommunityRegistry([community]), [])
})
