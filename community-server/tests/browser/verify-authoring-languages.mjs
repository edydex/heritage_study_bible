import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {createHash} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import core from '../../packages/service-core/index.js'
import {authoringFixture} from './authoring-fixture.ts'
import {plannerSlides} from '../../src/components/plannerSlides.ts'
const origin=process.env.CANVAS_TEST_ORIGIN || 'http://127.0.0.1:4211'
const evidence=process.env.EDITING_EVIDENCE || '/private/tmp/heritage-authoring-language-evidence'
await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1512,height:1050}}),errors=[]
page.on('pageerror',error=>errors.push(error.message))
const project={...authoringFixture(),revision:1},source=core.serializeHeritageServiceDocument(core.createHeritageServiceDocument(project))
const envelope={syncId:project.id,syncVersion:1,revision:createHash('sha256').update(source).digest('hex'),documentSource:source,status:'planning',project,changedAt:new Date().toISOString()}
await page.route('**/api/community/**',route=>{
 const url=new URL(route.request().url())
 if(url.pathname.includes('/sermon-presentations/'))return route.fulfill({json:{serviceDocument:envelope}})
 if(url.pathname.endsWith('/library/bible-passage'))return route.fulfill({json:{books:[],translations:[]}})
 return route.fulfill({json:{items:[]}})
})
try {
 await page.goto(`${origin}/community-server/tests/browser/planner.html`)
 const rows=plannerSlides(project,'english'),title=rows.find(row=>row.itemId==='sermon-title')
 const passages=rows.filter(row=>row.kind==='bible'),point=rows.find(row=>row.itemId==='sermon-point-12')
 await page.locator(`[data-slide-id="${title.id}"]`).click()
 await expect(page.locator(`[data-slide-id="${passages[0].id}"] strong`)).toContainText('John 1:1–24')
 for(const [tab,address] of [['English','John 1:1–24'],['Russian','Иоанна 1:1–24']]) {
  await page.getByRole('tab',{name:tab,exact:true}).click()
  await expect(page.locator(`[data-slide-id="${passages[0].id}"] strong`)).toContainText(address)
  await page.locator(`[data-slide-id="${passages[0].id}"]`).click({modifiers:['ControlOrMeta']})
  const scripture=page.locator('.heritage-service-planner__stage .heritage-service-planner__scripture-page [data-role="body"]').first()
  await expect(scripture).toContainText(address)
  assert.equal((await scripture.textContent()).split(address).length,2,'Requested reference appears once on the first page')
  await page.screenshot({path:`${evidence}/${tab.toLowerCase()}-first-page.png`})
  await page.locator(`[data-slide-id="${passages[1].id}"]`).click({modifiers:['ControlOrMeta']})
  await expect(scripture).not.toContainText(address)
  assert.doesNotMatch(await scripture.textContent(),/John|Иоанна/,'Continuation shows verse text without another address')
  await page.screenshot({path:`${evidence}/${tab.toLowerCase()}-continuation.png`})
 }
 await page.locator(`[data-slide-id="${point.id}"]`).click({modifiers:['ControlOrMeta']})
 await page.getByRole('tab',{name:'Stage-Facing Screen',exact:true}).click()
 await expect(page.getByLabel('Next slide cue')).toHaveText('Иоанна 1:1–24')
 await page.screenshot({path:`${evidence}/stage-next-passage.png`})
 assert.deepEqual(errors,[])
 console.log('English/Russian full passage section titles, first pages, continuation pages and stage next-passage hint passed')
} finally {await browser.close()}
