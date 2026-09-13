import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { PublishedSermonArchive } from '../src/services/publishedSermonArchive.js'
import { SERMON_PUBLIC_MEDIA_TYPE } from '../src/services/sermonCatalog.js'
import { createAnonymousSermonPublicationGateway } from '../src/services/sermonPublicationGateway.js'

const RANGE = Object.freeze({
  schemaVersion: 1,
  bookId: 'Eph',
  start: { chapter: 3, verse: 14 },
  end: { chapter: 3, verse: 21 },
})

function source(serverId, catalogUrl = `https://${serverId}.example/publications/sermons/catalog.json`) {
  return {
    serverId,
    serverName: `${serverId} Church`,
    catalogUrl,
    detailMediaType: SERMON_PUBLIC_MEDIA_TYPE,
  }
}

function catalogItem(id, {
  title = id,
  serviceDate = '2026-07-26',
} = {}) {
  return {
    id,
    sermonId: `sermon:${id}`,
    sermonRevision: 'a'.repeat(64),
    checksum: 'b'.repeat(64),
    title,
    titles: {
      en: title,
      ru: `${title} RU`,
    },
    defaultLanguage: 'en',
    speaker: { name: 'Example Pastor' },
    serviceDate,
    series: { titles: { en: 'Example Series' } },
    references: [{ role: 'primary', range: RANGE }],
    content: {
      url: `/content/sermons/${id}`,
      mediaType: SERMON_PUBLIC_MEDIA_TYPE,
    },
  }
}

function snapshot(items) {
  return {
    catalog: {
      schemaVersion: 2,
      contentType: 'sermons',
      items,
    },
  }
}

test('the archive enumerates and opens only a catalog verified by the anonymous gateway', async () => {
  const fixture = JSON.parse(await readFile(
    new URL('./fixtures/community-sermon-publication-conformance-v1.json', import.meta.url),
    'utf8',
  ))
  const catalogUrl = 'https://church.example/publications/sermons/catalog.json'
  const detailUrl = new URL(
    JSON.parse(fixture.catalogSource).items[0].content.url,
    catalogUrl,
  ).href
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url, options })
    if (url === catalogUrl) {
      return new Response(fixture.catalogSource, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }
    if (url === detailUrl) {
      return new Response(fixture.detailSource, {
        status: 200,
        headers: { 'Content-Type': `${SERMON_PUBLIC_MEDIA_TYPE}; charset=utf-8` },
      })
    }
    return new Response('not found', { status: 404 })
  }
  const archive = new PublishedSermonArchive({
    gatewayFactory: options => createAnonymousSermonPublicationGateway({
      ...options,
      fetchImpl,
    }),
  })

  const result = await archive.load({
    sources: [source('verified', catalogUrl)],
  })
  assert.equal(result.status, 'ready')
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].title, 'The Prayer That Transforms the Church')
  assert.equal(result.entries[0].sourceServerId, 'verified')

  const verified = await archive.getDetail(result.entries[0])
  assert.equal(verified.detail.publicId, result.entries[0].publicId)
  assert.deepEqual(requests.map(request => request.url), [catalogUrl, detailUrl])
  for (const request of requests) {
    assert.equal(request.options.credentials, 'omit')
    assert.equal(request.options.redirect, 'error')
    assert.equal(request.options.referrerPolicy, 'no-referrer')
  }
})

test('no installed strict publication source creates no gateway work', async () => {
  let factoryCalls = 0
  const archive = new PublishedSermonArchive({
    gatewayFactory: () => {
      factoryCalls += 1
      throw new Error('must not construct')
    },
  })

  const empty = await archive.load({ sources: [] })
  const malformed = await archive.load({
    sources: [{
      ...source('legacy'),
      detailMediaType: 'application/json',
    }],
  })

  assert.equal(factoryCalls, 0)
  assert.equal(empty.status, 'ready')
  assert.equal(empty.sourceCount, 0)
  assert.deepEqual(empty.entries, [])
  assert.equal(malformed.status, 'error')
  assert.equal(malformed.errors.length, 1)
})

test('verified catalogs aggregate newest-first and exact details stay source-bound', async () => {
  const gateways = new Map()
  const archive = new PublishedSermonArchive({
    gatewayFactory: ({ catalogUrl }) => {
      const first = catalogUrl.includes('first')
      const item = first
        ? catalogItem('older', { title: 'Older Sermon', serviceDate: '2026-07-20' })
        : catalogItem('newer', { title: 'Newer Sermon', serviceDate: '2026-07-27' })
      const gateway = {
        refreshCalls: 0,
        detailCalls: [],
        async refreshCatalog() {
          this.refreshCalls += 1
        },
        getCatalogSnapshot() {
          return snapshot([item])
        },
        async getSermonDetail(publicId) {
          this.detailCalls.push(publicId)
          return {
            item,
            detail: { publicId, source: catalogUrl },
          }
        },
      }
      gateways.set(catalogUrl, gateway)
      return gateway
    },
  })
  const sources = [source('first'), source('second')]

  const result = await archive.load({ sources })
  assert.equal(result.status, 'ready')
  assert.equal(result.successfulSourceCount, 2)
  assert.deepEqual(result.entries.map(entry => entry.publicId), ['newer', 'older'])
  assert.equal(result.entries[0].sourceServerId, 'second')
  assert.deepEqual(result.entries[0].titles, {
    en: 'Newer Sermon',
    ru: 'Newer Sermon RU',
  })
  assert.deepEqual(result.entries[0].references, [{ role: 'primary', range: RANGE }])

  const verified = await archive.getDetail(result.entries[0])
  assert.equal(verified.detail.source, sources[1].catalogUrl)
  assert.deepEqual(gateways.get(sources[0].catalogUrl).detailCalls, [])
  assert.deepEqual(gateways.get(sources[1].catalogUrl).detailCalls, ['newer'])

  await archive.load({ sources })
  assert.equal(gateways.get(sources[0].catalogUrl).refreshCalls, 1)
  await archive.load({ sources, forceRefresh: true })
  assert.equal(gateways.get(sources[0].catalogUrl).refreshCalls, 2)
})

test('one bad source is isolated and a failed refresh keeps only an already verified generation', async () => {
  let failWarmRefresh = false
  const archive = new PublishedSermonArchive({
    gatewayFactory: ({ catalogUrl }) => {
      if (catalogUrl.includes('offline')) {
        return {
          async refreshCatalog() {
            throw new Error('offline')
          },
          getCatalogSnapshot() {
            throw new Error('must not use an unverified catalog')
          },
        }
      }
      return {
        async refreshCatalog() {
          if (failWarmRefresh) throw new Error('temporarily offline')
        },
        getCatalogSnapshot() {
          return snapshot([catalogItem('warm')])
        },
      }
    },
  })
  const sources = [source('warm'), source('offline')]

  const partial = await archive.load({ sources })
  assert.equal(partial.status, 'ready')
  assert.deepEqual(partial.entries.map(entry => entry.publicId), ['warm'])
  assert.equal(partial.errors.length, 1)
  assert.equal(partial.warnings.length, 0)

  failWarmRefresh = true
  const stale = await archive.load({ sources, forceRefresh: true })
  assert.equal(stale.status, 'ready')
  assert.deepEqual(stale.entries.map(entry => entry.publicId), ['warm'])
  assert.equal(stale.errors.length, 1)
  assert.equal(stale.warnings.length, 1)
  assert.match(stale.warnings[0].message, /previously verified/)
})

test('detail loading rejects an identity that changed after the archive result was rendered', async () => {
  const item = catalogItem('changing')
  const archive = new PublishedSermonArchive({
    gatewayFactory: () => ({
      async refreshCatalog() {},
      getCatalogSnapshot() {
        return snapshot([item])
      },
      async getSermonDetail() {
        return {
          item: {
            ...item,
            sermonRevision: 'c'.repeat(64),
            checksum: 'd'.repeat(64),
          },
          detail: { publicId: item.id },
        }
      },
    }),
  })

  const result = await archive.load({ sources: [source('changing')] })
  await assert.rejects(
    () => archive.getDetail(result.entries[0]),
    /changed.*Refresh the archive/i,
  )
})
