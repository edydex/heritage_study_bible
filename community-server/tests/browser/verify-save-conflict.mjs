import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {createHash} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import core from '../../packages/service-core/index.js'
import {authoringFixture} from './authoring-fixture.ts'
import {plannerSlides} from '../../src/components/plannerSlides.ts'
import {groupServiceHistory} from '../../src/lib/serviceVersionHistory.ts'
const origin=process.env.CANVAS_TEST_ORIGIN||'http://127.0.0.1:4212',evidence=process.env.EDITING_EVIDENCE||'/private/tmp/heritage-save-conflict-evidence'
await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1512,height:1050}}),errors=[]
page.on('pageerror',error=>errors.push(error.message))
const project={...authoringFixture(),revision:1},hash=source=>createHash('sha256').update(source).digest('hex')
const source=core.serializeHeritageServiceDocument(core.createHeritageServiceDocument(project))
let envelope={syncId:project.id,syncVersion:1,revision:hash(source),documentSource:source,status:'planning',project,changedAt:new Date().toISOString()}
const snapshots=new Map([[1,structuredClone(envelope)]]),acknowledged=new Map(),writes=[],events=[{id:'initial',syncVersion:1,revision:envelope.revision,savedAt:envelope.changedAt,saveKind:'legacy',savedBy:'Pastor'}]
let failFirst=true,releaseFailure=null,raceNextWrite=false
function record(next,saveKind='automatic') {
 const documentSource=core.serializeHeritageServiceDocument(core.createHeritageServiceDocument(next))
 envelope={...envelope,project:next,documentSource,revision:hash(documentSource),syncVersion:envelope.syncVersion+1,changedAt:new Date().toISOString()}
 snapshots.set(envelope.syncVersion,structuredClone(envelope));events.push({id:String(events.length),syncVersion:envelope.syncVersion,revision:envelope.revision,savedAt:envelope.changedAt,saveKind,savedBy:'Other editor'})
}
function remote(words) {const next=structuredClone(envelope.project);next.revision++;next.items['sermon-point-1'].textByChannel.english=`1. ${words}`;record(next)}
await page.route('**/api/community/**',async route=>{
 const url=new URL(route.request().url()),method=route.request().method()
 if(url.pathname.endsWith('/history'))return route.fulfill({json:{groups:groupServiceHistory(events),hasNextPage:false,currentVersion:envelope.syncVersion}})
 const historical=/\/history\/(\d+)$/.exec(url.pathname)
 if(historical)return route.fulfill({json:{serviceDocument:snapshots.get(Number(historical[1]))}})
 if(method==='PUT') {
  const body=route.request().postDataJSON();writes.push(body)
  if(acknowledged.has(body.requestId)){assert.deepEqual(body,acknowledged.get(body.requestId).body);return route.fulfill({json:{serviceDocument:acknowledged.get(body.requestId).envelope}})}
  if(raceNextWrite){raceNextWrite=false;remote('Remote edit raced the chosen base')}
  if(body.baseRevision!==envelope.revision||body.baseSyncVersion!==envelope.syncVersion)return route.fulfill({status:412,json:{error:'This document changed elsewhere'}})
  if(body.documentSource!==envelope.documentSource||body.status!==envelope.status) {record(core.parseHeritageServiceDocumentSource(body.documentSource).project,body.saveKind);envelope.status=body.status}
  const response=structuredClone(envelope);acknowledged.set(body.requestId,{body,envelope:response})
  if(failFirst){failFirst=false;await new Promise(resolve=>releaseFailure=resolve);return route.abort('failed')}
  return route.fulfill({json:{serviceDocument:response}})
 }
 if(url.pathname.includes('/sermon-presentations/')||url.pathname.endsWith(`/service-documents/${project.id}`))return route.fulfill({json:{serviceDocument:envelope}})
 if(url.pathname.endsWith('/library/bible-passage'))return route.fulfill({json:{books:[],translations:[]}})
 return route.fulfill({json:{items:[]}})
})
try {
 await page.goto(`${origin}/community-server/tests/browser/planner.html`)
 const rows=plannerSlides(project,'english'),title=rows.find(row=>row.itemId==='sermon-title'),point=rows.find(row=>row.itemId==='sermon-point-1')
 await page.locator(`[data-slide-id="${title.id}"]`).click()
 await page.locator(`[data-slide-id="${point.id}"]`).click({modifiers:['ControlOrMeta']})
 await page.getByRole('button',{name:'Edit',exact:true}).click()
 const text=page.locator('.heritage-service-planner__editor .heritage-service-planner__stage [data-role="outline-text"]').first()
 await text.fill('Committed but response lost');await text.press('Control+s')
 await expect.poll(()=>writes.length).toBe(1)
 await text.fill('Newest local words survive')
 remote('Remote edited after the lost response')
 releaseFailure()
 await expect(page.getByText(/Saving paused:/).first()).toBeVisible()
 await text.press('Control+s')
 await expect.poll(()=>writes.length).toBe(3)
 assert.equal(writes[0].requestId,writes[1].requestId,'Lost response is retried with exact original request identity')
 await expect(page.getByRole('button',{name:'Review saved version',exact:true})).toBeVisible()
 await expect(text).toHaveText('Newest local words survive')
 await page.getByRole('button',{name:'Review saved version',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Review a save conflict',exact:true})
 await expect(dialog).toBeVisible()
 await expect(dialog.getByLabel('My draft preview')).toContainText('Newest local words survive')
 await expect(dialog.getByLabel('Saved version preview')).toContainText('Remote edited after the lost response')
 await dialog.getByRole('button',{name:'View version history',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Version history',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Restore as new version',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Back to editing',exact:true}).click()
 await page.getByRole('button',{name:'Review saved version',exact:true}).click()
 await expect(dialog.getByLabel('Saved version preview')).toContainText('Remote edited after the lost response')
 remote('Remote changed while reviewing')
 const beforeChoice=writes.length
 await dialog.getByRole('button',{name:'Keep my draft as a new version',exact:true}).click()
 await expect(dialog.getByRole('alert')).toContainText('saved version changed again')
 assert.equal(writes.length,beforeChoice,'A changed review base requires a fresh user choice')
 await expect(dialog.getByLabel('Saved version preview')).toContainText('Remote changed while reviewing')
 raceNextWrite=true
 await dialog.getByRole('button',{name:'Keep my draft as a new version',exact:true}).click()
 await expect(dialog.getByRole('alert')).toContainText('Another save arrived')
 await expect(dialog.getByLabel('My draft preview')).toContainText('Newest local words survive')
 await expect(dialog.getByLabel('Saved version preview')).toContainText('Remote edit raced the chosen base')
 await page.screenshot({path:`${evidence}/compare-after-cas-race.png`})
 await page.evaluate(()=>{document.documentElement.lang='ru'})
 const russianDialog=page.getByRole('dialog',{name:'Сравнить конфликтующие версии',exact:true})
 await expect(russianDialog).toBeVisible()
 await expect(russianDialog.getByRole('alert')).toContainText('Во время сохранения появилась другая версия')
 await expect(russianDialog.getByRole('button',{name:'Сохранить мой черновик как новую версию',exact:true})).toBeEnabled()
 await expect(russianDialog.getByLabel('Просмотр моего черновика')).toContainText('Newest local words survive')
 await page.screenshot({path:`${evidence}/russian-conflict-review.png`})
 await page.evaluate(()=>{document.documentElement.lang='en'})
 await expect(dialog).toBeVisible()
 await dialog.getByRole('button',{name:'Keep my draft as a new version',exact:true}).click()
 await expect(dialog).toHaveCount(0)
 assert.equal(envelope.project.items['sermon-point-1'].textByChannel.english,'1. Newest local words survive')
 assert.equal(writes.at(-1).saveKind,'manual')
 assert.equal(snapshots.get(envelope.syncVersion-1).project.items['sermon-point-1'].textByChannel.english,'1. Remote edit raced the chosen base','Previous remote version remains intact')
 // Explicit discard compares again and does not silently adopt a newer version.
 await text.fill('Local draft chosen for explicit discard')
 remote('Saved version chosen for review')
 await text.press('Control+s')
 await expect(page.getByRole('button',{name:'Review saved version',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Review saved version',exact:true}).click()
 await expect(dialog.getByLabel('Saved version preview')).toContainText('Saved version chosen for review')
 remote('Saved version changed before discard')
 const beforeDiscard=writes.length
 await dialog.getByRole('button',{name:'Use saved version',exact:true}).click()
 await expect(dialog.getByRole('alert')).toContainText('saved version changed again')
 await expect(dialog.getByLabel('My draft preview')).toContainText('Local draft chosen for explicit discard')
 await dialog.getByRole('button',{name:'Use saved version',exact:true}).click()
 await expect(dialog).toHaveCount(0)
 await expect(text).toHaveText('Saved version changed before discard')
 assert.equal(writes.length,beforeDiscard,'Using saved version never rewrites saved history')
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),`heritage-planner-draft:${project.id}`),null)
 await expect(page.getByRole('button',{name:'Review saved version',exact:true})).toHaveCount(0)
 // An uncertain result after a Keep choice retains that new request too.
 await text.fill('Chosen draft with a lost acknowledgement')
 remote('Remote base for another reviewed choice')
 await text.press('Control+s')
 await expect(page.getByRole('button',{name:'Review saved version',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Review saved version',exact:true}).click()
 await expect(dialog.getByLabel('Saved version preview')).toContainText('Remote base for another reviewed choice')
 failFirst=true;releaseFailure=null
 await dialog.getByRole('button',{name:'Keep my draft as a new version',exact:true}).click({noWaitAfter:true})
 await expect.poll(()=>releaseFailure!==null).toBe(true)
 const chosenRequest=writes.at(-1),chosenVersion=envelope.syncVersion
 releaseFailure()
 await expect(dialog).toHaveCount(0)
 await expect(page.getByText(/Saving paused:/).first()).toBeVisible()
 await expect(text).toHaveText('Chosen draft with a lost acknowledgement')
 const beforeRetry=writes.length
 await page.getByRole('button',{name:'Save sermon slides',exact:true}).click()
 await expect.poll(()=>writes.length).toBe(beforeRetry+2)
 assert.equal(writes[beforeRetry].requestId,chosenRequest.requestId,'Uncertain Keep result retains its exact new request for retry')
 assert.equal(envelope.syncVersion,chosenVersion,'Exact retry and unchanged manual checkpoint do not duplicate content')
 await expect(page.locator('.heritage-service-planner__save-state').first()).toContainText('All changes saved')
 assert.deepEqual(errors,[])
 console.log('Online conflict review passed: lost-response retry, newest local draft, read-only history, reviewed-base refresh, CAS race, keep as new version and explicit discard')
} finally {await browser.close()}
