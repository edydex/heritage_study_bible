import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase'
import core from '../packages/service-core/index.js'
import { createTemplateSlide } from '../src/components/plannerTemplates'
import { importSermonPresentation } from '../src/components/importSermonPresentation'

const databaseUrl = process.env.HERITAGE_SONGBOOK_TEST_DATABASE
test('real HTTP calendar privacy, persistent defaults, tag sorting and sermon presentation round trip', { skip: !databaseUrl }, async () => {
  assertDisposableLiveDatabase({ databaseUrl, expectedDatabase: 'songbook_ci', expectedMarker: 'songbook-publication', variableName: 'HERITAGE_SONGBOOK_TEST_DATABASE' })
  const base = process.env.COMMUNITY_PUBLIC_URL!
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  let token = ''
  async function call(path: string, method = 'GET', body?: any, authenticated = true) {
    const response = await fetch(`${base}/api/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(authenticated && token ? { Authorization: `JWT ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const value = await response.json()
    return { status: response.status, value }
  }
  const login = await call('users/login', 'POST', { email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD })
  assert.equal(login.status, 200); token = login.value.token
  const old = await call('community/calendar/settings'); assert.equal(old.status, 200)
  const prefix = `workflow-${randomUUID()}`, events: number[] = [], songs: number[] = []
  const settings = { ...old.value, timeZone: 'America/Los_Angeles', defaultVisibility: 'members' }
  try {
    assert.equal((await call('community/calendar/settings', 'PUT', settings)).status, 200)
    assert.equal((await call('community/calendar/settings')).value.timeZone, 'America/Los_Angeles')
    assert.equal((await call('community/calendar/settings', 'PUT', settings, false)).status, 401)
    for (const visibility of ['inherit', 'public', 'members']) {
      const created = await call('events', 'POST', { community: settings.communityId, title: `${prefix}-${visibility}`, startsAt: '2026-10-25T17:00:00Z', endsAt: '2026-10-25T18:00:00Z', visibility, recurrence: 'weekly' })
      assert.equal(created.status, 201, JSON.stringify(created.value)); events.push(created.value.doc.id)
      assert.equal(created.value.doc.timeZone, 'America/Los_Angeles')
    }
    const calendar = 'community/calendar?from=2026-10-25&to=2026-11-08'
    let publicEvents = (await call(calendar, 'GET', undefined, false)).value.events
    assert.equal(publicEvents.filter((event: any) => event.title.startsWith(prefix)).length, 3)
    assert.ok(!JSON.stringify(publicEvents).includes(`${prefix}-members`))
    assert.ok(!JSON.stringify(publicEvents).includes('community'))
    assert.equal((await call(calendar)).value.events.filter((event: any) => event.title.startsWith(prefix)).length, 9)
    await call('community/calendar/settings', 'PUT', { ...settings, defaultVisibility: 'public' })
    publicEvents = (await call(calendar, 'GET', undefined, false)).value.events
    assert.equal(publicEvents.filter((event: any) => event.title.startsWith(prefix)).length, 6)
    assert.equal((await call('events', 'GET', undefined, false)).status, 403)

    for (const title of ['Zulu', 'Alpha', 'Middle']) {
      const result = await call('songs', 'POST', { community: settings.communityId, title: `${prefix}-${title}`, slug: `${prefix}-${title.toLowerCase()}`, tags: ['choir'], songbookVisibility: 'private' })
      assert.equal(result.status, 201, JSON.stringify(result.value)); songs.push(result.value.doc.id)
    }
    const sorted = await call(`songs?sort=tags&limit=100&where[slug][contains]=${prefix}`)
    assert.equal(sorted.status, 200, JSON.stringify(sorted.value))
    assert.deepEqual(sorted.value.docs.map((song: any) => song.title), ['Alpha', 'Middle', 'Zulu'].map(title => `${prefix}-${title}`))
    await call(`songs/${songs[0]}`, 'PATCH', { tags: ['solo'] })
    assert.deepEqual((await call(`songs/${songs[0]}`)).value.tags, ['solo'])

    const requestId = randomUUID()
    const data = { requestId, title: `${prefix}-sermon`, speaker: 'Rehearsal pastor', serviceDate: '2026-09-20', language: 'en' }
    const created = await call('community/sermon-drafts', 'POST', data)
    assert.equal(created.status, 201, JSON.stringify(created.value))
    assert.equal((await call('community/sermon-drafts', 'POST', data)).value.syncId, created.value.syncId)
    const path = `community/sermon-presentations/${created.value.syncId}`
    const opened = await call(path, 'POST'); assert.equal(opened.status, 200, JSON.stringify(opened.value))
    const again = await call(path, 'POST'); assert.equal(again.value.serviceDocument.revision, opened.value.serviceDocument.revision)
    const envelope = opened.value.serviceDocument
    const project = core.parseHeritageServiceDocumentSource(envelope.documentSource).project
    const imageBytes = await sharp({ create: { width: 16, height: 9, channels: 3, background: '#245134' } }).png().toBuffer()
    const imageHash = createHash('sha256').update(imageBytes).digest('hex')
    const imageId = `sha256:${imageHash}`
    const upload = await fetch(`${base}/api/community/service-documents/assets/${encodeURIComponent(imageId)}`, {method:'PUT',headers:{Authorization:`JWT ${token}`,'Content-Type':'image/png'},body:imageBytes})
    assert.equal(upload.status, 201)
    const image = { ...(await upload.json()).asset, fileName:'rehearsal.png',storedName:`${imageHash}.png`,kind:'image',altText:'Rehearsal',attribution:'' }
    let deck = createTemplateSlide(project, {id:'test-point',template:'point',english:{heading:'Love',body:'Be patient'},russian:{heading:'Любовь',body:'Будьте терпеливы'},selectedId:null})
    deck = createTemplateSlide(deck, {id:'test-image',template:'title',english:{heading:'Rehearsal',body:''},russian:{heading:'Проверка',body:''},selectedId:'test-point',asset:image})
    const documentSource = core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...deck,revision:2}))
    const write = {schemaVersion:1,requestId:randomUUID(),syncId:envelope.syncId,baseSyncVersion:envelope.syncVersion,baseRevision:envelope.revision,documentSource,status:'planning'}
    const saved = await call(`community/service-documents/${envelope.syncId}`, 'PUT', write)
    assert.equal(saved.status, 200, JSON.stringify(saved.value))
    const stale = await call(`community/service-documents/${envelope.syncId}`, 'PUT', {...write,requestId:randomUUID()})
    assert.equal(stale.status, 412)
    const reopened = await call(path)
    assert.equal(reopened.value.serviceDocument.documentSource, documentSource)
    const services = await call('community/service-documents')
    assert.ok(!services.value.items.some((item: any) => item.syncId === envelope.syncId))
    assert.equal((await call(path, 'GET', undefined, false)).status, 401)
    const imported = importSermonPresentation({...project,id:`service-${requestId}`}, deck, reopened.value.sermonDocument, null)
    assert.ok(JSON.stringify(imported.project).includes('Будьте терпеливы'))
    const serviceSource = core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...imported.project,revision:1}))
    const serviceSaved = await call(`community/service-documents/${imported.project.id}`, 'PUT', {schemaVersion:1,requestId:randomUUID(),syncId:imported.project.id,baseSyncVersion:null,baseRevision:null,documentSource:serviceSource,status:'planning'})
    assert.equal(serviceSaved.status, 200, JSON.stringify(serviceSaved.value))
    const copiedImage = await fetch(`${base}/api/community/service-documents/${imported.project.id}/assets/${encodeURIComponent(imageId)}`, {headers:{Authorization:`JWT ${token}`}})
    assert.equal(copiedImage.status, 200)
    assert.equal(createHash('sha256').update(Buffer.from(await copiedImage.arrayBuffer())).digest('hex'), imageHash)
    assert.equal((await call('community/sermon-presentations')).value.items[0].syncId, created.value.syncId)
  } finally {
    for (const id of events) await call(`events/${id}`, 'DELETE')
    for (const id of songs) await call(`songs/${id}`, 'PATCH', {status:'archived',songbookVisibility:'private'})
    await call('community/calendar/settings', 'PUT', old.value)
  }
})
