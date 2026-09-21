import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase'
const databaseUrl = process.env.HERITAGE_BIBLE_IMPORT_TEST_DATABASE

test('real Bible import preview, permission, private storage, exact lookup and tenant boundaries', { skip: !databaseUrl }, async () => {
  assertDisposableLiveDatabase({ databaseUrl, expectedDatabase: 'bible_import_ci', expectedMarker: 'bible-import', variableName: 'HERITAGE_BIBLE_IMPORT_TEST_DATABASE' })
  const { getPayload, createLocalReq } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { bibleImportResponse } = await import('../src/endpoints/bibleImports')
  const { installedBiblePassage } = await import('../src/lib/bible/InstalledBibles')
  const payload = await getPayload({ config })
  try {
    const community = (await payload.find({ collection: 'communities', where: { slug: { equals: process.env.COMMUNITY_ID! } } })).docs[0]
    const manager = (await payload.find({ collection: 'users', where: { email: { equals: process.env.BOOTSTRAP_ADMIN_EMAIL! } } })).docs[0]
    assert.ok(community && manager)
    const member = await payload.create({ collection: 'users', data: { email: `bible-member-${randomUUID()}@example.org`, displayName: 'Test member', password: 'disposable-test-password', systemRole: 'member', accountProtection: 'email', syncGeneration: 1 } })
    await payload.create({ collection: 'memberships', data: { community: community.id, user: member.id, role: 'member', joinedAt: new Date().toISOString() } })
    const origin = process.env.COMMUNITY_PUBLIC_URL!
    async function req(body?: unknown, user: typeof manager | null = manager, headers = {}) {
      const http = new Request(origin + '/api/community/bible-translations', { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })
      return createLocalReq({ user: user || undefined, req: { headers: http.headers, method: http.method, url: http.url, body: http.body } }, payload)
    }
    const input = JSON.parse(readFileSync(new URL('../public/bible-import-example.json', import.meta.url), 'utf8'))
    input.translation.id = 'TEST-' + randomUUID().slice(0, 8).toUpperCase()
    const source = JSON.stringify(input)
    for (const [user, status] of [[null, 401], [member, 403]] as const) assert.equal((await bibleImportResponse(await req({ source }, user), 'preview', origin)).status, status)
    assert.equal((await bibleImportResponse(await req({ source }, manager, { origin: 'https://foreign.example' }), 'preview', origin)).status, 403)
    assert.equal((await bibleImportResponse(await req({ source }, manager, { authorization: 'SyncShow test-device' }), 'preview', origin)).status, 403)
    const before = await payload.count({ collection: 'bible-translations' })
    const preview = await bibleImportResponse(await req({ source }), 'preview', origin)
    assert.equal(preview.status, 200); assert.match(preview.headers.get('cache-control')!, /no-store/)
    const details = await preview.json(); assert.equal(details.preview.verseCount, 3)
    assert.equal((await payload.count({ collection: 'bible-translations' })).totalDocs, before.totalDocs)
    const write = { source, digest: details.digest, permissionConfirmed: true, permissionReference: 'CC0 / PRIVATE_LICENSE_RECEIPT' }
    assert.equal((await bibleImportResponse(await req({ ...write, permissionConfirmed: false }), 'install', origin)).status, 400)
    assert.equal((await bibleImportResponse(await req({ ...write, digest: 'f'.repeat(64) }), 'install', origin)).status, 409)
    assert.equal((await bibleImportResponse(await req(write), 'install', origin)).status, 201)
    assert.equal((await bibleImportResponse(await req(write), 'install', origin)).status, 200)
    assert.equal((await payload.count({ collection: 'bible-translations' })).totalDocs, before.totalDocs + 1)
    const text = await (await bibleImportResponse(await req(), 'list', origin)).text()
    assert.match(text, new RegExp(input.translation.id)); assert.doesNotMatch(text, /PRIVATE_LICENSE_RECEIPT|documentSource|apostle|servant/)
    const stored = (await payload.find({ collection: 'bible-translations', where: { translationId: { equals: input.translation.id } }, showHiddenFields: true })).docs[0]
    assert.equal(JSON.parse(stored.documentSource).books[0].chapters[0].verses[0].text, input.books[0].chapters[0].verses[0].text)
    assert.equal(stored.permissionReference, 'CC0 / PRIVATE_LICENSE_RECEIPT')
    await assert.rejects(payload.find({ collection: 'bible-translations', user: manager, overrideAccess: false }), (error: any) => error.status === 403)
    await assert.rejects(payload.findByID({ collection: 'bible-translations', id: stored.id, overrideAccess: false }))
    await assert.rejects(payload.update({ collection: 'bible-translations', id: stored.id, data: { name: 'Changed' } }), /immutable/)
    const range = { schemaVersion: 1 as const, bookId: 'Rom', start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 3 } }
    const pinned = await installedBiblePassage(await req(), community.id, input.translation.id, range)
    assert.deepEqual(pinned.passage.verses, input.books[0].chapters[0].verses)
    assert.equal(pinned.passage.attribution, input.translation.attribution)
    await assert.rejects(installedBiblePassage(await req(), community.id + 1000, input.translation.id, range), /not installed/)
    await assert.rejects(installedBiblePassage(await req(), community.id, input.translation.id, { ...range, end: { chapter: 1, verse: 4 } }), /verse 4/)
    input.books[0].chapters[0].verses[0].text = 'Different edition'
    const changed = JSON.stringify(input)
    const changedPreview = await (await bibleImportResponse(await req({ source: changed }), 'preview', origin)).json()
    assert.equal(changedPreview.conflict, true)
    assert.equal((await bibleImportResponse(await req({ ...write, source: changed, digest: changedPreview.digest }), 'install', origin)).status, 409)
  } finally { await payload.destroy() }
})
