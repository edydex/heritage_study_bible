import sharp from 'sharp'
import {chromium,firefox,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import core from '../../packages/service-core/index.js'
import {synthesizeLegacySyncDocuments} from '../../src/lib/syncShowProtocol.ts'
const evidence=process.env.SERVICE_REFERENCE_EVIDENCE || 'test-results/service-reference'
await mkdir(evidence,{recursive:true})
const pixel=await sharp({create:{width:2,height:2,channels:3,background:'#3050d0'}}).png().toBuffer()
const russianPixel=await sharp({create:{width:2,height:2,channels:3,background:'#d05030'}}).png().toBuffer()
for(const [name,engine] of Object.entries({chromium,firefox})) {
 const browser=await engine.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 const initial=core.createServiceProject({id:'canvas-rehearsal',title:'Reference',serviceDate:'2026-09-20',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}]})
 let project=core.addProjectItem(initial,{id:'point',kind:'sermon',sermonTemplate:'point',title:'Therefore',presetId:'wotbc-sermon',titlesByChannel:{english:'From lies to truth',russian:'От лжи к истине'},textByChannel:{english:'I. Therefore',russian:'I. Поэтому'}})
 let saved={syncId:'canvas-rehearsal',syncVersion:1,revision:1,status:'planning',project}
 const song={syncId:'example',syncVersion:1,title:'Example song',russianTitle:'Пример',defaultSongLanguage:'en',lyrics:'Verse 1 (a)\nFirst words\n\nVerse 1 b\nSecond words\n\nChorus\nWe Rejoice\n\nChorus\nWe rejoice',russianLyrics:'Куплет 1 (a)\nПервые слова\n\nVerse 1 b\nДругие слова\n\nПрипев\nРадуйтесь\n\nПрипев\nРадуйтесь'}
 song.syncDocuments=synthesizeLegacySyncDocuments(song)
 await page.route('**/api/community/**',async route=>{
  const url=new URL(route.request().url()),method=route.request().method()
  if(url.pathname.endsWith('/library/songs/example'))return route.fulfill({json:{item:song}})
  if(url.pathname.endsWith('/library/songs'))return route.fulfill({json:{items:[song]}})
  if(url.pathname.endsWith('/library/bible-passage')) {
   if(method==='GET')return route.fulfill({json:{books:[{id:'Eph',name:'Ephesians',chapters:6},{id:'Ps',name:'Psalm',chapters:150}],translations:[{id:'BSB',name:'Berean Standard Bible',language:'en'},{id:'SYNO-W',name:'Синодальный перевод',language:'ru'}]}})
   const {bookId,chapter,startVerse,endVerse}=route.request().postDataJSON()
   return route.fulfill({json:{passage:{title:'Ephesians 4:25',range:{bookId,start:{chapter,verse:startVerse},end:{chapter,verse:endVerse}},passagesByChannel:{english:{reference:'Ephesians 4:25',translationId:'BSB',verses:[{number:25,text:'Therefore each of you must put off falsehood and speak truthfully to his neighbor.'}],attribution:'Berean Standard Bible'},russian:{reference:'Ефесянам 4:25',translationId:'SYNO-W',verses:[{number:25,text:'Посему, отвергнув ложь, говорите истину каждый ближнему своему.'}],attribution:''}}}}})
  }
  if(url.pathname.includes('/assets/') && method==='GET')return route.fulfill({body:pixel,contentType:'image/png'})
  if(url.pathname.includes('/assets/') && method==='PUT')return route.fulfill({json:{asset:{mediaType:'image/png',size:route.request().postDataBuffer().length,width:2,height:2,orientation:1}}})
  if(method==='PUT') { const doc=core.parseHeritageServiceDocumentSource(route.request().postDataJSON().documentSource);saved={...saved,syncVersion:saved.syncVersion+1,revision:doc.project.revision,project:doc.project};return route.fulfill({json:{serviceDocument:saved}}) }
  if(url.pathname.endsWith('/canvas-rehearsal'))return route.fulfill({json:{serviceDocument:saved}})
  return route.fulfill({json:{items:[]}})
 })
 await page.goto(`${process.env.CANVAS_TEST_ORIGIN || 'http://127.0.0.1:4287'}/community-server/tests/browser/planner.html`)
 await page.getByRole('button',{name:/Bible passage Exact verses/}).click()
 await page.getByRole('textbox',{name:'Passage shortcut'}).fill('Eph 4 25')
 await page.getByRole('button',{name:'Add sermon passage',exact:true}).click()
 await expect(page.locator('.heritage-service-planner__stage [data-role="title"]')).toHaveText('I. Therefore')
 await expect(page.locator('.heritage-service-planner__stage [data-role="body"]')).toContainText('Ephesians 4:25')
 await page.screenshot({path:`${evidence}/sermon-${name}.png`})
 await page.getByRole('button',{name:'Save sermon slides',exact:true}).click()
 await expect(page.getByRole('button',{name:'Save sermon slides',exact:true})).toBeDisabled()
 await page.getByRole('tab',{name:'Songs',exact:true}).click()
 await page.getByRole('button',{name:'Example song Пример',exact:true}).click()
 await page.getByRole('button',{name:'Add song to service',exact:true}).click()
 await expect(page.getByLabel('Top language')).toHaveValue('english')
 await page.getByRole('button',{name:'Save sermon slides',exact:true}).click()
 await expect(page.getByRole('button',{name:'Save sermon slides',exact:true})).toBeDisabled()
 const pinned=Object.values(saved.project.items).find(item=>item.kind==='song')
 assert.equal(pinned.songPresentation.primaryChannelId,'english');assert.equal(pinned.arrangement.length,4)
 await page.getByRole('tab',{name:'Scripture',exact:true}).click()
 await page.getByRole('textbox',{name:'Passage shortcut'}).fill('Eph 4 25')
 await page.getByRole('button',{name:'Add reading',exact:true}).click()
 await page.getByRole('button',{name:'Save sermon slides',exact:true}).click()
 await expect(page.getByRole('button',{name:'Save sermon slides',exact:true})).toBeDisabled()
 const titles=Object.values(saved.project.items).filter(item=>item.presetId==='wotbc-reading-title')
 assert.equal(titles.length,1);assert.ok(titles[0].textByChannel.english.includes('Berean Standard Bible'))
 await page.getByRole('tab',{name:'Sermon',exact:true}).click()
 await page.getByRole('button',{name:/Title Picture first/}).click()
 const enChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose English image',exact:true}).click()
 await (await enChooser).setFiles({name:'english.png',mimeType:'image/png',buffer:pixel})
 await expect(page.getByRole('button',{name:'Replace English image',exact:true})).toBeVisible()
 await page.getByRole('tab',{name:'Russian',exact:true}).click()
 const ruChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose Russian image',exact:true}).click()
 await (await ruChooser).setFiles({name:'russian.png',mimeType:'image/png',buffer:russianPixel})
 await expect(page.getByRole('button',{name:'Replace Russian image',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Save sermon slides',exact:true}).click()
 await expect(page.getByRole('button',{name:'Save sermon slides',exact:true})).toBeDisabled()
 const title=Object.values(saved.project.items).find(item=>item.sermonTemplate==='title')
 assert.notEqual(title.backgroundAssetIdsByChannel.english,title.backgroundAssetIdsByChannel.russian)
 assert.equal(title.backgroundAssetIdsByChannel.media,title.backgroundAssetIdsByChannel.russian)
 await page.reload()
 await expect(page.getByRole('button',{name:'Save sermon slides',exact:true})).toBeDisabled()
 await expect(page.locator('.heritage-service-planner')).toBeVisible()
 assert.equal(errors.length,0)
 await writeFile(`${evidence}/saved-${name}.json`,JSON.stringify(saved.project,null,2))
 console.log(`${name}: sermon context, inline reference, forgiving bilingual song, language preference, reading title, save/reopen passed`)
 await browser.close()
}
