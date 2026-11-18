import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { getPayload, createLocalReq } from 'payload'
import config from '../src/payload.config.ts'
import { migrations } from '../src/migrations/index.ts'
import { createEvent, readEvents, updateEvent } from '../src/lib/calendarMcp/store.ts'
import { hashToken } from '../src/lib/calendarMcp/oauthModel.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'
const url = process.env.CALENDAR_MCP_MIGRATION_TEST_DATABASE_URL
test('complete deployment migration history and full Payload calendar integration', { skip:!url,timeout:120_000 },async () => {
  assertDisposableLiveDatabase({databaseUrl:url,expectedDatabase:'heritage_calendar_mcp_deployment_test',expectedMarker:'heritage-calendar-mcp-migration-test-v1',variableName:'CALENDAR_MCP_MIGRATION_TEST_DATABASE_URL'})
  const pool = new Pool({connectionString:url}), db = drizzle(pool)
  let payload:any
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
    const baselineNames = ['20261001_220000_people_language','20261001_230000_service_save_history','20261002_000000_retire_song_member_sharing','20261002_010000_workspace_activity']
    for (const name of baselineNames) assert.ok(migrations.some(migration=>migration.name === name),name)
    assert.equal(migrations.at(-1)?.name,'20261005_120000_calendar_mcp')
    for (const migration of migrations) {
      await migration.up({db} as never)
      process.stdout.write(`# applied ${migration.name}\n`)
    }
    assert.equal((await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('service_document_saves','workspace_activity','calendar_mcp_grants')")).rowCount,3)
    assert.equal((await pool.query("SELECT conname FROM pg_constraint WHERE conname='songs_retired_member_visibility_check'")).rowCount,1)
    assert.equal((await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name='song_member_sharing_retirement_backup'")).rowCount,1)
    const resolved = await config
    resolved.db = postgresAdapter({pool:{connectionString:url},push:false}) as typeof resolved.db
    resolved.typescript.autoGenerate = false
    payload = await getPayload({config})
    const church = await payload.create({collection:'communities',overrideAccess:true,data:{name:'Disposable full church',slug:'local-church',timeZone:'America/Los_Angeles',joinPolicy:'invite',calendarDefaultVisibility:'members'}})
    const manager = await payload.create({collection:'users',overrideAccess:true,data:{displayName:'Disposable manager',email:'full-calendar-manager@example.invalid',password:'disposable-local-test-password',systemRole:'system-admin',accountProtection:'email',syncGeneration:1}})
    await payload.create({collection:'memberships',overrideAccess:true,data:{community:church.id,user:manager.id,role:'leader',joinedAt:new Date().toISOString()}})
    const grantId=randomUUID(), token='hca_'+'a'.repeat(43),resource='http://localhost:3000/api/community/calendar/mcp'
    await pool.query("INSERT INTO calendar_mcp_grants(id,community_id,user_id,client_id,resource,scopes,expires_at) VALUES($1,$2,$3,$4,$5,ARRAY['calendar:read','calendar:create','calendar:update'],now()+interval '30 days')",[grantId,church.id,manager.id,'test-calendar',resource])
    await pool.query("INSERT INTO calendar_mcp_tokens(access_hash,refresh_hash,grant_id,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,now()+interval '10 minutes',now()+interval '30 days')",[hashToken(token),hashToken('disposable-refresh'),grantId])
    const authority={grantId,tokenHash:hashToken(token),communityId:church.id,userId:manager.id,clientId:'test-calendar',scopes:['calendar:read','calendar:create','calendar:update'],resource}
    const request=()=>createLocalReq({},payload)
    const result=await createEvent(await request(),authority,{requestId:'full-calendar-create',source:'test',sourceId:'full-calendar-source',event:{title:'Full deployment fixture',startsAt:'2026-10-04T10:00:00-07:00',timeZone:'America/Los_Angeles'}})
    assert.equal(result.event.version,'1')
    await payload.update({collection:'events',id:result.event.id,data:{title:'Full human edit'},overrideAccess:true})
    await assert.rejects(updateEvent(await request(),authority,{requestId:'full-stale',eventId:result.event.id,expectedVersion:'1',changes:{description:'stale'}}),/changed this event/)
    const current=await readEvents(await request(),authority,{from:'2026-10-01',to:'2026-10-31'})
    assert.equal(current.events[0].title,'Full human edit');assert.equal(current.events[0].version,'2')
  } finally { if (payload) await payload.destroy(); await pool.end() }
})
