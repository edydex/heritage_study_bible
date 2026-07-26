import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  deviceGrantPollingStatus,
  effectiveSyncDocuments,
  isSongVisibleToMember,
  legacyFieldsFromSyncDocuments,
  mergeLegacyEditsIntoSyncDocuments,
  normalizeSongMutation,
  normalizeSyncDocuments,
  pkceChallengeForVerifier,
  pkceChallengeMatches,
  songEtag,
  syncShowAccessToken,
  synthesizeLegacySyncDocuments,
  SyncShowProtocolError,
} from '../src/lib/syncShowProtocol.ts'
import { privateAuthorizationJson } from '../src/lib/publicConfig.ts'

function sourceDocument({
  id,
  language,
  title,
  body,
  metadata = [],
}: {
  id: string
  language: string
  title: string
  body: string
  metadata?: string[]
}) {
  const source = [
    '---',
    `id: ${JSON.stringify(id)}`,
    `title: ${JSON.stringify(title)}`,
    `language: ${language}`,
    ...metadata,
    '---',
    '',
    body,
    '',
  ].join('\n')
  return {
    id,
    source,
    revision: createHash('sha256').update(source).digest('hex'),
  }
}

test('PKCE uses S256 and rejects a different verifier without a timing-unsafe equality', () => {
  const verifier = 'v'.repeat(43)
  const challenge = pkceChallengeForVerifier(verifier)
  assert.equal(pkceChallengeMatches(verifier, challenge), true)
  assert.equal(pkceChallengeMatches('x'.repeat(43), challenge), false)
})

test('device token exchange is deterministic for safe lost-response retries', () => {
  const first = syncShowAccessToken('server-secret', 'device-1', 'device-secret', 'pkce-challenge')
  const retry = syncShowAccessToken('server-secret', 'device-1', 'device-secret', 'pkce-challenge')
  assert.equal(retry, first)
  assert.notEqual(
    syncShowAccessToken('server-secret', 'device-1', 'different-secret', 'pkce-challenge'),
    first,
  )
  assert.notEqual(
    syncShowAccessToken('different-server', 'device-1', 'device-secret', 'pkce-challenge'),
    first,
  )
})

test('consumed device status survives grant expiry for exactly the token retry grace', () => {
  const now = new Date('2026-07-25T20:00:00.000Z')
  const expiredGrant = {
    status: 'consumed',
    expiresAt: '2026-07-25T19:59:59.000Z',
  }
  assert.equal(deviceGrantPollingStatus({
    ...expiredGrant,
    consumedAt: '2026-07-25T19:45:01.000Z',
  }, now, 15 * 60_000), 'consumed')
  assert.equal(deviceGrantPollingStatus({
    ...expiredGrant,
    consumedAt: '2026-07-25T19:45:00.000Z',
  }, now, 15 * 60_000), 'expired')
  assert.equal(deviceGrantPollingStatus({
    status: 'consumed',
    expiresAt: '2026-07-25T20:00:01.000Z',
    consumedAt: '2026-07-25T19:30:00.000Z',
  }, now, 15 * 60_000), 'consumed')
})

test('member visibility uses server time and never exposes draft/private songs', () => {
  const now = new Date('2026-07-25T18:00:00.000Z')
  assert.equal(isSongVisibleToMember({ status: 'published', visibility: 'public' }, now), true)
  assert.equal(isSongVisibleToMember({
    status: 'published',
    visibility: 'scheduled-public',
    publishAt: '2026-07-25T17:59:59.000Z',
  }, now), true)
  assert.equal(isSongVisibleToMember({
    status: 'published',
    visibility: 'scheduled-public',
    publishAt: '2026-07-25T18:00:01.000Z',
  }, now), false)
  assert.equal(isSongVisibleToMember({ status: 'draft', visibility: 'public' }, now), false)
  assert.equal(isSongVisibleToMember({ status: 'published', visibility: 'private' }, now), false)
})

test('authorization-dependent responses override public caching even for denied content', async () => {
  const response = privateAuthorizationJson(
    { error: 'Not found.' },
    {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=3600',
        Vary: 'Accept',
      },
    },
  )

  assert.equal(response.status, 404)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('Vary'), 'Accept, Authorization')
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive')
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
  assert.deepEqual(await response.json(), { error: 'Not found.' })
})

test('legacy bilingual songs become deterministic linked SyncShow documents without losing rights', () => {
  const song = {
    id: 12,
    syncId: 'amazing-grace',
    title: 'Amazing Grace',
    russianTitle: 'О, благодать',
    lyrics: 'Verse 1\nAmazing grace\nHow sweet the sound\n\nChorus\nI once was lost',
    russianLyrics: 'Куплет 1\nО, благодать\n\nПрипев\nЯ был потерян',
    authors: ['John Newton'],
    license: 'Public domain',
    copyright: 'Historic English text',
    rightsNotes: 'Russian translation reviewed separately.',
    sourceUrl: 'https://example.test/amazing-grace',
  }
  const documents = synthesizeLegacySyncDocuments(song)
  assert.equal(documents.length, 2)
  assert.match(documents[0].source, /\^1\nAmazing grace/)
  assert.match(documents[0].source, /\^chorus\nI once was lost/)
  assert.match(documents[0].source, /authors: \["John Newton"\]/)
  assert.match(documents[0].source, /Historic English text\\nRussian translation reviewed separately\./)
  assert.match(documents[1].source, /translationOf: "amazing-grace"/)
  assert.match(documents[1].source, /\^1\nО, благодать/)
  assert.match(documents[1].source, /\^chorus\nЯ был потерян/)
  assert.equal(normalizeSyncDocuments(documents)?.length, 2)
})

test('legacy songs treat null optional Payload fields as absent', () => {
  const [document] = synthesizeLegacySyncDocuments({
    id: 31,
    syncId: 'legacy-null-rights',
    title: 'Legacy Song',
    lyrics: 'Verse one',
    authors: null,
    license: null,
    copyright: null,
    rightsNotes: null,
    sourceUrl: null,
  })

  assert.ok(document)
  assert.match(document.source, /title: "Legacy Song"/)
  assert.doesNotMatch(document.source, /^(?:authors|license|attribution|source):/m)
})

test('legacy English-only songs remain one usable document and empty sync input cannot erase them', () => {
  const song = {
    id: 7,
    syncId: 'english-only',
    status: 'published',
    visibility: 'public',
    syncVersion: 1,
    syncDocuments: [],
    title: 'English only',
    lyrics: 'First paragraph\nSecond line\n\nSecond paragraph',
  }
  const synthesized = effectiveSyncDocuments(song)
  assert.equal(synthesized.length, 1)
  assert.match(synthesized[0].source, /\^1\nFirst paragraph/)
  assert.match(synthesized[0].source, /\^2\nSecond paragraph/)
  const mutation = normalizeSongMutation({ syncDocuments: [], visibility: 'public' }, { existing: song })
  assert.deepEqual(mutation.syncDocuments, synthesized)
  assert.equal(song.lyrics, 'First paragraph\nSecond line\n\nSecond paragraph')
})

test('SyncShow can create from canonical documents alone and projects edits into Heritage fields', () => {
  const english = sourceDocument({
    id: 'new-song',
    language: 'en',
    title: 'New Song',
    body: '^1\nA new lyric',
    metadata: [
      'authors: ["Writer One", "Writer Two"]',
      'license: "Church license"',
      'source: "https://example.test/new-song"',
    ],
  })
  const russian = sourceDocument({
    id: 'new-song-ru',
    language: 'ru',
    title: 'Новая песня',
    body: '^1\nНовая строка',
    metadata: ['translationOf: "new-song"'],
  })
  const mutation = normalizeSongMutation({
    syncId: 'new-song',
    syncDocuments: [english, russian],
    visibility: 'private',
  }, { create: true })
  assert.equal(mutation.title, 'New Song')
  assert.equal(mutation.russianTitle, 'Новая песня')
  assert.match(String(mutation.lyrics), /A new lyric/)
  assert.match(String(mutation.russianLyrics), /Новая строка/)
  assert.deepEqual(mutation.authors, ['Writer One', 'Writer Two'])
  assert.equal(mutation.license, 'Church license')
  assert.equal(mutation.sourceUrl, 'https://example.test/new-song')
})

test('document projection preserves Community-only rights fields when source omits them', () => {
  const document = sourceDocument({
    id: 'rights-song',
    language: 'en',
    title: 'Edited title',
    body: '^1\nEdited lyric',
  })
  const existing = {
    syncId: 'rights-song',
    status: 'published',
    visibility: 'public',
    title: 'Old title',
    lyrics: 'Old lyric',
    rightsStatus: 'licensed',
    ccliNumber: '12345',
    copyright: '© Rights holder',
    rightsNotes: 'Report through the church account.',
    permissionUrl: 'https://example.test/permission',
    license: 'Existing license',
    sourceUrl: 'https://example.test/source',
  }
  const mutation = normalizeSongMutation({ syncDocuments: [document] }, { existing })
  assert.equal(mutation.title, 'Edited title')
  assert.match(String(mutation.lyrics), /Edited lyric/)
  for (const protectedField of ['rightsStatus', 'ccliNumber', 'copyright', 'rightsNotes', 'permissionUrl', 'license', 'sourceUrl']) {
    assert.equal(Object.hasOwn(mutation, protectedField), false)
  }
  assert.deepEqual({ ...existing, ...mutation }, {
    ...existing,
    ...mutation,
    rightsStatus: 'licensed',
    ccliNumber: '12345',
    copyright: '© Rights holder',
    rightsNotes: 'Report through the church account.',
    permissionUrl: 'https://example.test/permission',
    license: 'Existing license',
    sourceUrl: 'https://example.test/source',
  })
})

test('admin legacy edits preserve rich bodies, unknown metadata, arrangements, and other languages', () => {
  const english = sourceDocument({
    id: 'family-en',
    language: 'en',
    title: 'Old English',
    body: '^verse-a\nLine one\n---\nLine two\n\n^chorus\nExact chorus',
    metadata: [
      'authors: ["Old Writer"]',
      'attribution: "Old copyright\\nOld rights"',
      'customKey: "keep-this-value"',
    ],
  })
  const alternateEnglish = sourceDocument({
    id: 'family-en-acoustic',
    language: 'en-US',
    title: 'Old English (Acoustic)',
    body: '^intro\nKeep this arrangement exact',
    metadata: ['arrangement: "acoustic"'],
  })
  const russian = sourceDocument({
    id: 'family-ru',
    language: 'ru',
    title: 'Старая',
    body: '^verse-a\nСтарая строка\n---\nСледующая строка',
    metadata: ['attribution: "Old copyright\\nOld rights"', 'customRu: "keep-russian"'],
  })
  const ukrainian = sourceDocument({
    id: 'family-uk',
    language: 'uk',
    title: 'Українська',
    body: '^1\nТочний текст',
    metadata: ['customUk: "keep-ukrainian"'],
  })
  const existing = {
    syncId: 'family',
    title: 'Old English',
    russianTitle: 'Старая',
    lyrics: 'Old projected lyric',
    russianLyrics: 'Старая строка',
    authors: ['Old Writer'],
    copyright: 'Old copyright',
    rightsNotes: 'Old rights',
    syncDocuments: [english, alternateEnglish, russian, ukrainian],
  }

  const rightsEdited = mergeLegacyEditsIntoSyncDocuments(existing, {
    authors: ['New Writer'],
    copyright: 'New copyright',
    rightsNotes: 'New rights',
  })
  assert.deepEqual(
    rightsEdited.map(document => document.id),
    ['family-en', 'family-en-acoustic', 'family-ru', 'family-uk'],
  )
  assert.match(rightsEdited[0].source, /authors: \["New Writer"\]/)
  assert.match(rightsEdited[0].source, /attribution: "New copyright\\nNew rights"/)
  assert.match(rightsEdited[0].source, /customKey: "keep-this-value"/)
  assert.equal(rightsEdited[0].source.slice(rightsEdited[0].source.indexOf('^verse-a')), english.source.slice(english.source.indexOf('^verse-a')))
  assert.match(rightsEdited[2].source, /customRu: "keep-russian"/)
  assert.equal(rightsEdited[2].source.slice(rightsEdited[2].source.indexOf('^verse-a')), russian.source.slice(russian.source.indexOf('^verse-a')))
  assert.equal(rightsEdited[1].source, alternateEnglish.source)
  assert.equal(rightsEdited[1].revision, alternateEnglish.revision)
  assert.equal(rightsEdited[3].source, ukrainian.source)
  assert.equal(rightsEdited[3].revision, ukrainian.revision)

  const lyricsEdited = mergeLegacyEditsIntoSyncDocuments(
    { ...existing, syncDocuments: rightsEdited },
    { lyrics: 'Verse 1\nA deliberately new line' },
  )
  assert.match(lyricsEdited[0].source, /\^1\nA deliberately new line/)
  assert.equal(lyricsEdited[1].source, rightsEdited[1].source)
  assert.equal(lyricsEdited[2].source, rightsEdited[2].source)
  assert.equal(lyricsEdited[3].source, rightsEdited[3].source)
})

test('canonical-only create supports Russian-only and arbitrary non-English song families', () => {
  const russian = sourceDocument({
    id: 'only-russian',
    language: 'ru',
    title: 'Только русская',
    body: '^1\nРусская строка',
  })
  const russianMutation = normalizeSongMutation({
    syncId: 'only-russian',
    syncDocuments: [russian],
    visibility: 'private',
  }, { create: true })
  assert.equal(russianMutation.title, 'Только русская')
  assert.equal(russianMutation.russianTitle, 'Только русская')
  assert.equal(russianMutation.lyrics, undefined)
  assert.match(String(russianMutation.russianLyrics), /Русская строка/)

  const ukrainian = sourceDocument({
    id: 'only-ukrainian',
    language: 'uk',
    title: 'Лише українська',
    body: '^1\nУкраїнський рядок',
  })
  const ukrainianMutation = normalizeSongMutation({
    syncId: 'only-ukrainian',
    syncDocuments: [ukrainian],
    visibility: 'public',
  }, { create: true })
  assert.equal(ukrainianMutation.title, 'Лише українська')
  assert.match(String(ukrainianMutation.lyrics), /Український рядок/)
})

test('adding English to a Russian-only root keeps unique IDs and links the preserved translation', () => {
  const russian = sourceDocument({
    id: 'russian-root',
    language: 'ru',
    title: 'Русский корень',
    body: '^verse\nСохранить точно\n---\nСледующий слайд',
    metadata: ['customRu: "keep-root-metadata"'],
  })
  const existing = {
    syncId: 'russian-root',
    title: 'Русский корень',
    russianTitle: 'Русский корень',
    russianLyrics: 'Сохранить точно',
    syncDocuments: [russian],
  }
  const merged = mergeLegacyEditsIntoSyncDocuments(existing, {
    title: 'English addition',
    lyrics: 'Verse 1\nNew English line',
  })
  assert.deepEqual(merged.map(document => document.id), ['russian-root-en', 'russian-root'])
  assert.match(merged[0].source, /language: en/)
  assert.match(merged[0].source, /\^1\nNew English line/)
  assert.match(merged[0].source, /translationOf: "russian-root"/)
  assert.doesNotMatch(merged[1].source, /translationOf:/)
  assert.match(merged[1].source, /customRu: "keep-root-metadata"/)
  assert.equal(
    merged[1].source.slice(merged[1].source.indexOf('^verse')),
    russian.source.slice(russian.source.indexOf('^verse')),
  )
  assert.equal(normalizeSyncDocuments(merged)?.length, 2)
})

test('generic edits reach a Russian-only or arbitrary-language canonical root', () => {
  const russian = sourceDocument({
    id: 'ru-generic',
    language: 'ru',
    title: 'Старое название',
    body: '^1\nСтарая строка',
    metadata: ['customRu: "preserved"'],
  })
  const renamed = mergeLegacyEditsIntoSyncDocuments({
    syncId: 'ru-generic',
    title: 'Старое название',
    russianTitle: 'Старое название',
    russianLyrics: 'Старая строка',
    syncDocuments: [russian],
  }, { title: 'Новое общее название' })
  assert.match(renamed[0].source, /title: "Новое общее название"/)
  assert.match(renamed[0].source, /customRu: "preserved"/)
  assert.equal(
    renamed[0].source.slice(renamed[0].source.indexOf('^1')),
    russian.source.slice(russian.source.indexOf('^1')),
  )

  const ukrainian = sourceDocument({
    id: 'uk-generic',
    language: 'uk',
    title: 'Стара українська',
    body: '^verse-a\nСтарий рядок\n---\nСтарий другий слайд',
    metadata: [
      'attribution: "Old copyright\\nOld rights"',
      'customUk: "preserved"',
    ],
  })
  const edited = mergeLegacyEditsIntoSyncDocuments({
    syncId: 'uk-generic',
    title: 'Стара українська',
    lyrics: 'Старий рядок',
    copyright: 'Old copyright',
    rightsNotes: 'Old rights',
    syncDocuments: [ukrainian],
  }, {
    title: 'Нова українська',
    lyrics: 'Verse 1\nНовий рядок',
    rightsNotes: 'Updated rights',
  })
  assert.equal(edited[0].id, 'uk-generic')
  assert.match(edited[0].source, /language: uk/)
  assert.match(edited[0].source, /title: "Нова українська"/)
  assert.match(edited[0].source, /\^1\nНовий рядок/)
  assert.match(edited[0].source, /attribution: "Old copyright\\nUpdated rights"/)
  assert.match(edited[0].source, /customUk: "preserved"/)
})

test('English added beside an arbitrary-language root cannot collide with the root ID', () => {
  const ukrainian = sourceDocument({
    id: 'shared-root',
    language: 'uk',
    title: 'Український корінь',
    body: '^1\nЗбережений рядок',
  })
  const merged = mergeLegacyEditsIntoSyncDocuments({
    syncId: 'shared-root',
    title: 'Український корінь',
    syncDocuments: [ukrainian],
  }, {
    title: 'New English',
    lyrics: 'New English line',
  })
  assert.deepEqual(merged.map(document => document.id), ['shared-root-en', 'shared-root'])
  assert.match(merged[0].source, /translationOf: "shared-root"/)
  assert.equal(merged[1].source, ukrainian.source)
  assert.equal(normalizeSyncDocuments(merged)?.length, 2)
})

test('adding English and Russian to a custom-language root keeps exactly one family root', () => {
  const ukrainian = sourceDocument({
    id: 'multilingual-root',
    language: 'uk',
    title: 'Український корінь',
    body: '^1\nТочний український текст',
    metadata: ['customRoot: "preserve-root"'],
  })
  const arrangement = sourceDocument({
    id: 'multilingual-special',
    language: 'uk-UA',
    title: 'Особлива версія',
    body: '^special\nТочне аранжування\n---\nДругий слайд',
    metadata: [
      'translationOf: "multilingual-root"',
      'arrangement: "special"',
      'customArrangement: "preserve-arrangement"',
    ],
  })
  const merged = mergeLegacyEditsIntoSyncDocuments({
    syncId: 'multilingual-root',
    title: 'Український корінь',
    syncDocuments: [ukrainian, arrangement],
  }, {
    title: 'English addition',
    lyrics: 'English line',
    russianTitle: 'Русское добавление',
    russianLyrics: 'Русская строка',
  })
  assert.deepEqual(
    merged.map(document => document.id),
    ['multilingual-root-en', 'multilingual-root', 'multilingual-special', 'multilingual-root-ru'],
  )
  const roots = merged.filter(document => !/^translationOf:/m.test(document.source))
  assert.deepEqual(roots.map(document => document.id), ['multilingual-root'])
  for (const document of merged.filter(document => document.id !== 'multilingual-root')) {
    assert.match(document.source, /translationOf: "multilingual-root"/)
  }
  assert.equal(merged[1].source, ukrainian.source)
  assert.match(merged[2].source, /customArrangement: "preserve-arrangement"/)
  assert.equal(
    merged[2].source.slice(merged[2].source.indexOf('^special')),
    arrangement.source.slice(arrangement.source.indexOf('^special')),
  )
  assert.equal(normalizeSyncDocuments(merged)?.length, 4)
})

test('removing a family root promotes one deterministic survivor and retargets every sibling', () => {
  const english = sourceDocument({
    id: 'family-root',
    language: 'en',
    title: 'English root',
    body: '^1\nEnglish line',
  })
  const russian = sourceDocument({
    id: 'family-root-ru',
    language: 'ru',
    title: 'Русский перевод',
    body: '^verse\nТочный перевод\n---\nСледующий слайд',
    metadata: ['translationOf: "family-root"', 'customRu: "keep"'],
  })
  const custom = sourceDocument({
    id: 'family-root-uk-special',
    language: 'uk',
    title: 'Особлива версія',
    body: '^special\nТочний текст',
    metadata: ['translationOf: "family-root"', 'customUk: "keep"'],
  })
  const merged = mergeLegacyEditsIntoSyncDocuments({
    syncId: 'family-root',
    title: 'English root',
    lyrics: 'English line',
    russianTitle: 'Русский перевод',
    russianLyrics: 'Точный перевод',
    syncDocuments: [english, russian, custom],
  }, { lyrics: '' })
  assert.deepEqual(merged.map(document => document.id), ['family-root-ru', 'family-root-uk-special'])
  assert.doesNotMatch(merged[0].source, /translationOf:/)
  assert.match(merged[1].source, /translationOf: "family-root-ru"/)
  assert.match(merged[0].source, /customRu: "keep"/)
  assert.match(merged[1].source, /customUk: "keep"/)
  assert.equal(
    merged[0].source.slice(merged[0].source.indexOf('^verse')),
    russian.source.slice(russian.source.indexOf('^verse')),
  )
  assert.equal(
    merged[1].source.slice(merged[1].source.indexOf('^special')),
    custom.source.slice(custom.source.indexOf('^special')),
  )
  assert.equal(normalizeSyncDocuments(merged)?.length, 2)
})

test('canonical document bounds reject mismatched IDs, missing metadata, and bad checksums', () => {
  const valid = sourceDocument({ id: 'valid-song', language: 'en', title: 'Valid', body: '^1\nLine' })
  assert.deepEqual(normalizeSyncDocuments([valid]), [valid])
  assert.throws(
    () => normalizeSyncDocuments([{ ...valid, id: 'other-song' }]),
    (error: unknown) => error instanceof SyncShowProtocolError && error.code === 'DOCUMENT_ID_MISMATCH',
  )
  assert.throws(
    () => normalizeSyncDocuments([{ ...valid, revision: '0'.repeat(64) }]),
    (error: unknown) => error instanceof SyncShowProtocolError && error.code === 'REVISION_MISMATCH',
  )
  assert.throws(
    () => normalizeSyncDocuments([{ id: 'plain', source: '^1\nNo metadata' }]),
    (error: unknown) => error instanceof SyncShowProtocolError && error.code === 'DOCUMENT_ID_MISMATCH',
  )
})

test('archived records remain archived unless a caller explicitly restores them', () => {
  const archived = {
    syncId: 'archived-song',
    status: 'archived',
    visibility: 'private',
    syncVersion: 3,
    title: 'Archived',
    lyrics: 'Line',
  }
  const mutation = normalizeSongMutation({ description: 'Still archived' }, { existing: archived })
  assert.equal(mutation.status, 'archived')
  assert.equal(mutation.visibility, 'private')
  assert.equal(songEtag({ syncId: 'archived-song', syncVersion: 3 }), '"song:archived-song:3"')
})

test('legacy field projection exposes the same SyncShow lyric edit to Community readers', () => {
  const edited = sourceDocument({
    id: 'reader-song',
    language: 'en',
    title: 'Reader Song',
    body: '^1\nThis edit must reach Heritage',
  })
  const projected = legacyFieldsFromSyncDocuments([edited])
  assert.equal(projected.title, 'Reader Song')
  assert.match(String(projected.lyrics), /This edit must reach Heritage/)
})
