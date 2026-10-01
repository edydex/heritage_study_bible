import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import core from '../../packages/service-core/index.js'
import {authoringFixture} from './authoring-fixture.ts'
import {groupServiceHistory} from '../../src/lib/serviceVersionHistory.ts'
import {plannerSlides} from '../../src/components/plannerSlides.ts'
const evidence=process.env.EDITING_EVIDENCE || '/private/tmp/heritage-editing-evidence'
await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1512,height:1050}}),errors=[]
page.on('pageerror',e=>errors.push(e.message))
let project={...authoringFixture(),revision:1}, source=core.serializeHeritageServiceDocument(core.createHeritageServiceDocument(project))
let envelope={syncId:project.id,syncVersion:1,revision:createHash('sha256').update(source).digest('hex'),documentSource:source,status:'planning',project,changedAt:new Date().toISOString()}
const snapshots=new Map([[1,structuredClone(envelope)]]),events=[{id:'legacy-1',syncVersion:1,revision:envelope.revision,savedAt:envelope.changedAt,saveKind:'legacy',savedBy:'Pastor'}],writes=[]
let holdNext=false,release=null
await page.route('**/api/community/**',async route=>{
 const url=new URL(route.request().url()),method=route.request().method()
 if(url.pathname.endsWith('/history'))return route.fulfill({json:{groups:groupServiceHistory(events),hasNextPage:false,currentVersion:envelope.syncVersion}})
 const old=/\/history\/(\d+)$/.exec(url.pathname)
 if(old)return route.fulfill({json:{serviceDocument:snapshots.get(Number(old[1]))}})
 if(method==='PUT') {
  const body=route.request().postDataJSON();writes.push(body)
  const next=core.parseHeritageServiceDocumentSource(body.documentSource).project
  const changed=body.documentSource!==envelope.documentSource || body.status!==envelope.status
  envelope={...envelope,syncVersion:envelope.syncVersion+Number(changed),revision:createHash('sha256').update(body.documentSource).digest('hex'),documentSource:body.documentSource,status:body.status,project:next,changedAt:new Date().toISOString()}
  const response=structuredClone(envelope);snapshots.set(envelope.syncVersion,response)
  events.push({id:String(events.length+1),syncVersion:envelope.syncVersion,revision:envelope.revision,savedAt:envelope.changedAt,saveKind:body.saveKind,savedBy:'Pastor'})
  if(holdNext){holdNext=false;await new Promise(resolve=>release=resolve)}
  return route.fulfill({json:{serviceDocument:response}})
 }
 if(url.pathname.includes('/sermon-presentations/'))return route.fulfill({json:{serviceDocument:envelope}})
 if(url.pathname.endsWith(`/service-documents/${project.id}`))return route.fulfill({json:{serviceDocument:envelope}})
 if(url.pathname.endsWith('/library/bible-passage'))return route.fulfill({json:{books:[],translations:[]}})
 return route.fulfill({json:{items:[]}})
})
await page.goto(`${process.env.CANVAS_TEST_ORIGIN || 'http://127.0.0.1:4199'}/community-server/tests/browser/planner.html`)
await expect(page.locator('.heritage-service-planner__save-state').first()).toContainText('All changes saved')
const rows=plannerSlides(project,'english'),title=rows.find(r=>r.itemId==='sermon-title'),point=rows.find(r=>r.itemId==='sermon-point-1')
assert.equal(await page.locator('[data-slide-id]').count(),5,'Long sermon starts folded while song is selected')
await page.locator(`[data-slide-id="${title.id}"]`).click()
await expect(page.locator(`[data-slide-id="${title.id}"]`)).toHaveAttribute('aria-expanded','true')
await page.locator(`[data-slide-id="${point.id}"]`).click({modifiers:['Control']})
const text=page.locator('.heritage-service-planner__stage [data-role="outline-text"]').first()
await text.fill('First automatic edit')
await expect.poll(()=>writes.length).toBe(1)
assert.equal(writes[0].saveKind,'automatic');assert.equal(envelope.project.items['sermon-point-1'].textByChannel.english,'1. First automatic edit')
await expect(text).toBeFocused()
await text.press('End');await text.press('!')
await expect.poll(()=>writes.length).toBe(2)
assert.equal(envelope.project.items['sermon-point-1'].textByChannel.english,'1. First automatic edit!')
assert.equal(groupServiceHistory(events).filter(g=>g.saveKind==='automatic')[0].entries.length,2)
const beforeManual=envelope.syncVersion
await text.press('Control+s')
await expect.poll(()=>writes.length).toBe(3)
assert.equal(writes[2].saveKind,'manual');assert.equal(envelope.syncVersion,beforeManual,'Unchanged manual checkpoint does not duplicate content revision')
await expect(page.locator('.heritage-service-planner__save-state').first()).toContainText('All changes saved')
const save=page.getByRole('button',{name:'Save sermon slides',exact:true})
await save.click({button:'right'})
await expect(page.getByRole('dialog',{name:'Version history',exact:true})).toBeVisible()
await expect(page.getByRole('button',{name:/Manual save/})).toBeVisible()
await expect(page.getByRole('button',{name:/Automatic save/})).toContainText('2 saves')
await page.getByRole('button',{name:/Saved version/}).click()
await expect(page.getByRole('button',{name:'Restore as new version',exact:true})).toBeEnabled()
await expect(page.locator('.heritage-version-history__preview [data-role="title"]')).toContainText('Поём вместе')
const historyCanvas=await page.locator('.heritage-version-history__preview .heritage-service-planner__stage').boundingBox();assert(historyCanvas.width>500 && historyCanvas.height>200)
await page.screenshot({path:`${evidence}/version-history.png`})
await page.getByRole('button',{name:'Restore as new version',exact:true}).click()
await expect(page.getByRole('dialog')).toHaveCount(0)
await expect.poll(()=>writes.length).toBe(4)
assert.equal(writes[3].saveKind,'restore');assert.equal(envelope.syncVersion,beforeManual+1)
assert.equal(envelope.project.items['sermon-point-1'].textByChannel.english,project.items['sermon-point-1'].textByChannel.english)
// A newer edit made during an in-flight save survives the acknowledgement.
await page.locator(`[data-slide-id="${point.id}"]`).click({modifiers:['Control']})
holdNext=true
await text.fill('Delayed acknowledgement')
await text.press('Control+s')
await expect.poll(()=>writes.length).toBe(5)
await text.fill('Newer words survive')
const flushed=page.evaluate(()=>new Promise(resolve=>{const listener=e=>{if(e.data?.type==='heritage-editor:flushed'&&e.data.requestId==='browser-flush'){window.removeEventListener('message',listener);resolve(e.data)}};window.addEventListener('message',listener);window.postMessage({type:'heritage-editor:flush',requestId:'browser-flush'},location.origin)}))
await expect.poll(()=>release!==null).toBe(true);release()
const result=await flushed;assert.equal(result.ok,true)
assert.equal(result.serviceDocument.project.items['sermon-point-1'].textByChannel.english,'1. Newer words survive')
assert.equal(envelope.project.items['sermon-point-1'].textByChannel.english,'1. Newer words survive')
await page.keyboard.press('Escape')
await page.screenshot({path:`${evidence}/editor-sections.png`})
assert.deepEqual(errors,[])
await writeFile(`${evidence}/verification.json`,JSON.stringify({passed:true,checks:['folded long service','focused typing autosave','caret retained','five minute grouped history','manual unchanged checkpoint','history preview and restore','edits during save','desktop flush newest edit'],writes:writes.map(w=>({saveKind:w.saveKind,baseSyncVersion:w.baseSyncVersion}))},null,2))
await browser.close()
console.log('Editing history browser rehearsal passed')
