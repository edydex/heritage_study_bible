import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import core from '../../packages/service-core/index.js'
import {authoringFixture} from './authoring-fixture.ts'
import {groupServiceHistory} from '../../src/lib/serviceVersionHistory.ts'
import {plannerSlides} from '../../src/components/plannerSlides.ts'
const evidence=process.env.RUSSIAN_EDITING_EVIDENCE || '/private/tmp/heritage-russian-editing-evidence'
await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1512,height:1050}}),errors=[]
page.on('pageerror',e=>errors.push(e.message))
const project={...authoringFixture(),revision:1},source=core.serializeHeritageServiceDocument(core.createHeritageServiceDocument(project))
const envelope={syncId:project.id,syncVersion:1,revision:createHash('sha256').update(source).digest('hex'),documentSource:source,status:'planning',project,changedAt:'2026-10-01T22:00:00Z'}
const localVersion='local-4b3636fd-8513-4642-a2ba-0bfe59b02fd2'
const events=[{id:'legacy-1',syncVersion:1,revision:envelope.revision,savedAt:envelope.changedAt,saveKind:'legacy',savedBy:'Sample pastor'},
 {id:'local-manual',syncVersion:localVersion,revision:envelope.revision,savedAt:'2026-10-01T22:05:00Z',saveKind:'manual',savedBy:'Sample pastor'}]
const writes=[]
await page.route('**/api/community/**',async route=>{
 const url=new URL(route.request().url()),method=route.request().method()
 if(url.pathname.endsWith('/history'))return route.fulfill({json:{groups:groupServiceHistory(events),hasNextPage:false,currentVersion:1}})
 if(/\/history\/(?:\d+|local-[a-z0-9-]+)$/.test(url.pathname))return route.fulfill({json:{serviceDocument:{...envelope,syncVersion:url.pathname.endsWith(localVersion)?localVersion:1}}})
 if(url.pathname.includes('/sermon-presentations/'))return route.fulfill({json:{serviceDocument:envelope}})
 if(method==='PUT'||method==='POST'){writes.push(route.request().postDataJSON());return route.fulfill({status:500,json:{error:'Fixture does not accept writes'}})}
 if(url.pathname.endsWith(`/service-documents/${project.id}`))return route.fulfill({json:{serviceDocument:envelope}})
 if(url.pathname.endsWith('/library/bible-passage'))return route.fulfill({json:{books:[],translations:[]}})
 return route.fulfill({json:{items:[]}})
})
const origin=process.env.CANVAS_TEST_ORIGIN||'http://127.0.0.1:4299'
await page.goto(`${origin}/community-server/tests/browser/planner.html`)
await expect(page.getByRole('button',{name:'Save sermon slides',exact:true})).toBeVisible()
await page.evaluate(()=>document.documentElement.lang='ru')
await expect(page.getByRole('button',{name:'Сохранить слайды проповеди',exact:true})).toBeVisible()
await expect(page.locator('.heritage-service-planner__save-state').first()).toContainText('Все изменения сохранены')
const history=page.getByRole('button',{name:'История версий',exact:true})
await history.click()
const dialog=page.getByRole('dialog',{name:'История версий',exact:true})
await expect(dialog).toBeVisible()
await expect(dialog.getByRole('button',{name:/Ручное сохранение/})).toContainText('Сохранено на этом компьютере')
await expect(dialog.locator('.heritage-version-history__preview-toolbar')).toContainText('Сохранено на этом компьютере')
assert.ok(!(await dialog.innerText()).includes(localVersion),'Local version UUID is not displayed')
await dialog.getByRole('combobox',{name:'Язык просмотра'}).selectOption('russian')
await expect(dialog.locator('.heritage-version-history__preview')).toHaveAttribute('lang','ru')
await expect(dialog.getByRole('button',{name:'Восстановить как новую версию',exact:true})).toBeEnabled()
await page.screenshot({path:`${evidence}/russian-history.png`})
await dialog.getByRole('button',{name:'Вернуться к редактированию',exact:true}).click()
await expect(history).toBeFocused()
const rows=plannerSlides(project,'english'),title=rows.find(row=>row.itemId==='sermon-title')
const section=page.locator(`[data-slide-id="${title.id}"]`)
await expect(section).toContainText('The Word became flesh')
await expect(section).toContainText('Слайдов:')
assert.equal(await section.locator('strong').evaluate(node=>getComputedStyle(node).whiteSpace),'normal')
await section.click()
await expect(section).toHaveAttribute('aria-expanded','true')
const point=rows.find(row=>row.itemId==='sermon-point-1')
await page.locator(`[data-slide-id="${point.id}"]`).click({modifiers:[process.platform === 'darwin' ? 'Meta' : 'Control']})
await expect(page.locator('[data-level=point] [contenteditable]').first()).toHaveText('Consider the next part of the passage')
await page.getByRole('button',{name:'＋ Добавить слайд',exact:true}).click()
await expect(page.getByRole('button',{name:/Основная мысль/})).toBeVisible()
await page.getByRole('tab',{name:'Песни',exact:true}).click()
await expect(page.getByPlaceholder('Название на английском или русском…')).toBeVisible()
await page.getByRole('tab',{name:'Писание',exact:true}).click()
await expect(page.getByRole('button',{name:'Выбрать книгу и стихи',exact:true})).toBeVisible()
await page.screenshot({path:`${evidence}/russian-passage-palette.png`})
await page.getByRole('button',{name:'Закрыть панель добавления слайдов',exact:true}).click()
await page.evaluate(()=>document.documentElement.lang='en')
await expect(page.getByRole('button',{name:'Save sermon slides',exact:true})).toBeVisible()
assert.equal(writes.length,0,'Changing UI language does not mutate source content')
await page.goto(`${origin}/community-server/tests/browser/planner.html?workspace`)
await page.evaluate(()=>document.documentElement.lang='ru')
await expect(page.getByRole('heading',{name:'Подготовка проповеди',exact:true})).toBeVisible()
await page.getByRole('button',{name:'Новая проповедь',exact:true}).click()
await expect(page.getByRole('combobox',{name:'Основной язык',exact:true})).toBeVisible()
await expect(page.getByRole('button',{name:'Создать и редактировать слайды',exact:true})).toBeVisible()
assert.deepEqual(errors,[])
await browser.close()
console.log(JSON.stringify({checks:['document-language-updates','russian-save-history-local-version','history-preview-lang-focus-return','readable-collapsed-section','source-content-fidelity','russian-add-palette','russian-new-sermon'],evidence}))
