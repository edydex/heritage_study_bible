import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import core from '../../packages/service-core/index.js'
import {authoringFixture} from './authoring-fixture.ts'
const origin=process.env.BUILT_EDITOR_ORIGIN || 'http://127.0.0.1:4280'
if(new URL(origin).hostname!=='127.0.0.1')throw new Error('Built-editor rehearsal must use disposable loopback app')
const evidence=process.env.EDITING_EVIDENCE || '/private/tmp/heritage-editing-evidence'
await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1512,height:1050}}),page=await context.newPage(),errors=[]
page.on('pageerror',error=>errors.push(error.message))
const login=await context.request.post(`${origin}/api/users/login`,{data:{email:'editor@example.test',password:'Disposable-editor-only-20261001'}})
assert.equal(login.status(),200)
const token=(await login.json()).token
await context.setExtraHTTPHeaders({Authorization:`JWT ${token}`})
const syncId=`rehearsal-${randomUUID()}`
const create=await context.request.post(`${origin}/api/community/service-documents`,{data:{schemaVersion:1,requestId:randomUUID(),syncId,title:'Built editor rehearsal',serviceDate:'2026-10-04'}})
assert.equal(create.status(),200,await create.text())
const envelope=(await create.json()).serviceDocument
const project={...authoringFixture(),id:syncId,revision:2,title:'Built editor rehearsal'}
const update=await context.request.put(`${origin}/api/community/service-documents/${syncId}`,{data:{schemaVersion:1,requestId:randomUUID(),syncId,baseSyncVersion:envelope.syncVersion,baseRevision:envelope.revision,documentSource:core.serializeHeritageServiceDocument(core.createHeritageServiceDocument(project)),status:'planning',saveKind:'manual'}})
assert.equal(update.status(),200,await update.text())
await page.goto(`${origin}/admin/plan-service`)
await page.getByLabel('Current service').selectOption(syncId)
await expect(page.locator('.heritage-service-planner__save-state').first()).toContainText('29 slides')
await expect(page.locator('[data-slide-id]')).toHaveCount(5)
await page.screenshot({path:`${evidence}/built-editor.png`})
await page.getByRole('button',{name:'Save service',exact:true}).click({button:'right'})
await expect(page.getByRole('dialog',{name:'Version history',exact:true})).toBeVisible()
await expect(page.getByRole('button',{name:/Manual save/})).toBeVisible()
await expect(page.locator('.heritage-version-history__preview [data-role=title]')).toContainText('Поём вместе')
await page.screenshot({path:`${evidence}/built-version-history.png`})
assert.deepEqual(errors,[])
await browser.close();console.log('Built editor, migrated database, login, canonical save and version preview passed')
