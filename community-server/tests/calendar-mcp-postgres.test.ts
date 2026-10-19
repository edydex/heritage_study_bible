import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { Pool } from 'pg'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'
import { buildConfig, getPayload, createLocalReq, handleEndpoints, type PayloadRequest } from 'payload'
import { calendarMcpEndpoints } from '../src/endpoints/calendarMcp.ts'
import { Events } from '../src/collections/Events.ts'
import { Memberships } from '../src/collections/Memberships.ts'
import { up as migrate, down as rollback } from '../src/migrations/20261005_120000_calendar_mcp.ts'
import { authorize, connections, oauthHandler, token, revoke } from '../src/lib/calendarMcp/oauth.ts'
import { handleMcp } from '../src/lib/calendarMcp/mcp.ts'
import { createOAuth } from '../src/lib/calendarMcp/oauthModel.ts'
import { createEvent, updateEvent } from '../src/lib/calendarMcp/store.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'
const databaseUrl = process.env.CALENDAR_MCP_TEST_DATABASE_URL
const origin = 'http://localhost:3000', resource = `${origin}/api/community/calendar/mcp`, callback = 'https://chatgpt.com/connector_platform_oauth_redirect'
const fixtureEvent = { title:'Test church worship', startsAt:'2026-10-04T10:00:00-07:00', endsAt:'2026-10-04T11:00:00-07:00', timeZone:'America/Los_Angeles' }
test('real Postgres/Payload OAuth, MCP and calendar concurrency', { skip:!databaseUrl, timeout:120_000 }, async t => {
  assertDisposableLiveDatabase({ databaseUrl, expectedDatabase:'heritage_calendar_mcp_test', expectedMarker:'heritage-calendar-mcp-test-v1', variableName:'CALENDAR_MCP_TEST_DATABASE_URL' })
  process.env.COMMUNITY_CALENDAR_MCP_ENABLED = 'true'; process.env.COMMUNITY_PUBLIC_URL = origin
  process.env.COMMUNITY_CALENDAR_MCP_CLIENT_ID = 'test-calendar'; process.env.COMMUNITY_CALENDAR_MCP_REDIRECT_URI = callback
  const pool = new Pool({ connectionString:databaseUrl })
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  const config = buildConfig({ secret:'disposable-calendar-test-secret-with-no-production-access', serverURL:origin, telemetry:false,
    db:postgresAdapter({ pool:{ connectionString:databaseUrl },push:true }),
    collections:[{ slug:'users',auth:true,fields:[{ name:'systemRole',type:'text' }] },
      { slug:'communities',fields:[{ name:'name',type:'text',required:true },{ name:'slug',type:'text',required:true },{ name:'timeZone',type:'text',required:true },{ name:'calendarDefaultVisibility',type:'text' }] },Memberships,Events],
    endpoints: calendarMcpEndpoints, typescript:{ autoGenerate:false },
  })
  // This intentionally minimal fixture schema differs from generated full-app
  // collection types; runtime operations use the actual Payload adapter.
  const payload: any = await getPayload({ config })
  const db = (payload.db as any).drizzle
  try {
    // Payload's disposable schema push already added the field; test the production migration from the prior schema.
    await db.execute(sql`ALTER TABLE events DROP COLUMN calendar_version`)
    await migrate({ db } as never)
    const church = await payload.create({ collection:'communities',data:{ name:'Fixture church',slug:'local-church',timeZone:'America/Los_Angeles',calendarDefaultVisibility:'members' } })
    const other = await payload.create({ collection:'communities',data:{ name:'Other church',slug:'another-church',timeZone:'UTC' } })
    const user = await payload.create({ collection:'users',data:{ email:'calendar-manager@example.invalid',password:'disposable-local-only-test-password',systemRole:'system-admin' } })
    const membership = await payload.create({ collection:'memberships',data:{ user:user.id,community:church.id,role:'leader' } })
    const member = await payload.create({ collection:'users',data:{ email:'calendar-member@example.invalid',password:'disposable-member-test-password' } })
    await payload.create({ collection:'memberships',data:{ user:member.id,community:church.id,role:'member' } })
    const otherEvent = await payload.create({ collection:'events',data:{ ...fixtureEvent,title:'Other church private event',community:other.id } })
    const managerLogin = await payload.login({ collection:'users',data:{ email:user.email,password:'disposable-local-only-test-password' } })
    const memberLogin = await payload.login({ collection:'users',data:{ email:member.email,password:'disposable-member-test-password' } })
    async function request(path: string, method='GET', body?: unknown, authorization='', headers:Record<string,string>={}) {
      const incoming = new Request(`${origin}${path}`, { method, headers:{ ...(authorization ? { authorization } : {}), ...(body ? { 'Content-Type':typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json' } : {}), ...headers },
        ...(body ? { body:typeof body === 'string' ? body : JSON.stringify(body) } : {}) })
      const local = await createLocalReq({},payload)
      return Object.assign(incoming, { payload, context:local.context, i18n:local.i18n, t:local.t, routeParams:{}, transactionID:undefined }) as PayloadRequest
    }
    let stateCounter = 0
    async function consent(scopes='calendar:read calendar:create calendar:update', login=managerLogin.token!, approved?:string[]) {
      const verifier = `test-verifier-${String(++stateCounter).padStart(4,'0')}-`+'x'.repeat(43)
      const params = new URLSearchParams({ client_id:'test-calendar',redirect_uri:callback,resource,response_type:'code',scope:scopes,state:`state-${stateCounter}`,
        code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256' })
      const page = await oauthHandler(await request(`/api/community/calendar/oauth/authorize?${params}`, 'GET',undefined,`JWT ${login}`),authorize)
      if (page.status !== 200) return { page, code:'', verifier, redirect:page, nonce:'' }
      const html = await page.text()
      const nonce = /name="nonce" value="([^"]+)"/.exec(html)?.[1] || ''
      if (!nonce) return { page, code:'', verifier, redirect:page, nonce:'' }
      const body = new URLSearchParams({ nonce,decision:'approve' })
      for (const scope of approved || scopes.split(' ')) body.append('scope',scope)
      const redirected = await oauthHandler(await request('/api/community/calendar/oauth/authorize','POST',body.toString(),`JWT ${login}`,{ origin }),authorize)
      const location = redirected.headers.get('location')
      if (!location) assert.fail(await redirected.text())
      assert.equal(new URL(location).searchParams.get('iss'),origin)
      return { page, code:new URL(location).searchParams.get('code')!,verifier,redirect:redirected,nonce }
    }
    async function exchange(code:string, verifier:string, extra:Record<string,string>={}) {
      const body = new URLSearchParams({ grant_type:'authorization_code',client_id:'test-calendar',resource,redirect_uri:callback,code,code_verifier:verifier,...extra })
      return oauthHandler(await request('/api/community/calendar/oauth/token','POST',body.toString()),token)
    }
    let credentials:any, readOnly:any, authority:any, mainEvent:any
    async function rpc(accessToken:string, message:any, extraHeaders:Record<string,string>={}) {
      return handleMcp(await request('/api/community/calendar/mcp','POST',message,`Bearer ${accessToken}`,{ accept:'application/json, text/event-stream',...extraHeaders }))
    }
    async function call(name:string,args:any, accessToken=credentials.access_token) {
      const result = await rpc(accessToken,{ jsonrpc:'2.0',id:1,method:'tools/call',params:{ name,arguments:args } })
      assert.equal(result.status,200,await result.clone().text())
      return (await result.json()).result
    }
    await t.test('manager approves a church-bound grant with explicit permissions and hashed tokens',async () => {
      const granted = await consent()
      const response = await exchange(granted.code,granted.verifier)
      assert.equal(response.status,200,await response.clone().text())
      credentials = await response.json()
      assert.equal(credentials.resource,resource); assert.equal(credentials.token_type,'Bearer')
      assert.ok(credentials.expires_in <= 600); assert.ok(credentials.refresh_token)
      const stored = await pool.query('SELECT * FROM calendar_mcp_tokens')
      assert.equal(stored.rows.length,1)
      assert.equal(JSON.stringify(stored.rows).includes(credentials.access_token),false)
      assert.equal(JSON.stringify(stored.rows).includes(credentials.refresh_token),false)
      const grant = (await pool.query('SELECT * FROM calendar_mcp_grants')).rows[0]
      assert.equal(grant.community_id,church.id); assert.equal(grant.user_id,user.id)
      assert.equal(Math.round((new Date(grant.expires_at).getTime()-new Date(grant.created_at).getTime())/86400000),30)
      authority = (await createOAuth(await request('/')).options.model.getAccessToken!(credentials.access_token) as any).authority
    })
    await t.test('PKCE, code replay, foreign audience and callback substitution fail',async () => {
      const granted = await consent()
      assert.equal((await exchange(granted.code,'y'.repeat(43))).status,400)
      assert.equal((await exchange(granted.code,granted.verifier)).status,400)
      const foreign = await consent()
      assert.equal((await exchange(foreign.code,foreign.verifier,{ resource:'https://foreign.church/mcp' })).status,400)
      assert.equal((await exchange(foreign.code,foreign.verifier,{ redirect_uri:'https://attacker.invalid/callback' })).status,400)
      assert.equal((await exchange(foreign.code,foreign.verifier)).status,400)
      const fresh = await consent()
      const responses = await Promise.all([exchange(fresh.code,fresh.verifier),exchange(fresh.code,fresh.verifier)])
      assert.deepEqual(responses.map(r=>r.status).sort(),[200,400])
    })
    await t.test('members cannot approve grants; consent nonce is one-use and Origin is enforced',async () => {
      const memberAttempt = await consent('calendar:read',memberLogin.token!)
      assert.equal(memberAttempt.code,''); assert.equal(memberAttempt.nonce,'')
      const granted = await consent('calendar:read')
      const body = new URLSearchParams({nonce:granted.nonce,decision:'approve',scope:'calendar:read'}).toString()
      assert.equal((await oauthHandler(await request('/api/community/calendar/oauth/authorize','POST',body,`JWT ${managerLogin.token}`,{origin}),authorize)).status,409)
      const fresh = await consent('calendar:read')
      assert.equal((await oauthHandler(await request('/api/community/calendar/oauth/authorize','POST',new URLSearchParams({nonce:fresh.nonce,decision:'approve',scope:'calendar:read'}).toString(),`JWT ${managerLogin.token}`),authorize)).status,403)
    })
    await t.test('MCP initializes and lists only three tools; cookies, SyncShow auth and browser origins cannot authorize MCP',async () => {
      const init = await rpc(credentials.access_token,{ jsonrpc:'2.0',id:1,method:'initialize',params:{ protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test-client',version:'1'} } })
      assert.equal(init.status,200); assert.equal((await init.json()).result.serverInfo.name,'heritage-church-calendar')
      const list = await rpc(credentials.access_token,{ jsonrpc:'2.0',id:2,method:'tools/list',params:{} })
      assert.deepEqual((await list.json()).result.tools.map((tool:any)=>tool.name),['church_calendar_read','church_calendar_create','church_calendar_update'])
      const bare = await handleMcp(await request('/api/community/calendar/mcp','POST',{ jsonrpc:'2.0',id:1,method:'tools/list' },'',{cookie:`payload-token=${managerLogin.token}`,accept:'application/json, text/event-stream'}))
      assert.equal(bare.status,401); assert.match(bare.headers.get('www-authenticate')!,/resource_metadata/)
      assert.equal((await rpc('not-a-calendar-token',{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401)
      assert.equal((await rpc(credentials.access_token,{jsonrpc:'2.0',id:1,method:'tools/list'},{origin:'https://attacker.invalid'})).status,403)
      assert.equal((await handleMcp(await request('/api/community/calendar/mcp','DELETE',undefined,`Bearer ${credentials.access_token}`))).status,405)
    })
    await t.test('Payload REST dispatch preserves OAuth challenge and handles MCP protocol',async () => {
      const input = {jsonrpc:'2.0',id:5,method:'tools/list',params:{}}
      const headers = {'Content-Type':'application/json',accept:'application/json, text/event-stream',authorization:`Bearer ${credentials.access_token}`}
      const response = await handleEndpoints({config,request:new Request(resource,{method:'POST',headers,body:JSON.stringify(input)})})
      assert.equal(response.status,200,await response.clone().text())
      assert.equal((await response.json()).result.tools.length,3)
      const denied = await handleEndpoints({config,request:new Request(resource,{method:'POST',headers:{'Content-Type':'application/json',accept:headers.accept},body:JSON.stringify(input)})})
      assert.equal(denied.status,401); assert.match(denied.headers.get('www-authenticate')!,/resource_metadata/)
    })
    await t.test('create defaults to church visibility and concurrent retries create exactly one row',async () => {
      const input = { requestId:'worship-2026-10-04',source:'church-approved-calendar',sourceId:'worship-2026-10-04',event:fixtureEvent }
      const replies = await Promise.all([call('church_calendar_create',input),call('church_calendar_create',input)])
      assert.ok(replies.every(reply=>!reply.isError),JSON.stringify(replies))
      mainEvent = replies[0].structuredContent.event
      assert.equal(mainEvent.version,'1'); assert.equal(mainEvent.visibility,'inherit')
      assert.equal((await pool.query('SELECT * FROM events WHERE community_id=$1',[church.id])).rowCount,1)
      const duplicate = await call('church_calendar_create',{ ...input,requestId:'same-source-new-request' })
      assert.equal(duplicate.structuredContent.created,false)
      const changed = await call('church_calendar_create',{ ...input,event:{ ...fixtureEvent,title:'Changed event' } })
      assert.equal(changed.structuredContent.error,'IDEMPOTENCY_CONFLICT')
      const sourceConflict = await call('church_calendar_create',{ ...input,requestId:'conflicting-source',event:{ ...fixtureEvent,title:'Different event' } })
      assert.equal(sourceConflict.structuredContent.error,'SOURCE_CONFLICT')
    })
    await t.test('reads expose only bound church events and current versions',async () => {
      const result = await call('church_calendar_read',{from:'2026-10-01',to:'2026-10-31'})
      assert.equal(result.structuredContent.events.length,1)
      assert.equal(result.structuredContent.events[0].id,mainEvent.id)
      assert.equal(result.structuredContent.defaultVisibility,'members')
      assert.equal(JSON.stringify(result).includes('Other church private event'),false)
      const foreign = await call('church_calendar_update',{requestId:'cross-church',eventId:otherEvent.id,expectedVersion:'1',changes:{title:'Attempted edit'}})
      assert.equal(foreign.structuredContent.error,'NOT_FOUND')
    })
    await t.test('human edits increment versions; stale edits fail; simultaneous matching updates have one winner',async () => {
      await payload.update({collection:'events',id:mainEvent.id,data:{title:'Human reviewed title'}})
      const stale = await call('church_calendar_update',{requestId:'stale-edit',eventId:mainEvent.id,expectedVersion:'1',changes:{title:'Stale assistant title'}})
      assert.equal(stale.structuredContent.status,412)
      const read = await call('church_calendar_read',{from:'2026-10-01',to:'2026-10-31'})
      const current = read.structuredContent.events[0]
      assert.equal(current.title,'Human reviewed title'); assert.equal(current.version,'2')
      const updates = await Promise.all(['a','b'].map(suffix=>call('church_calendar_update',{requestId:`concurrent-update-${suffix}`,eventId:mainEvent.id,expectedVersion:'2',changes:{description:`Approved ${suffix}`}})))
      assert.equal(updates.filter(update=>!update.isError).length,1)
      assert.equal(updates.filter(update=>update.structuredContent.error==='VERSION_CONFLICT').length,1)
      const winning = updates.find(update=>!update.isError).structuredContent.event
      assert.equal(winning.version,'3')
      const suffix = winning.description.slice(-1)
      const retry = await call('church_calendar_update',{requestId:`concurrent-update-${suffix}`,eventId:mainEvent.id,expectedVersion:'2',changes:{description:`Approved ${suffix}`}})
      assert.equal(retry.structuredContent.replayed,true)
      assert.equal((await pool.query('SELECT calendar_version FROM events WHERE id=$1',[mainEvent.id])).rows[0].calendar_version,'3')
    })
    await t.test('recurring human events preserve Pacific wall time across DST and series settings during edits',async () => {
      const recurring = await payload.create({collection:'events',data:{...fixtureEvent,title:'Weekly service',community:church.id,startsAt:'2026-10-25T10:00:00-07:00',endsAt:'2026-10-25T11:00:00-07:00',recurrence:'weekly',repeatInterval:1}})
      const read = await call('church_calendar_read',{from:'2026-10-25',to:'2026-11-08'})
      const series = read.structuredContent.events.find((event:any)=>event.id === recurring.id)
      assert.deepEqual(series.occurrences.map((event:any)=>event.startsAt),['2026-10-25T17:00:00.000Z','2026-11-01T18:00:00.000Z','2026-11-08T18:00:00.000Z'])
      const edited = await call('church_calendar_update',{requestId:'recurring-title',eventId:recurring.id,expectedVersion:series.version,changes:{title:'Weekly church service'}})
      assert.equal(edited.structuredContent.event.recurrence,'weekly')
      await payload.delete({collection:'events',id:recurring.id})
    })
    await t.test('stored token audience/client and expired access/grants are enforced',async () => {
      const grantId = authority.grantId
      await pool.query("UPDATE calendar_mcp_grants SET resource='https://other.example/calendar' WHERE id=$1",[grantId])
      assert.equal((await rpc(credentials.access_token,{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401)
      await pool.query('UPDATE calendar_mcp_grants SET resource=$1,client_id=$2 WHERE id=$3',[resource,'foreign-client',grantId])
      assert.equal((await rpc(credentials.access_token,{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401)
      await pool.query('UPDATE calendar_mcp_grants SET client_id=$1 WHERE id=$2',['test-calendar',grantId])
      const granted = await consent('calendar:read')
      const temporary = await (await exchange(granted.code,granted.verifier)).json()
      const hash = createHash('sha256').update(temporary.access_token).digest('hex')
      await pool.query("UPDATE calendar_mcp_tokens SET access_expires_at=now()-interval '1 second' WHERE access_hash=$1",[hash])
      assert.equal((await rpc(temporary.access_token,{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401)
      await pool.query("UPDATE calendar_mcp_grants SET expires_at=now()-interval '1 second' WHERE id IN (SELECT grant_id FROM calendar_mcp_tokens WHERE access_hash=$1)",[hash])
      const refresh = new URLSearchParams({grant_type:'refresh_token',client_id:'test-calendar',resource,refresh_token:temporary.refresh_token})
      assert.equal((await oauthHandler(await request('/api/community/calendar/oauth/token','POST',refresh.toString()),token)).status,400)
    })
    await t.test('read-only consent omits write scopes and denies writes',async () => {
      const granted = await consent('calendar:read calendar:create calendar:update',managerLogin.token!,['calendar:read'])
      const response = await exchange(granted.code,granted.verifier)
      readOnly = await response.json(); assert.equal(readOnly.scope,'calendar:read')
      const denied = await call('church_calendar_create',{requestId:'read-only-denied',source:'test',sourceId:'denied',event:fixtureEvent},readOnly.access_token)
      assert.equal(denied.isError,true); assert.equal(denied.structuredContent.error,'INSUFFICIENT_SCOPE')
    })
    await t.test('audit failures roll back calendar changes and idempotency receipts',async () => {
      await pool.query("CREATE FUNCTION fail_calendar_create_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'create' THEN RAISE EXCEPTION 'test-audit-failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fail_calendar_create_audit BEFORE INSERT ON calendar_mcp_audit FOR EACH ROW EXECUTE FUNCTION fail_calendar_create_audit()")
      await assert.rejects(createEvent(await request('/'),authority,{requestId:'audit-rollback',source:'test',sourceId:'audit-rollback',event:fixtureEvent}),(error:any) => error.cause?.message === 'test-audit-failure')
      assert.equal((await pool.query("SELECT * FROM calendar_mcp_mutations WHERE request_id='audit-rollback'")).rowCount,0)
      assert.equal((await pool.query('SELECT * FROM events WHERE community_id=$1',[church.id])).rowCount,1)
      await pool.query('DROP TRIGGER fail_calendar_create_audit ON calendar_mcp_audit; DROP FUNCTION fail_calendar_create_audit()')
    })
    await t.test('refresh rotates tokens, reuse revokes grant, and expiry cannot be extended',async () => {
      const body = (refresh:string) => new URLSearchParams({grant_type:'refresh_token',client_id:'test-calendar',resource,refresh_token:refresh}).toString()
      const old = readOnly
      const response = await oauthHandler(await request('/api/community/calendar/oauth/token','POST',body(old.refresh_token)),token)
      assert.equal(response.status,200,await response.clone().text())
      const next = await response.json(); assert.notEqual(next.refresh_token,old.refresh_token)
      assert.equal((await rpc(old.access_token,{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401)
      assert.equal((await oauthHandler(await request('/api/community/calendar/oauth/token','POST',body(old.refresh_token)),token)).status,400)
      assert.equal((await rpc(next.access_token,{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401)
      const expiry = (await pool.query('SELECT DISTINCT refresh_expires_at FROM calendar_mcp_tokens WHERE grant_id=(SELECT grant_id FROM calendar_mcp_tokens WHERE refresh_hash=$1)',[createHash('sha256').update(old.refresh_token).digest('hex')])).rows
      assert.equal(expiry.length,1)
    })
    await t.test('membership demotion immediately blocks existing access and refresh',async () => {
      await payload.update({collection:'memberships',id:membership.id,data:{role:'member'}})
      assert.equal((await rpc(credentials.access_token,{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401)
      const refreshBody = new URLSearchParams({grant_type:'refresh_token',client_id:'test-calendar',resource,refresh_token:credentials.refresh_token}).toString()
      assert.equal((await oauthHandler(await request('/api/community/calendar/oauth/token','POST',refreshBody),token)).status,400)
      await assert.rejects(updateEvent(await request('/'),authority,{requestId:'demoted',eventId:mainEvent.id,expectedVersion:'3',changes:{title:'Forbidden'}}),/expired|revoked|permission/)
      await payload.update({collection:'memberships',id:membership.id,data:{role:'leader'}})
    })
    await t.test('manager revocation requires same origin and terminates existing tokens',async () => {
      const grant = (await pool.query('SELECT grant_id FROM calendar_mcp_tokens WHERE access_hash=$1',[createHash('sha256').update(credentials.access_token).digest('hex')])).rows[0]
      const body = new URLSearchParams({grantId:grant.grant_id}).toString()
      assert.equal((await oauthHandler(await request('/api/community/calendar/oauth/connections','POST',body,`JWT ${managerLogin.token}`),connections)).status,403)
      assert.equal((await oauthHandler(await request('/api/community/calendar/oauth/connections','POST',body,`JWT ${managerLogin.token}`,{origin}),connections)).status,200)
      assert.equal((await rpc(credentials.access_token,{jsonrpc:'2.0',id:1,method:'tools/list'})).status,401)
      const unknown = new URLSearchParams({client_id:'test-calendar',token:'unknown-token'}).toString()
      assert.equal((await oauthHandler(await request('/api/community/calendar/oauth/revoke','POST',unknown),revoke)).status,200)
    })
    await t.test('audit is immutable and migration rolls back cleanly',async () => {
      const records = (await pool.query('SELECT * FROM calendar_mcp_audit ORDER BY id')).rows
      assert.ok(records.some(row=>row.action==='create')); assert.ok(records.some(row=>row.action==='update'))
      assert.ok(records.some(row=>row.action==='manager-revoked'))
      assert.equal(JSON.stringify(records).includes(credentials.access_token),false)
      await assert.rejects(pool.query("UPDATE calendar_mcp_audit SET action='tampered'"),/immutable/)
      await assert.rejects(pool.query('DELETE FROM calendar_mcp_audit'),/immutable/)
      await rollback({db} as never)
      assert.equal((await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='events' AND column_name='calendar_version'")).rowCount,0)
    })
  } finally { await payload.destroy(); await pool.end() }
})
