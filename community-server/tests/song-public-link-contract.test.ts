import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  GET as getCommunityDiscovery,
} from '../src/app/.well-known/heritage-community.json/route.ts'
import {
  buildSongPublicLinkSnapshot,
  normalizeSongPublicLinkCreateRequest,
  parseSongPublicLinkSnapshotSource,
  renderSongPublicLinkHtml,
  songPublicLinkFamilyRevision,
  songPublicLinkReviewRevision,
} from '../src/lib/syncshow/SongPublicLink.ts'

const rootSource = `---
id: grace-root
title: Amazing Grace
language: en
authors: ["John Newton"]
attribution: Public words from the 1779 edition.
privateNote: /Users/operator/rights.txt
---

^1
Amazing grace, how sweet the sound
---
That saved a wretch like me

^chorus
I once was lost, but now am found
`

const translationSource = `---
id: grace-ru
title: О благодать
language: ru
translationOf: grace-root
translators: ["Reviewed Translator"]
source: /Volumes/private/source.pptx
---

^1
О благодать, спасен тобой

^chorus
Был мертв и чудом стал живой
`

function revision(source: string) {
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

const documents = [
  {
    id: 'grace-ru',
    source: translationSource,
    revision: revision(translationSource),
  },
  {
    id: 'grace-root',
    source: rootSource,
    revision: revision(rootSource),
  },
]

const syncShowClientFamilyRevision =
  '31a348ab72148920ed96e74408d63edcb1d45c523f130cc603a670261b11e650'
const reviewFixture = JSON.parse(readFileSync(new URL(
  './fixtures/song-public-link-review-v1.json',
  import.meta.url,
), 'utf8')) as {
  schemaVersion: number
  review: Record<string, unknown>
  reviewRevision: string
}

function review(overrides: Record<string, unknown> = {}) {
  const value = {
    scope: 'public-link',
    basis: 'direct-permission',
    evidence: 'Written permission for anonymous web display.',
    validUntil: null,
    validThrough: null,
    reviewedAt: '2026-07-28T19:00:00.000Z',
    familyRevision: syncShowClientFamilyRevision,
    ...overrides,
  }
  return value
}

test('exact family revision agrees with the SyncShow client vector across runtimes', () => {
  assert.equal(
    songPublicLinkFamilyRevision(documents),
    syncShowClientFamilyRevision,
  )
  assert.deepEqual(
    documents.map(document => document.revision),
    [
      '40fd67b35ec964b433aff7fb9afc14a6bf9aefa487c615e3a7a9b1ba88d00636',
      '961de7227c4a22e1ae61c632539da862d122dc3df72f154cd5e9f2f6d6f61df3',
    ],
  )
})

test('snapshot pins exact lyrics while excluding unknown notes and source paths', () => {
  const built = buildSongPublicLinkSnapshot({
    songSyncId: 'amazing-grace',
    songSyncVersion: 7,
    documents,
  })
  assert.equal(built.snapshot.familyRevision, syncShowClientFamilyRevision)
  assert.deepEqual(
    built.snapshot.documents.map(document => document.id),
    ['grace-root', 'grace-ru'],
  )
  assert.doesNotMatch(built.source, /privateNote|operator\/rights|Volumes\/private/)
  assert.doesNotMatch(built.source, /"source"/)
  assert.match(built.source, /Amazing grace, how sweet the sound/)

  const restored = parseSongPublicLinkSnapshotSource(
    built.source,
    built.checksum,
  )
  assert.deepEqual(restored, built.snapshot)
  assert.throws(
    () => parseSongPublicLinkSnapshotSource(
      built.source.replace('Amazing grace', 'Changed grace'),
      built.checksum,
    ),
    /snapshot is invalid/i,
  )
})

test('public parser preserves canonical Unicode marker identities across runtimes', () => {
  const unicodeMarkerSource = `---
id: unicode-markers
title: Unicode markers
language: en
---

^Verse α
First line

^Verse β
Second line
`
  const built = buildSongPublicLinkSnapshot({
    songSyncId: 'unicode-markers',
    songSyncVersion: 1,
    documents: [{
      id: 'unicode-markers',
      source: unicodeMarkerSource,
      revision: revision(unicodeMarkerSource),
    }],
  })
  assert.deepEqual(
    built.snapshot.documents[0].sections.map(section => section.marker),
    ['Verse α', 'Verse β'],
  )
})

test('review normalization is strict, evidence-bearing, and never treats CCLI as a basis', () => {
  const exactReview = review()
  const normalized = normalizeSongPublicLinkCreateRequest({
    songSyncId: 'amazing-grace',
    familyRevision: syncShowClientFamilyRevision,
    review: exactReview,
    reviewRevision: songPublicLinkReviewRevision(exactReview),
    label: '  Tuesday home group  ',
    expiresAt: null,
  }, {
    now: new Date('2026-07-28T19:00:01.000Z'),
  })
  assert.equal(normalized.label, 'Tuesday home group')
  assert.equal(normalized.review.scope, 'public-link')

  for (const invalid of [
    review({ scope: 'community-members' }),
    review({ basis: 'ccli-songselect' }),
    review({ evidence: '' }),
    { ...review(), reviewerId: 77 },
  ]) {
    assert.throws(
      () => normalizeSongPublicLinkCreateRequest({
        songSyncId: 'amazing-grace',
        familyRevision: syncShowClientFamilyRevision,
        review: invalid,
        reviewRevision: songPublicLinkReviewRevision(
          invalid.basis === 'ccli-songselect'
            ? review()
            : invalid,
        ),
        label: null,
        expiresAt: null,
      }, {
        now: new Date('2026-07-28T19:00:01.000Z'),
      }),
    )
  }
})

test('seven-field review digest matches the fixed SyncShow cross-runtime vector', () => {
  assert.equal(reviewFixture.schemaVersion, 1)
  assert.equal(
    songPublicLinkReviewRevision(reviewFixture.review),
    reviewFixture.reviewRevision,
  )
  const mutations: Record<string, unknown>[] = [
    { basis: 'original-work' },
    { evidence: 'Different exact evidence.' },
    { validUntil: '2026-08-30' },
    { validThrough: '2026-09-01T06:59:59.998Z' },
    { reviewedAt: '2026-07-28T19:00:00.001Z' },
    { familyRevision: 'a'.repeat(64) },
  ]
  for (const mutation of mutations) {
    assert.notEqual(
      songPublicLinkReviewRevision({
        ...reviewFixture.review,
        ...mutation,
      }),
      reviewFixture.reviewRevision,
    )
  }
  assert.throws(
    () => songPublicLinkReviewRevision({
      ...reviewFixture.review,
      scope: 'community-members',
    }),
    /does not cover anonymous access/i,
  )
})

test('finite reviews require a future link expiry within the inclusive local review day', () => {
  // This is the exact UTC instant produced by an operator reviewing in PDT.
  // Heritage must honor the bound without reinterpreting it in its host TZ.
  const validThrough = '2026-09-01T06:59:59.999Z'
  const dated = review({
    validUntil: '2026-08-31',
    validThrough,
  })
  const datedRevision = songPublicLinkReviewRevision(dated)
  assert.throws(
    () => normalizeSongPublicLinkCreateRequest({
      songSyncId: 'amazing-grace',
      familyRevision: syncShowClientFamilyRevision,
      review: dated,
      reviewRevision: datedRevision,
      label: null,
      expiresAt: null,
    }, {
      now: new Date(2026, 6, 28, 12),
    }),
    /cannot outlast/i,
  )
  assert.doesNotThrow(
    () => normalizeSongPublicLinkCreateRequest({
      songSyncId: 'amazing-grace',
      familyRevision: syncShowClientFamilyRevision,
      review: dated,
      reviewRevision: datedRevision,
      label: null,
      expiresAt: '2026-09-01T06:58:59.999Z',
    }, {
      now: new Date('2026-07-28T19:00:01.000Z'),
    }),
  )
  assert.throws(
    () => normalizeSongPublicLinkCreateRequest({
      songSyncId: 'amazing-grace',
      familyRevision: syncShowClientFamilyRevision,
      review: dated,
      reviewRevision: datedRevision,
      label: null,
      expiresAt: '2026-09-01T07:00:00.000Z',
    }, {
      now: new Date('2026-07-28T19:00:01.000Z'),
    }),
    /cannot outlast/i,
  )
  const { validThrough: _boundary, ...legacyDatedReview } = dated
  assert.throws(
    () => normalizeSongPublicLinkCreateRequest({
      songSyncId: 'amazing-grace',
      familyRevision: syncShowClientFamilyRevision,
      review: legacyDatedReview,
      reviewRevision: datedRevision,
      label: null,
      expiresAt: '2026-09-01T06:58:59.999Z',
    }, {
      now: new Date('2026-07-28T19:00:01.000Z'),
    }),
    /unsupported or missing fields/i,
  )
})

test('anonymous HTML is semantic and contains only the public snapshot projection', () => {
  const built = buildSongPublicLinkSnapshot({
    songSyncId: 'amazing-grace',
    songSyncVersion: 7,
    documents,
  })
  const source = renderSongPublicLinkHtml(built.snapshot)
  assert.match(source, /<main>/)
  assert.match(source, /<article lang="en">/)
  assert.match(source, /<article lang="ru">/)
  assert.match(source, /Amazing grace, how sweet the sound/)
  assert.doesNotMatch(source, /Written permission|direct-permission/)
  assert.doesNotMatch(source, /operator\/rights|Volumes\/private|privateNote/)
})

test('Community discovery advertises the explicit same-origin public-link lane', async () => {
  const response = getCommunityDiscovery()
  assert.equal(response.status, 200)
  const manifest = await response.json() as Record<string, any>
  const syncShow = manifest.integrations.syncShow
  assert.equal(syncShow.schemaVersion, 2)
  assert.deepEqual(syncShow.resources.songPublicLinks, {
    schemaVersion: 1,
    endpoint: 'song-public-links',
    publicBaseUrl:
      `${new URL(syncShow.apiBaseUrl).origin}/community/songs/shared/`,
    scopes: [
      'syncshow:song-public-links:read',
      'syncshow:song-public-links:write',
    ],
  })
})
