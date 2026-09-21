import assert from 'node:assert/strict'
import test from 'node:test'

import { PassageSermonReader } from '../src/services/passageSermonReader.js'
import { SERMON_PUBLIC_MEDIA_TYPE } from '../src/services/sermonCatalog.js'

const RANGE = Object.freeze({
  schemaVersion: 1,
  bookId: 'Eph',
  start: { chapter: 3, verse: 18 },
  end: { chapter: 3, verse: 18 },
})

function source(serverId, catalogUrl = `https://${serverId}.example/publications/sermons/catalog.json`) {
  return {
    serverId,
    serverName: `${serverId} Church`,
    catalogUrl,
    detailMediaType: SERMON_PUBLIC_MEDIA_TYPE,
  }
}

function match(publicId, {
  title = publicId,
  serviceDate = '2026-07-26',
} = {}) {
  return {
    publicId,
    sermonId: `sermon:${publicId}`,
    sermonRevision: 'a'.repeat(64),
    checksum: 'b'.repeat(64),
    title,
    speaker: { name: 'Example Pastor' },
    serviceDate,
    contentUrl: `/content/sermons/${publicId}`,
    matches: [RANGE],
  }
}

test('no positive publication source creates no gateway or request work', async () => {
  let factoryCalls = 0
  const reader = new PassageSermonReader({
    gatewayFactory: () => {
      factoryCalls += 1
      throw new Error('must not construct')
    },
  })

  const withoutSources = await reader.query({ sources: [], range: RANGE })
  const withoutRange = await reader.query({ sources: [source('one')], range: null })
  const malformedMarker = await reader.query({
    sources: [{
      ...source('legacy'),
      detailMediaType: 'application/json',
    }],
    range: RANGE,
  })

  assert.equal(factoryCalls, 0)
  assert.equal(withoutSources.status, 'ready')
  assert.deepEqual(withoutSources.primary, [])
  assert.equal(withoutRange.status, 'ready')
  assert.equal(malformedMarker.status, 'error')
})

test('verified source queries are aggregated and exact detail loading stays source-bound', async () => {
  const gateways = new Map()
  const reader = new PassageSermonReader({
    gatewayFactory: ({ catalogUrl }) => {
      const gateway = {
        refreshCalls: 0,
        detailCalls: [],
        async refreshCatalog() {
          this.refreshCalls += 1
        },
        async querySermonsForRange(range) {
          assert.deepEqual(range, RANGE)
          if (catalogUrl.includes('first')) {
            return {
              primary: [match('primary-sermon')],
              mentioned: [],
            }
          }
          return {
            primary: [],
            mentioned: [match('mentioned-sermon', { serviceDate: '2026-07-19' })],
          }
        },
        async getSermonDetail(publicId) {
          this.detailCalls.push(publicId)
          const identity = match(publicId)
          return {
            item: {
              id: identity.publicId,
              sermonId: identity.sermonId,
              sermonRevision: identity.sermonRevision,
              checksum: identity.checksum,
            },
            detail: { publicId, source: catalogUrl },
          }
        },
      }
      gateways.set(catalogUrl, gateway)
      return gateway
    },
  })
  const sources = [source('first'), source('second')]

  const result = await reader.query({ sources, range: RANGE })
  assert.equal(result.status, 'ready')
  assert.equal(result.primary[0].sourceServerId, 'first')
  assert.equal(result.mentioned[0].sourceServerId, 'second')

  const verified = await reader.getDetail(result.mentioned[0])
  assert.equal(verified.detail.publicId, 'mentioned-sermon')
  assert.match(verified.detail.source, /second/)
  assert.deepEqual(gateways.get(sources[0].catalogUrl).detailCalls, [])
  assert.deepEqual(gateways.get(sources[1].catalogUrl).detailCalls, ['mentioned-sermon'])

  await reader.query({ sources, range: RANGE })
  assert.equal(gateways.get(sources[0].catalogUrl).refreshCalls, 1)
  assert.equal(gateways.get(sources[1].catalogUrl).refreshCalls, 1)
  await reader.query({ sources, range: RANGE, forceRefresh: true })
  assert.equal(gateways.get(sources[0].catalogUrl).refreshCalls, 2)
  assert.equal(gateways.get(sources[1].catalogUrl).refreshCalls, 2)
})

test('detail retry cannot substitute a changed catalog identity for the clicked result', async () => {
  let queryMatch = match('changing-sermon')
  const reader = new PassageSermonReader({
    gatewayFactory: () => ({
      async refreshCatalog() {},
      async querySermonsForRange() {
        return { primary: [queryMatch], mentioned: [] }
      },
      async getSermonDetail(publicId) {
        return {
          item: {
            id: publicId,
            sermonId: queryMatch.sermonId,
            sermonRevision: 'c'.repeat(64),
            checksum: 'd'.repeat(64),
          },
          detail: { publicId },
        }
      },
    }),
  })

  const result = await reader.query({
    sources: [source('changing')],
    range: RANGE,
  })
  await assert.rejects(
    () => reader.getDetail(result.primary[0]),
    /changed.*Refresh the passage/i,
  )

  queryMatch = {
    ...queryMatch,
    sermonRevision: 'c'.repeat(64),
    checksum: 'd'.repeat(64),
  }
  const refreshed = await reader.query({
    sources: [source('changing')],
    range: RANGE,
    forceRefresh: true,
  })
  const verified = await reader.getDetail(refreshed.primary[0])
  assert.equal(verified.detail.publicId, 'changing-sermon')
})

test('one unavailable publication leaves verified sources usable with a warning', async () => {
  const reader = new PassageSermonReader({
    gatewayFactory: ({ catalogUrl }) => ({
      async refreshCatalog() {
        if (catalogUrl.includes('offline')) throw new Error('offline')
      },
      async querySermonsForRange() {
        return {
          primary: [match('available-sermon')],
          mentioned: [],
        }
      },
      async getSermonDetail() {
        throw new Error('not used')
      },
    }),
  })

  const partial = await reader.query({
    sources: [source('available'), source('offline')],
    range: RANGE,
  })
  assert.equal(partial.status, 'ready')
  assert.equal(partial.primary.length, 1)
  assert.equal(partial.errors.length, 1)
  assert.equal(partial.errors[0].serverId, 'offline')

  const failed = await reader.query({
    sources: [source('offline-two')],
    range: RANGE,
  })
  assert.equal(failed.status, 'error')
  assert.deepEqual(failed.primary, [])
})

test('rapid passage changes reuse a warm generation and failed refresh retries fall back visibly', async () => {
  let refreshCalls = 0
  let failRefresh = false
  const queriedRanges = []
  const gateway = {
    async refreshCatalog() {
      refreshCalls += 1
      if (failRefresh) throw new Error('temporarily offline')
    },
    async querySermonsForRange(range) {
      queriedRanges.push(range)
      return {
        primary: [match('warm-sermon')],
        mentioned: [],
      }
    },
    async getSermonDetail() {
      throw new Error('not used')
    },
  }
  const reader = new PassageSermonReader({
    gatewayFactory: () => gateway,
  })
  const publicationSources = [source('warm')]
  const nextRange = {
    ...RANGE,
    start: { chapter: 3, verse: 19 },
    end: { chapter: 3, verse: 19 },
  }

  const first = await reader.query({ sources: publicationSources, range: RANGE })
  const rapidNext = await reader.query({ sources: publicationSources, range: nextRange })
  assert.equal(first.status, 'ready')
  assert.equal(rapidNext.status, 'ready')
  assert.equal(refreshCalls, 1)
  assert.equal(queriedRanges.length, 2)

  failRefresh = true
  const retry = await reader.query({
    sources: publicationSources,
    range: nextRange,
    forceRefresh: true,
  })
  assert.equal(retry.status, 'ready')
  assert.equal(retry.primary.length, 1)
  assert.equal(retry.errors.length, 0)
  assert.equal(retry.warnings.length, 1)
  assert.match(retry.warnings[0].message, /previously verified/)
  assert.equal(refreshCalls, 2)

  const afterFailedRetry = await reader.query({
    sources: publicationSources,
    range: RANGE,
  })
  assert.equal(refreshCalls, 2)
  assert.equal(afterFailedRetry.warnings.length, 1)

  failRefresh = false
  const recovered = await reader.query({
    sources: publicationSources,
    range: RANGE,
    forceRefresh: true,
  })
  assert.equal(refreshCalls, 3)
  assert.deepEqual(recovered.warnings, [])
})
