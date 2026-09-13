import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONTENT_SERVERS_STORAGE_KEY,
  getPublicSermonPublicationSources,
  inspectContentServer,
} from '../src/services/contentServers.js'

const store = new Map()
globalThis.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(String(key), String(value)),
}

function serverRecord({
  enabled = true,
  publications,
  catalogs = { songs: '/catalogs/songs.json' },
} = {}) {
  return {
    manifestUrl: 'https://church.example/heritage-content.json',
    enabled,
    manifest: {
      schemaVersion: 2,
      kind: 'heritage-content-server',
      id: 'example-church',
      name: 'Example Church',
      catalogs,
      ...(publications ? { publications } : {}),
    },
  }
}

const STRICT_PUBLICATION = {
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

test('only enabled exact sermon publication markers become reader sources', () => {
  localStorage.setItem(CONTENT_SERVERS_STORAGE_KEY, JSON.stringify([
    serverRecord(),
    serverRecord({
      publications: {
        sermons: {
          ...STRICT_PUBLICATION.sermons,
          legacyFallback: true,
        },
      },
    }),
  ]))
  assert.deepEqual(getPublicSermonPublicationSources(), [])

  localStorage.setItem(CONTENT_SERVERS_STORAGE_KEY, JSON.stringify([
    serverRecord({
      enabled: false,
      publications: STRICT_PUBLICATION,
    }),
  ]))
  assert.deepEqual(getPublicSermonPublicationSources(), [])

  localStorage.setItem(CONTENT_SERVERS_STORAGE_KEY, JSON.stringify([
    serverRecord({
      publications: STRICT_PUBLICATION,
    }),
  ]))
  assert.deepEqual(getPublicSermonPublicationSources(), [{
    serverId: 'example-church',
    serverName: 'Example Church',
    catalogUrl: 'https://church.example/publications/sermons/catalog.json',
    detailMediaType: 'application/vnd.heritage.sermon+json',
    subscriptionRevision: '',
  }])

  const refreshedRecord = serverRecord({
    publications: STRICT_PUBLICATION,
  })
  refreshedRecord.lastCheckedAt = '2026-07-28T20:15:30.000Z'
  localStorage.setItem(CONTENT_SERVERS_STORAGE_KEY, JSON.stringify([refreshedRecord]))
  assert.equal(
    getPublicSermonPublicationSources()[0].subscriptionRevision,
    '2026-07-28T20:15:30.000Z',
  )
})

test('a marker cannot escape the manifest origin', () => {
  localStorage.setItem(CONTENT_SERVERS_STORAGE_KEY, JSON.stringify([
    serverRecord({
      publications: {
        sermons: {
          ...STRICT_PUBLICATION.sermons,
          catalog: {
            ...STRICT_PUBLICATION.sermons.catalog,
            url: 'https://other.example/publications/sermons/catalog.json',
          },
        },
      },
    }),
  ]))
  assert.deepEqual(getPublicSermonPublicationSources(), [])
})

test('install inspection records the marker without prefetching its sermon catalog', async t => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const calls = []
  globalThis.window = globalThis
  globalThis.fetch = async url => {
    calls.push(url)
    return new Response(JSON.stringify({
      schemaVersion: 2,
      kind: 'heritage-content-server',
      id: 'example-church',
      name: 'Example Church',
      publications: STRICT_PUBLICATION,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  t.after(() => {
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  })

  const preview = await inspectContentServer('https://church.example')
  assert.equal(preview.manifest.publications.sermons.kind, 'heritage-public-sermon-publication')
  assert.equal(
    preview.manifest.publications.sermons.passageIndex.url,
    'https://church.example/indexes/sermon-passages',
  )
  assert.deepEqual(preview.catalogs, {})
  assert.deepEqual(calls, ['https://church.example/heritage-content.json'])
})

test('an existing subscription discovers publications once even when its old catalog was just refreshed', async t => {
  const previous = { fetch: globalThis.fetch, window: globalThis.window, CustomEvent: globalThis.CustomEvent }
  globalThis.window = { setTimeout, clearTimeout, dispatchEvent() {} }
  globalThis.CustomEvent = class CustomEvent {}
  t.after(() => Object.assign(globalThis, previous))
  const legacy = serverRecord()
  legacy.lastCheckedAt = new Date().toISOString()
  localStorage.setItem(CONTENT_SERVERS_STORAGE_KEY, JSON.stringify([legacy]))
  const calls = []
  globalThis.fetch = async url => {
    calls.push(url)
    return Response.json({ ...legacy.manifest, catalogs: {}, publications: STRICT_PUBLICATION })
  }
  const { refreshStaleContentServers } = await import('../src/services/contentServers.js')
  await refreshStaleContentServers()
  assert.equal(getPublicSermonPublicationSources().length, 1)
  await refreshStaleContentServers()
  assert.equal(calls.length, 1)
})
