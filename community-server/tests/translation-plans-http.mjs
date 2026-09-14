// Real HTTP + PostgreSQL acceptance, confined to the production-stack CI fixture.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import serviceCore from '../packages/service-core/node.js'
import { htmlRedirectLocation } from './helpers/html-redirect.mjs'
assert.equal(process.env.CI, 'true', 'Run only in the disposable production-stack workflow')
const origin = 'http://127.0.0.1:3300'
const cookies = (await readFile('/tmp/heritage-ci-cookies.txt', 'utf8')).split('\n')
  .filter(line => line && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))
  .map(line => line.split('\t')).map(fields => `${fields[5]}=${fields[6]}`).join('; ')
assert.ok(cookies.includes('payload-token='))
async function request(path, { method = 'GET', body, authenticated = true, requestOrigin = origin, browserSite = 'same-origin' } = {}) {
  const response = await fetch(`${origin}${path}`, { method, headers: {
    ...(authenticated ? { cookie: cookies } : {}), ...(browserSite ? { 'sec-fetch-site': browserSite } : {}), ...(requestOrigin ? { origin: requestOrigin } : {}),
    ...(body ? { 'content-type': 'application/json' } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json() }
}
const path = '/api/community/translation/plans'
// Cookie-only workspace views can redirect before the client loads.
for (const destination of ['/admin', '/admin/prepare-sermon', '/admin/sermon-publications?sermon=sermon-ci']) {
  const response = await fetch(`${origin}${destination}`, { redirect: 'manual' })
  let location
  if ([302, 303, 307, 308].includes(response.status)) {
    location = response.headers.get('location')
  } else {
    // Payload's layout starts streaming before the redirect; inspect Next's record.
    assert.equal(response.status, 200)
    location = htmlRedirectLocation(await response.text())
  }
  assert.ok(location, `Missing sign-in redirect for ${destination}`)
  const signIn = new URL(location, origin)
  assert.equal(signIn.origin, origin)
  assert.equal(signIn.pathname, '/admin/login')
  // Payload already guards the dashboard and defaults to it after sign-in.
  assert.equal(signIn.searchParams.get('redirect') ?? '/admin', destination)
}
// SyncShow's existing windows send their device credential only to API requests.
// Their HTML must load without a cookie; browser visitors redirect after API 401.
for (const [destination, marker] of [
  ['/admin/live-translation?service=service-2099-01-01', 'Opening live translation'],
  ['/admin/plan-service', 'heritage-service-planner'],
]) {
  const response = await fetch(`${origin}${destination}`, { redirect: 'manual' })
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.equal(htmlRedirectLocation(html), null, `Paired SyncShow entry was blocked: ${destination}`)
  assert.ok(html.includes(marker), `Missing client entry for ${destination}`)
}
assert.equal((await request('/api/community/service-documents', { authenticated: false })).status, 401)
const authenticatedPage = await fetch(`${origin}/admin/live-translation?service=service-2099-01-01`, {
  headers: { cookie: cookies, 'sec-fetch-site': 'same-origin' }, redirect: 'manual',
})
assert.equal(authenticatedPage.status, 200)
assert.ok((await authenticatedPage.text()).includes('Opening live translation'))
const loginPage = await fetch(`${origin}/admin/login`)
assert.ok((await loginPage.text()).includes('Heritage reading sync has a separate sign-in'))
assert.equal((await request(path, { authenticated: false })).status, 401)
// Payload correctly rejects origin-less cookie clients without browser provenance.
assert.equal((await request(path, { requestOrigin: null, browserSite: null })).status, 401)
assert.equal((await request(path, { requestOrigin: null, browserSite: 'cross-site' })).status, 401)
const church = (await request('/api/communities?where[slug][equals]=ci-church')).body.docs[0]
assert.ok(church?.id)
const created = await request('/api/service-documents', { method: 'POST', body: { community: church.id, title: 'Disposable translation plan acceptance', serviceDate: '2099-01-01' } })
assert.equal(created.status, 201, JSON.stringify(created.body))
const recordId = created.body.doc.id
const selectedPath = `${path}?serviceId=service-2099-01-01`
const firstRead = await request(selectedPath, { requestOrigin: null })
assert.equal(firstRead.status, 200, JSON.stringify(firstRead))
let plan = firstRead.body.services[0]
assert.ok(plan, JSON.stringify(firstRead))
assert.equal(plan.revision, 0)
const originalRecord = (await request(`/api/service-documents/${recordId}`)).body
const settings = { sourceLanguage: 'ru', translationProfile: 'economy', speechEnabled: false, contextDocumentIds: [] }
const write = { serviceId: plan.id, serviceRevision: plan.serviceRevision, baseRevision: plan.revision, settings }
assert.equal((await request(path, { method: 'PUT', body: write, requestOrigin: 'https://other.example' })).status, 403)
const concurrent = await Promise.all(Array.from({ length: 6 }, () => request(path, { method: 'PUT', body: write })))
assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409, 409, 409, 409, 409], JSON.stringify(concurrent))
plan = (await request(selectedPath)).body.services[0]
assert.equal(plan.revision, 1)
assert.deepEqual(plan.settings, settings)
assert.equal(plan.serviceRevision, write.serviceRevision)
const afterSave = (await request(`/api/service-documents/${recordId}`)).body
assert.equal(afterSave.documentSource, originalRecord.documentSource)
assert.equal(afterSave.status, originalRecord.status)
// Generic Payload writes must not bypass the dedicated CAS endpoint.
await request(`/api/service-documents/${recordId}`, { method: 'PATCH', body: { translationPlan: { schemaVersion: 1, revision: 88, serviceRevision: plan.serviceRevision, settings } } })
assert.equal((await request(selectedPath)).body.services[0].revision, 1)
const source = structuredClone(serviceCore.parseHeritageServiceDocumentSource(originalRecord.documentSource))
source.project.title = 'Edited disposable service'
source.project.revision++
source.project.updatedAt = new Date().toISOString()
const edit = await request(`/api/service-documents/${recordId}`, { method: 'PATCH', body: { documentSource: serviceCore.serializeHeritageServiceDocument(source) } })
assert.equal(edit.status, 200, JSON.stringify(edit.body))
plan = (await request(selectedPath)).body.services[0]
assert.equal(plan.stale, true)
assert.equal((await request(path, { method: 'PUT', body: { ...write, baseRevision: 1 } })).status, 409)
const reviewed = await request(path, { method: 'PUT', body: { ...write, serviceRevision: plan.serviceRevision, baseRevision: 1 } })
assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body))
assert.equal(reviewed.body.service.stale, false)
assert.equal(reviewed.body.service.revision, 2)
assert.equal((await request(`/api/service-documents/${recordId}`, { method: 'PATCH', body: { status: 'archived' } })).status, 200)
assert.deepEqual((await request(selectedPath)).body.services, [])
assert.equal((await request(path, { method: 'PUT', body: { ...write, serviceRevision: plan.serviceRevision, baseRevision: 2 } })).status, 409)
console.log('Real translation-plan HTTP acceptance passed: authentication, migration, six concurrent writers, protected fields, unchanged slide content, stale review, archival.')
