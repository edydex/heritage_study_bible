import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSermonPublishIntent,
  buildSermonWithdrawIntent,
  createEmptyPublicationReviewDraft,
  isPublicMediaSelectable,
  isSermonPublicationConflict,
  parseSermonPublicationDetail,
  parseSermonPublicationList,
  parseSermonPublicationMutationResponse,
  parseSermonPublicationReviewTarget,
  resolveSermonPublicationReviewTarget,
  reviewableSermonPublications,
  type PublicationReviewDraft,
} from '../src/components/sermonPublicationReviewModel.ts'

const CURRENT_REVISION = 'a'.repeat(64)
const PUBLIC_REVISION = 'b'.repeat(64)
const DETAIL_CHECKSUM = 'c'.repeat(64)

function pointer(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    active: true,
    publicationVersion: 4,
    publicRevision: PUBLIC_REVISION,
    publicId: 'sermon-public-id',
    detailChecksum: DETAIL_CHECKSUM,
    publishedAt: '2026-07-27T18:00:00.000Z',
    withdrawnAt: null,
    selectedBodyEntryIds: ['old-public-body'],
    selectedMediaIds: ['old-public-media'],
    ...overrides,
  }
}

function canonicalDocument() {
  return {
    schemaVersion: 3,
    kind: 'syncshow-sermon',
    id: 'sermon-review-1',
    titles: {
      en: 'The Faithful Shepherd',
      ru: 'Верный Пастырь',
    },
    defaultLanguage: 'en',
    speaker: { id: 'speaker-1', name: 'Pastor Example' },
    serviceDate: '2026-07-27',
    series: {
      id: 'series-1',
      titles: { en: 'John', ru: 'Иоанн' },
    },
    outline: [],
    references: [],
    sources: [{
      id: 'manuscript',
      kind: 'manuscript',
      fileName: 'sermon.docx',
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      languages: ['en'],
      sha256: 'd'.repeat(64),
      sizeBytes: 2048,
      provenance: {
        providedBy: 'Pastor Example',
        receivedAt: '2026-07-26T18:00:00.000Z',
        sourceSystem: 'manual-file-picker',
        externalId: '',
      },
    }],
    body: [{
      id: 'body-first',
      kind: 'manuscript',
      language: 'en',
      sourceId: 'manuscript',
      sectionId: null,
      text: 'First exact paragraph.\n\nWith preserved spacing.',
    }, {
      id: 'body-second',
      kind: 'slide-notes',
      language: 'en',
      sourceId: 'manuscript',
      sectionId: null,
      text: 'Second exact paragraph.',
    }],
    media: [{
      id: 'audio-ready',
      kind: 'audio',
      status: 'ready',
      title: 'Sermon audio',
      language: 'en',
      mediaType: 'audio/mpeg',
      fileName: 'sermon.mp3',
      sha256: 'e'.repeat(64),
      sizeBytes: 4096,
      durationSeconds: 1800,
      url: 'https://media.example.church/sermon.mp3',
    }, {
      id: 'video-pending',
      kind: 'video',
      status: 'pending',
      title: 'Sermon video',
      language: 'en',
      mediaType: 'video/mp4',
      fileName: null,
      sha256: null,
      sizeBytes: null,
      durationSeconds: null,
      url: null,
    }],
    publication: {
      status: 'ready',
      visibility: 'private',
      publishedAt: null,
      canonicalUrl: null,
    },
  }
}

function detailResponse(
  publication: unknown = pointer(),
  document: ReturnType<typeof canonicalDocument> = canonicalDocument(),
) {
  return {
    schemaVersion: 1,
    sermon: {
      syncId: 'sermon-review-1',
      syncVersion: 9,
      currentRevision: CURRENT_REVISION,
      updatedAt: '2026-07-27T19:00:00.000Z',
      archived: false,
      documentSource: JSON.stringify(document),
    },
    publication,
  }
}

type DraftOverrides = Omit<Partial<PublicationReviewDraft>, 'directAudio'> & {
  directAudio?: Partial<PublicationReviewDraft['directAudio']>
}

function reviewedDraft(overrides: DraftOverrides = {}): PublicationReviewDraft {
  const base = createEmptyPublicationReviewDraft('en')
  return {
    ...base,
    selectedBodyEntryIds: [],
    selectedMediaIds: [],
    bodySelectionConfirmed: true,
    mediaSelectionConfirmed: true,
    publicAudienceConfirmed: true,
    canonicalLinkConfirmed: true,
    ...overrides,
    directAudio: {
      ...base.directAudio,
      ...overrides.directAudio,
    },
  }
}

test('review list includes only Ready sermons and active publications', () => {
  const common = {
    syncVersion: 2,
    currentRevision: CURRENT_REVISION,
    updatedAt: '2026-07-27T19:00:00.000Z',
    archived: false,
    title: 'Sermon',
    speaker: 'Pastor',
    serviceDate: '2026-07-27',
    visibility: 'private',
  }
  const items = parseSermonPublicationList({
    schemaVersion: 1,
    items: [{
      ...common,
      syncId: 'ready',
      publicationStatus: 'ready',
      publication: null,
    }, {
      ...common,
      syncId: 'active',
      publicationStatus: 'published',
      publication: pointer(),
    }, {
      ...common,
      syncId: 'private-draft',
      publicationStatus: 'draft',
      publication: null,
    }, {
      ...common,
      syncId: 'withdrawn',
      publicationStatus: 'published',
      publication: pointer({
        active: false,
        withdrawnAt: '2026-07-27T20:00:00.000Z',
      }),
    }],
  })

  assert.deepEqual(
    reviewableSermonPublications(items).map(item => item.syncId),
    ['ready', 'active'],
  )
})

test('review deep links accept only one exact SyncShow sermon ID', () => {
  assert.deepEqual(parseSermonPublicationReviewTarget(undefined), {
    kind: 'generic',
  })
  assert.deepEqual(parseSermonPublicationReviewTarget({}), {
    kind: 'generic',
  })
  assert.deepEqual(parseSermonPublicationReviewTarget({ sermon: '' }), {
    kind: 'invalid',
    reason: 'missing',
  })
  assert.deepEqual(parseSermonPublicationReviewTarget({
    sermon: ['sermon-one', 'sermon-two'],
  }), {
    kind: 'invalid',
    reason: 'ambiguous',
  })
  for (const sermon of [
    ' sermon-one',
    '_sermon-one',
    'sermon/one',
    `s${'e'.repeat(128)}`,
  ]) {
    assert.deepEqual(parseSermonPublicationReviewTarget({ sermon }), {
      kind: 'invalid',
      reason: 'format',
    }, sermon)
  }
  assert.deepEqual(parseSermonPublicationReviewTarget({
    sermon: 'Sermon:2026-07-27.v1',
  }), {
    kind: 'exact',
    syncId: 'Sermon:2026-07-27.v1',
  })
})

test('review deep links resolve only an exact reviewable returned ID', () => {
  const common = {
    syncVersion: 2,
    currentRevision: CURRENT_REVISION,
    updatedAt: '2026-07-27T19:00:00.000Z',
    archived: false,
    speaker: 'Pastor',
    serviceDate: '2026-07-27',
    visibility: 'private',
    publication: null,
  }
  const reviewable = reviewableSermonPublications(parseSermonPublicationList({
    schemaVersion: 1,
    items: [{
      ...common,
      syncId: 'sermon-exact',
      title: 'Exact sermon',
      publicationStatus: 'ready',
    }, {
      ...common,
      syncId: 'different-id',
      title: 'sermon-only-in-title',
      publicationStatus: 'ready',
    }, {
      ...common,
      syncId: 'sermon-draft',
      title: 'Draft sermon',
      publicationStatus: 'draft',
    }],
  }))

  assert.deepEqual(resolveSermonPublicationReviewTarget({
    kind: 'exact',
    syncId: 'sermon-exact',
  }, reviewable), {
    kind: 'select',
    syncId: 'sermon-exact',
  })
  for (const syncId of [
    'sermon-only-in-title',
    'sermon-draft',
    'sermon-stale',
  ]) {
    assert.deepEqual(resolveSermonPublicationReviewTarget({
      kind: 'exact',
      syncId,
    }, reviewable), {
      kind: 'unavailable',
      syncId,
    }, syncId)
  }
})

test('detail opens exact current body and media while every proposal starts empty', () => {
  const detail = parseSermonPublicationDetail(detailResponse())
  const draft = createEmptyPublicationReviewDraft()

  assert.equal(detail.sermon.document.title, 'The Faithful Shepherd')
  assert.equal(
    detail.sermon.document.body[0].text,
    'First exact paragraph.\n\nWith preserved spacing.',
  )
  assert.equal(detail.sermon.document.media[0].url, 'https://media.example.church/sermon.mp3')
  assert.deepEqual(detail.publication?.selectedBodyEntryIds, ['old-public-body'])
  assert.deepEqual(draft.selectedBodyEntryIds, [])
  assert.deepEqual(draft.selectedMediaIds, [])
  assert.equal(draft.bodySelectionConfirmed, false)
  assert.equal(draft.mediaSelectionConfirmed, false)
  assert.equal(draft.publicAudienceConfirmed, false)
  assert.equal(draft.canonicalLinkConfirmed, false)
  assert.deepEqual(draft.directAudio, {
    url: '',
    title: 'Sermon audio',
    language: 'en',
    mediaType: 'audio/mpeg',
    durationSeconds: '',
  })
  assert.equal(draft.recordingRightsAndPrivacyConfirmed, false)
})

test('publish intent uses exact current CAS and only explicit, canonically ordered choices', () => {
  const detail = parseSermonPublicationDetail(detailResponse())
  const intent = buildSermonPublishIntent(detail, reviewedDraft({
    selectedBodyEntryIds: ['body-second', 'body-first'],
    selectedMediaIds: ['audio-ready'],
  }))

  assert.deepEqual(intent, {
    schemaVersion: 1,
    action: 'publish',
    syncId: 'sermon-review-1',
    expectedSyncVersion: 9,
    expectedCurrentRevision: CURRENT_REVISION,
    expectedPublicationVersion: 4,
    expectedPublicRevision: PUBLIC_REVISION,
    selectedBodyEntryIds: ['body-first', 'body-second'],
    selectedMediaIds: ['audio-ready'],
    publicAudienceConfirmed: true,
    canonicalLinkConfirmed: true,
  })
  assert.deepEqual(Object.keys(intent).sort(), [
    'action',
    'canonicalLinkConfirmed',
    'expectedCurrentRevision',
    'expectedPublicRevision',
    'expectedPublicationVersion',
    'expectedSyncVersion',
    'publicAudienceConfirmed',
    'schemaVersion',
    'selectedBodyEntryIds',
    'selectedMediaIds',
    'syncId',
  ])
})

test('an explicit reviewed empty selection is valid and an untouched empty default is not', () => {
  const detail = parseSermonPublicationDetail(detailResponse(null))
  assert.throws(
    () => buildSermonPublishIntent(detail, {
      ...createEmptyPublicationReviewDraft(),
      publicAudienceConfirmed: true,
      canonicalLinkConfirmed: true,
    }),
    /Review both the written-content and media choices/,
  )

  const intent = buildSermonPublishIntent(detail, reviewedDraft())
  assert.deepEqual(intent.selectedBodyEntryIds, [])
  assert.deepEqual(intent.selectedMediaIds, [])
  assert.equal(intent.expectedPublicationVersion, null)
  assert.equal(intent.expectedPublicRevision, null)
})

test('only ready media at a public HTTPS URL can enter a publish intent', () => {
  const detail = parseSermonPublicationDetail(detailResponse())
  assert.equal(isPublicMediaSelectable(detail.sermon.document.media[0]), true)
  assert.equal(isPublicMediaSelectable(detail.sermon.document.media[1]), false)
  assert.throws(
    () => buildSermonPublishIntent(detail, reviewedDraft({
      selectedMediaIds: ['video-pending'],
    })),
    /not ready at a public HTTPS URL/,
  )
})

test('HTTP and unstable canonical media remain reviewable but cannot be selected', () => {
  const document = canonicalDocument() as any
  const readyAudio = document.media[0]
  document.media.push(
    {
      ...readyAudio,
      id: 'audio-http',
      url: 'http://media.example.church/sermon-http.mp3',
    },
    {
      ...readyAudio,
      id: 'audio-query',
      url: 'https://media.example.church/sermon-query.mp3?token=temporary',
    },
    {
      ...readyAudio,
      id: 'audio-fragment',
      url: 'https://media.example.church/sermon-fragment.mp3#player',
    },
    {
      ...readyAudio,
      id: 'audio-single-host',
      url: 'https://sermons/sermon-single.mp3',
    },
    {
      ...readyAudio,
      id: 'audio-port',
      url: 'https://media.example.church:8443/sermon-port.mp3',
    },
    {
      ...readyAudio,
      id: 'audio-private',
      url: 'https://10.0.0.7/sermon-private.mp3',
    },
    {
      ...readyAudio,
      id: 'audio-reserved',
      url: 'https://media.church.example/sermon-reserved.mp3',
    },
  )
  const detail = parseSermonPublicationDetail(detailResponse(pointer(), document))

  assert.equal(
    detail.sermon.document.media.find(media => media.id === 'audio-http')?.url,
    'http://media.example.church/sermon-http.mp3',
  )
  assert.equal(isPublicMediaSelectable(detail.sermon.document.media[0]), true)
  for (const id of [
    'audio-http',
    'audio-query',
    'audio-fragment',
    'audio-single-host',
    'audio-port',
    'audio-private',
    'audio-reserved',
  ]) {
    const media = detail.sermon.document.media.find(item => item.id === id)
    assert.ok(media, id)
    assert.equal(isPublicMediaSelectable(media), false, id)
    assert.throws(
      () => buildSermonPublishIntent(detail, reviewedDraft({
        selectedBodyEntryIds: ['body-first'],
        selectedMediaIds: [id],
      })),
      /not ready at a public HTTPS URL/,
      id,
    )
  }
})

test('selected canonical audio requires a written sermon alternative', () => {
  const detail = parseSermonPublicationDetail(detailResponse())
  assert.throws(
    () => buildSermonPublishIntent(detail, reviewedDraft({
      selectedMediaIds: ['audio-ready'],
    })),
    /at least one written sermon section/,
  )
  assert.deepEqual(
    buildSermonPublishIntent(detail, reviewedDraft({
      selectedBodyEntryIds: ['body-first'],
      selectedMediaIds: ['audio-ready'],
    })).selectedBodyEntryIds,
    ['body-first'],
  )
})

test('a reviewed direct recording produces an exact v2 intent without preselecting old media', () => {
  const detail = parseSermonPublicationDetail(detailResponse())
  const intent = buildSermonPublishIntent(detail, reviewedDraft({
    selectedBodyEntryIds: ['body-first'],
    directAudio: {
      url: 'https://media.example.church/sermons/faithful-shepherd.mp3',
      title: 'Sunday sermon recording',
      language: 'ru',
      mediaType: 'audio/mpeg',
      durationSeconds: '2484.5',
    },
    recordingRightsAndPrivacyConfirmed: true,
  }))

  assert.deepEqual(intent, {
    schemaVersion: 2,
    action: 'publish',
    syncId: 'sermon-review-1',
    expectedSyncVersion: 9,
    expectedCurrentRevision: CURRENT_REVISION,
    expectedPublicationVersion: 4,
    expectedPublicRevision: PUBLIC_REVISION,
    selectedBodyEntryIds: ['body-first'],
    selectedMediaIds: [],
    publicAudienceConfirmed: true,
    canonicalLinkConfirmed: true,
    directAudio: {
      url: 'https://media.example.church/sermons/faithful-shepherd.mp3',
      title: 'Sunday sermon recording',
      language: 'ru',
      mediaType: 'audio/mpeg',
      durationSeconds: 2484.5,
    },
    recordingRightsAndPrivacyConfirmed: true,
  })
})

test('direct recording drafts fail closed on unstable, private, unsupported, or unconfirmed input', () => {
  const detail = parseSermonPublicationDetail(detailResponse())
  const cases: Array<[string, DraftOverrides, RegExp]> = [
    ['HTTP', {
      directAudio: { url: 'http://media.example.church/sermon.mp3' },
      recordingRightsAndPrivacyConfirmed: true,
    }, /stable public HTTPS/],
    ['query string', {
      directAudio: { url: 'https://media.example.church/sermon.mp3?token=secret' },
      recordingRightsAndPrivacyConfirmed: true,
    }, /query string/],
    ['private host', {
      directAudio: { url: 'https://127.0.0.1/sermon.mp3' },
      recordingRightsAndPrivacyConfirmed: true,
    }, /private host/],
    ['reserved host', {
      directAudio: { url: 'https://media.church.example/sermon.mp3' },
      recordingRightsAndPrivacyConfirmed: true,
    }, /private host/],
    ['missing confirmation', {
      directAudio: { url: 'https://media.example.church/sermon.mp3' },
    }, /recording rights/],
    ['unsupported format', {
      directAudio: {
        url: 'https://media.example.church/sermon.mp3',
        mediaType: 'application/octet-stream' as never,
      },
      recordingRightsAndPrivacyConfirmed: true,
    }, /format is unsupported/],
    ['invalid duration', {
      directAudio: {
        url: 'https://media.example.church/sermon.mp3',
        durationSeconds: '0',
      },
      recordingRightsAndPrivacyConfirmed: true,
    }, /positive number/],
  ]
  for (const [label, overrides, pattern] of cases) {
    assert.throws(
      () => buildSermonPublishIntent(detail, reviewedDraft(overrides)),
      pattern,
      label,
    )
  }
})

test('withdraw intent is explicit and CAS-protected by the current active pointer', () => {
  const detail = parseSermonPublicationDetail(detailResponse())
  assert.deepEqual(buildSermonWithdrawIntent(detail), {
    schemaVersion: 1,
    action: 'withdraw',
    syncId: 'sermon-review-1',
    expectedSyncVersion: 9,
    expectedCurrentRevision: CURRENT_REVISION,
    expectedPublicationVersion: 4,
    expectedPublicRevision: PUBLIC_REVISION,
  })

  const withdrawn = parseSermonPublicationDetail(detailResponse(pointer({
    active: false,
    withdrawnAt: '2026-07-27T20:00:00.000Z',
  })))
  assert.throws(() => buildSermonWithdrawIntent(withdrawn), /not currently public/)
})

test('conflicts are recognized narrowly and mutation response shape is strict', () => {
  assert.equal(isSermonPublicationConflict(412, 'SERMON_VERSION_CONFLICT'), true)
  assert.equal(isSermonPublicationConflict(412, 'PUBLICATION_VERSION_CONFLICT'), true)
  assert.equal(isSermonPublicationConflict(409, 'SERMON_VERSION_CONFLICT'), false)
  assert.equal(isSermonPublicationConflict(412, 'OTHER_CONFLICT'), false)

  const response = parseSermonPublicationMutationResponse({
    schemaVersion: 1,
    sermon: {
      syncId: 'sermon-review-1',
      syncVersion: 10,
      currentRevision: 'f'.repeat(64),
      updatedAt: '2026-07-27T21:00:00.000Z',
      archived: false,
    },
    publication: pointer({ publicationVersion: 5 }),
  })
  assert.equal(response.sermon.syncVersion, 10)
  assert.equal(response.publication.publicationVersion, 5)
})

test('response contract drift fails closed before an operator can approve it', () => {
  assert.throws(
    () => parseSermonPublicationDetail({
      ...detailResponse(),
      inferredSelection: true,
    }),
    /does not match the supported response contract/,
  )
})
