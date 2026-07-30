import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  GET as getCommunityDiscovery,
} from '../src/app/.well-known/heritage-community.json/route.ts'
import {
  clearSongMemberSharingReceipt,
  enforceSongMemberSharingMutation,
} from '../src/lib/syncShowSongHooks.ts'
import {
  isSongVisibleToMember,
  normalizeSongMutation,
  serializeSongForSync,
} from '../src/lib/syncShowProtocol.ts'
import { memberSongContentProjection } from '../src/lib/memberSongProjection.ts'
import {
  memberSharingValidThrough,
  normalizeSongMemberSharingRequest,
  songMemberSharingReceiptRevision,
  songMemberSharingRequestRevision,
  songMemberSharingReviewRevision,
  songMemberSharingSummaryFromSong,
} from '../src/lib/syncshow/SongMemberSharing.ts'

const familyRevision = 'a'.repeat(64)
const wireFixture = JSON.parse(readFileSync(new URL(
  './fixtures/song-member-sharing-wire-v1.json',
  import.meta.url,
), 'utf8')) as Record<string, any>

function review(overrides: Record<string, unknown> = {}) {
  return {
    scope: 'community-members',
    basis: 'church-license',
    evidence: 'Verified church license covers signed-in member display.',
    validUntil: '2026-08-31',
    reviewedAt: '2026-07-30T19:00:00.000Z',
    familyRevision,
    ...overrides,
  }
}

function request(overrides: Record<string, unknown> = {}) {
  const exactReview = review()
  return {
    schemaVersion: 1,
    familyRevision,
    review: exactReview,
    reviewRevision: songMemberSharingReviewRevision(exactReview),
    visibility: 'public',
    publishAt: null,
    ...overrides,
  }
}

test('member review is an exact distinct scope with basis-specific evidence', () => {
  assert.doesNotThrow(() => normalizeSongMemberSharingRequest(request()))
  for (const basis of ['public-domain', 'original-work']) {
    const exactReview = review({ basis, evidence: '' })
    assert.doesNotThrow(() => normalizeSongMemberSharingRequest({
      ...request(),
      review: exactReview,
      reviewRevision: songMemberSharingReviewRevision(exactReview),
    }))
  }
  for (const basis of [
    'church-license',
    'specific-web-license',
    'direct-permission',
    'other-reviewed',
  ]) {
    assert.throws(
      () => songMemberSharingReviewRevision(review({ basis, evidence: '' })),
      /evidence is required/i,
    )
  }
  assert.throws(
    () => songMemberSharingReviewRevision(
      review({ scope: 'public-link' }),
    ),
    /signed-in Community members/i,
  )
  assert.throws(
    () => normalizeSongMemberSharingRequest({
      ...request(),
      review: { ...review(), validThrough: '2026-09-01T06:59:59.999Z' },
    }),
    /unsupported or missing fields/i,
  )
})

test('Community derives immutable end-of-day instants across DST', () => {
  assert.equal(
    memberSharingValidThrough('2026-07-30', 'America/Los_Angeles'),
    '2026-07-31T06:59:59.999Z',
  )
  assert.equal(
    memberSharingValidThrough('2026-01-30', 'America/Los_Angeles'),
    '2026-01-31T07:59:59.999Z',
  )
  assert.equal(
    memberSharingValidThrough('2026-03-08', 'America/Los_Angeles'),
    '2026-03-09T06:59:59.999Z',
  )
  assert.equal(
    memberSharingValidThrough('2026-11-01', 'America/Los_Angeles'),
    '2026-11-02T07:59:59.999Z',
  )
  assert.equal(memberSharingValidThrough(null, 'America/Los_Angeles'), null)
})

test('request and receipt revisions are deterministic ordered digests', () => {
  const normalized = normalizeSongMemberSharingRequest(request())
  const expectedRequestRevision = createHash('sha256')
    .update(JSON.stringify([
      1,
      'exact-song',
      7,
      familyRevision,
      normalized.reviewRevision,
      'public',
      null,
    ]))
    .digest('hex')
  assert.equal(songMemberSharingRequestRevision({
    songSyncId: 'exact-song',
    expectedSongSyncVersion: 7,
    request: normalized,
  }), expectedRequestRevision)

  const receipt = {
    schemaVersion: 1 as const,
    receiptId: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh',
    receiptVersion: 3,
    songSyncId: 'exact-song',
    previousSongSyncVersion: 7,
    songSyncVersion: 8,
    familyRevision,
    reviewRevision: normalized.reviewRevision,
    visibility: 'public' as const,
    publishAt: null,
    timeZone: 'America/Los_Angeles',
    validThrough: '2026-09-01T06:59:59.999Z',
    reviewedAt: normalized.review.reviewedAt,
    confirmedAt: '2026-07-30T19:01:00.000Z',
    requestRevision: expectedRequestRevision,
  }
  assert.equal(
    songMemberSharingReceiptRevision(receipt),
    createHash('sha256').update(JSON.stringify([
      1,
      receipt.receiptId,
      3,
      'exact-song',
      7,
      8,
      familyRevision,
      normalized.reviewRevision,
      'public',
      null,
      'America/Los_Angeles',
      '2026-09-01T06:59:59.999Z',
      normalized.review.reviewedAt,
      '2026-07-30T19:01:00.000Z',
      expectedRequestRevision,
    ])).digest('hex'),
  )
})

test('shared JSON wire vector fixes cross-runtime review, request, and receipt bytes', () => {
  const normalized = normalizeSongMemberSharingRequest(wireFixture.request)
  assert.equal(
    songMemberSharingReviewRevision(normalized.review),
    wireFixture.request.reviewRevision,
  )
  assert.equal(
    songMemberSharingRequestRevision({
      songSyncId: wireFixture.songSyncId,
      expectedSongSyncVersion: wireFixture.expectedSongSyncVersion,
      request: normalized,
    }),
    wireFixture.expectedRequestRevision,
  )
  const { receiptRevision: _revision, ...receipt } = wireFixture.receipt
  assert.equal(
    songMemberSharingReceiptRevision(receipt),
    wireFixture.expectedReceiptRevision,
  )
  assert.equal(
    wireFixture.receipt.receiptRevision,
    wireFixture.expectedReceiptRevision,
  )
})

test('member visibility requires an exact current unexpired receipt', () => {
  const normalized = normalizeSongMemberSharingRequest(request())
  const requestRevision = songMemberSharingRequestRevision({
    songSyncId: 'exact-song',
    expectedSongSyncVersion: 7,
    request: normalized,
  })
  const baseReceipt = {
    schemaVersion: 1 as const,
    receiptId: 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJi',
    receiptVersion: 1,
    songSyncId: 'exact-song',
    previousSongSyncVersion: 7,
    songSyncVersion: 8,
    familyRevision,
    reviewRevision: normalized.reviewRevision,
    visibility: 'public' as const,
    publishAt: null,
    timeZone: 'America/Los_Angeles',
    validThrough: '2026-09-01T06:59:59.999Z',
    reviewedAt: normalized.review.reviewedAt,
    confirmedAt: '2026-07-30T19:01:00.000Z',
    requestRevision,
  }
  const receiptRevision = songMemberSharingReceiptRevision(baseReceipt)
  const song = {
    id: 1,
    status: 'published',
    visibility: 'public',
    publishAt: null,
    syncId: 'exact-song',
    syncVersion: 8,
    memberShareReceiptId: baseReceipt.receiptId,
    memberShareReceiptVersion: 1,
    memberSharePreviousSongSyncVersion: 7,
    memberShareSongSyncVersion: 8,
    memberShareFamilyRevision: familyRevision,
    memberShareReviewRevision: normalized.reviewRevision,
    memberShareVisibility: 'public',
    memberSharePublishAt: null,
    memberShareTimeZone: 'America/Los_Angeles',
    memberShareValidThrough: baseReceipt.validThrough,
    memberShareReviewedAt: baseReceipt.reviewedAt,
    memberShareConfirmedAt: baseReceipt.confirmedAt,
    memberShareRequestRevision: requestRevision,
    memberShareReceiptRevision: receiptRevision,
  }
  assert.deepEqual(songMemberSharingSummaryFromSong(song), {
    ...baseReceipt,
    receiptRevision,
  })
  assert.equal(
    isSongVisibleToMember(song, new Date('2026-08-01T00:00:00.000Z')),
    true,
  )
  assert.equal(
    isSongVisibleToMember(song, new Date('2026-09-01T07:00:00.000Z')),
    false,
  )
  assert.equal(
    isSongVisibleToMember({ ...song, syncVersion: 9 }),
    false,
  )
  assert.equal(
    serializeSongForSync(song).effectiveVisibility,
    'public',
  )
  assert.deepEqual(serializeSongForSync(song).memberSharing, {
    ...baseReceipt,
    receiptRevision,
  })
})

test('ordinary song writes refuse member visibility and clear stale receipts', async () => {
  assert.throws(
    () => normalizeSongMutation({
      syncId: 'exact-song',
      title: 'Exact Song',
      visibility: 'public',
    }, { create: true }),
    (error: unknown) => (
      error instanceof Error
      && 'code' in error
      && error.code === 'MEMBER_SHARE_REVIEW_REQUIRED'
    ),
  )
  const existing = {
    visibility: 'public',
    memberShareReceiptId: 'old',
  }
  const demoted = await enforceSongMemberSharingMutation({
    data: { title: 'Edited' },
    operation: 'update',
    originalDoc: existing,
    context: {},
  } as never) as Record<string, unknown>
  assert.equal(demoted.visibility, 'private')
  assert.equal(demoted.memberShareReceiptId, null)
  assert.throws(
    () => enforceSongMemberSharingMutation({
      data: { visibility: 'scheduled-public' },
      operation: 'update',
      originalDoc: { visibility: 'private' },
      context: {},
    } as never),
    /exact song-family rights review/i,
  )
  assert.equal(
    clearSongMemberSharingReceipt({ memberShareReceiptId: 'old' })
      .memberShareReceiptId,
    null,
  )
})

test('signed-in song projection excludes review, audit, source, and rights secrets', () => {
  const projected = memberSongContentProjection({
    id: 4,
    syncId: 'exact-song',
    title: 'Exact Song',
    lyrics: 'Member lyrics',
    rightsNotes: '/Users/operator/private-review.txt',
    permissionUrl: 'https://private.example.test/evidence',
    sourceUrl: 'file:///Volumes/private/source.pptx',
    syncDocuments: [{ source: 'private bytes' }],
    recordings: [{
      id: 9,
      url: '/media/member-recording.mp3',
      filename: 'member-recording.mp3',
      mimeType: 'audio/mpeg',
      filesize: 1234,
      alt: 'Congregational recording',
      credit: 'Church musicians',
      community: 7,
      updatedAt: 'private bookkeeping',
    }],
    memberShareReceiptId: 'secret-receipt',
    memberShareReviewRevision: 'c'.repeat(64),
    auditSource: 'secret audit',
  })
  assert.equal(projected.lyrics, 'Member lyrics')
  assert.deepEqual(projected.recordings, [{
    id: '9',
    url: '/media/member-recording.mp3',
    filename: 'member-recording.mp3',
    mimeType: 'audio/mpeg',
    filesize: 1234,
    width: null,
    height: null,
    alt: 'Congregational recording',
    credit: 'Church musicians',
  }])
  const source = JSON.stringify(projected)
  assert.doesNotMatch(
    source,
    /rightsNotes|permissionUrl|sourceUrl|syncDocuments|memberShare|audit|operator|Volumes|bookkeeping/,
  )
})

test('discovery advertises one nested same-origin member-sharing transaction', async () => {
  const response = getCommunityDiscovery()
  const manifest = await response.json() as Record<string, any>
  assert.deepEqual(
    manifest.integrations.syncShow.resources.songs.memberSharing,
    {
      schemaVersion: 1,
      endpoint: 'song-member-sharing',
      reviewScope: 'community-members',
    },
  )
})
