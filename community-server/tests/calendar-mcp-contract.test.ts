import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeEvent, createInput, updateInput, validateRange, digest } from '../src/lib/calendarMcp/contract.ts'
import { selectedScopes, authorizationMetadata, resourceMetadata, boundedText } from '../src/lib/calendarMcp/config.ts'
import { validateAuthorization } from '../src/lib/calendarMcp/oauth.ts'
const event = { title:'Sunday worship', startsAt:'2026-10-04T10:00:00-07:00', timeZone:'America/Los_Angeles' }
test('Pacific offset is explicit and canonical UTC respects DST', () => {
  assert.equal(normalizeEvent(event).startsAt,'2026-10-04T17:00:00Z')
  assert.equal(normalizeEvent({ ...event, startsAt:'2026-12-06T10:00:00-08:00' }).startsAt,'2026-12-06T18:00:00Z')
  assert.throws(() => normalizeEvent({ ...event, startsAt:'2026-10-04T10:00:00' }))
  assert.throws(() => normalizeEvent({ ...event, startsAt:'2026-10-04T10:00:00-08:00' }))
})
test('DST gap is rejected and overlap has two explicit valid offsets', () => {
  assert.throws(() => normalizeEvent({ ...event, startsAt:'2026-03-08T02:30:00-08:00' }))
  assert.throws(() => normalizeEvent({ ...event, startsAt:'2026-03-08T02:30:00-07:00' }))
  assert.equal(normalizeEvent({ ...event, startsAt:'2026-11-01T01:30:00-07:00' }).startsAt,'2026-11-01T08:30:00Z')
  assert.equal(normalizeEvent({ ...event, startsAt:'2026-11-01T01:30:00-08:00' }).startsAt,'2026-11-01T09:30:00Z')
})
test('reject invalid zones, dates, backwards/long events and unsafe links', () => {
  for (const patch of [{ timeZone:'PST' }, { timeZone:'Fake/Zone' }, { startsAt:'2026-02-30T10:00:00-08:00' },
    { endsAt:'2026-10-04T09:00:00-07:00' }, { endsAt:'2028-10-04T10:00:00-07:00' }, { url:'javascript:alert(1)' }]) {
    assert.throws(() => normalizeEvent({ ...event, ...patch }))
  }
  assert.equal(normalizeEvent(event).visibility,'inherit')
})
test('tool inputs exclude community, settings, users, deletion, source changes, cancellation, and recurrence changes', () => {
  assert.throws(() => createInput.parse({ requestId:'r1', source:'church-site', sourceId:'abc', event:{ ...event, community:999 } }))
  for (const field of ['community','cancelled','recurrence','source','sourceId','calendarVersion']) {
    assert.throws(() => updateInput.parse({ requestId:'r1', eventId:1, expectedVersion:'1', changes:{ [field]:'x' } }))
  }
  assert.throws(() => updateInput.parse({ requestId:'r1', eventId:1, changes:{ title:'x' } }))
  assert.throws(() => updateInput.parse({ requestId:'r1', eventId:1, expectedVersion:'1', changes:{} }))
})
test('range bounds and request hashes are stable', () => {
  validateRange('2026-10-01','2026-12-02')
  assert.throws(() => validateRange('2026-10-01','2026-12-03'))
  assert.throws(() => validateRange('2026-02-30','2026-03-01'))
  assert.throws(() => validateRange('2026-10-05','2026-10-04'))
  assert.equal(digest({b:2,a:{c:3}}),digest({a:{c:3},b:2}))
})
test('only narrow calendar scopes including read are accepted', () => {
  assert.deepEqual(selectedScopes('calendar:update calendar:read'),['calendar:read','calendar:update'])
  for (const value of ['', 'admin', 'calendar:delete', 'calendar:create', 'calendar:read calendar:read', 'calendar:read users:read']) assert.throws(() => selectedScopes(value))
})
test('discovery and authorization enforce resource, exact callback, state and S256 PKCE', () => {
  process.env.COMMUNITY_CALENDAR_MCP_ENABLED = 'true'
  process.env.COMMUNITY_PUBLIC_URL = 'http://localhost:3000'
  process.env.COMMUNITY_CALENDAR_MCP_CLIENT_ID = 'test-calendar'
  process.env.COMMUNITY_CALENDAR_MCP_REDIRECT_URI = 'https://chatgpt.com/connector_platform_oauth_redirect'
  const params = new URLSearchParams({ client_id:'test-calendar',redirect_uri:process.env.COMMUNITY_CALENDAR_MCP_REDIRECT_URI,
    resource:'http://localhost:3000/api/community/calendar/mcp',response_type:'code',scope:'calendar:read',state:'test-state',code_challenge:'A'.repeat(43),code_challenge_method:'S256' })
  validateAuthorization(params)
  assert.equal(authorizationMetadata().authorization_response_iss_parameter_supported,true)
  assert.deepEqual(authorizationMetadata().token_endpoint_auth_methods_supported,['none'])
  assert.deepEqual(authorizationMetadata().grant_types_supported,['authorization_code','refresh_token'])
  assert.equal(resourceMetadata().resource,params.get('resource'))
  for (const [field, value] of [['resource','https://other.church'],['redirect_uri','https://attacker.example/callback'],['code_challenge_method','plain'],['state',''],['scope','calendar:read users:read']]) {
    const invalid = new URLSearchParams(params); invalid.set(field,value)
    assert.throws(() => validateAuthorization(invalid))
  }
  const duplicate = new URLSearchParams(params); duplicate.append('client_id','test-calendar')
  assert.throws(() => validateAuthorization(duplicate))
})

test('request body limits reject oversized bodies and malformed UTF-8', async () => {
  assert.equal(await boundedText(new Request('http://localhost',{method:'POST',body:'hello'}),5),'hello')
  await assert.rejects(boundedText(new Request('http://localhost',{method:'POST',body:'too large'}),5),/too large/)
  await assert.rejects(boundedText(new Request('http://localhost',{method:'POST',body:new Uint8Array([255])}),5),/UTF-8/)
})
