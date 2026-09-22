import {chromium,expect} from '@playwright/test'
import {readFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const origin=process.env.CANVAS_TEST_ORIGIN || 'http://127.0.0.1:4299'
const bytes=await readFile(process.env.BOOK_TEST_AUDIO)
const hash=createHash('sha256').update(bytes).digest('hex')
const chapter={title:'Chapter one',duration:6,audioSha256:hash,audioSize:bytes.length,paragraphs:[{id:'p1',text:'First sentence.'},{id:'p2',text:'Another sentence.'}],words:[{paragraphId:'p1',start:.2,end:.6,sourceStart:0,sourceEnd:5},{paragraphId:'p1',start:.7,end:1.5,sourceStart:6,sourceEnd:15},{paragraphId:'p2',start:2,end:3,sourceStart:0,sourceEnd:7},{paragraphId:'p2',start:3.1,end:4.5,sourceStart:8,sourceEnd:17}]}
const document={id:42,readAlong:{language:'en',chapters:[{...chapter,id:'one'},{...chapter,id:'two',title:'Chapter two'}]}}
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:412,height:915}}),errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.route('**/fixture.json',r=>r.fulfill({json:document}))
let authorized=0,deny=false
await page.route('**/api/community/books/42/audio/*',r=>{if(r.request().headers().authorization==='Community dummy-book-test')authorized++;return deny?r.fulfill({status:404,json:{error:'Not found'}}):r.fulfill({body:bytes,contentType:'audio/mpeg'})})
await page.goto(origin+'/community-server/tests/browser/book.html')
await expect(page.getByRole('button',{name:'Play book audio',exact:true})).toBeEnabled()
await page.locator('audio').evaluate(audio=>{audio.muted=true;audio.currentTime=2.05})
await expect(page.locator('mark')).toHaveText('Another')
await page.getByText('First sentence.',{exact:true}).click()
await expect.poll(()=>page.locator('audio').evaluate(a=>a.currentTime)).toBeCloseTo(.2,1)
await page.getByRole('button',{name:'Open player controls'}).click()
await expect(page.getByRole('dialog')).toBeVisible()
await page.keyboard.press('Escape')
await expect(page.getByRole('dialog')).toHaveCount(0)
await page.getByRole('button',{name:'Play book audio',exact:true}).click()
await expect(page.getByRole('button',{name:'Back 10 seconds'})).toBeVisible()
await page.getByRole('button',{name:'Pause book audio',exact:true}).click()
await expect(page.getByRole('button',{name:'Play book audio',exact:true})).toBeEnabled()
await page.getByLabel('Chapter',{exact:true}).selectOption('two')
await expect(page.getByRole('button',{name:'Play book audio',exact:true})).toBeEnabled()
await page.locator('audio').evaluate(a=>{a.currentTime=3.2})
await expect(page.locator('mark')).toHaveText('sentence.')
await page.reload()
await expect(page.getByLabel('Chapter',{exact:true})).toHaveValue('two')
await expect(page.getByRole('button',{name:'Play book audio',exact:true})).toBeEnabled()
await expect.poll(()=>page.locator('audio').evaluate(a=>a.currentTime)).toBeCloseTo(3.2,1)
await mkdir(process.env.BOOK_TEST_EVIDENCE,{recursive:true})
await page.screenshot({path:process.env.BOOK_TEST_EVIDENCE+'/book-reader.png'})
deny=true
await page.getByLabel('Chapter',{exact:true}).selectOption('one')
await expect(page.getByRole('alert')).toContainText('unavailable')
await expect(page.getByRole('button',{name:'Play book audio',exact:true})).toBeDisabled()
expect(authorized).toBeGreaterThanOrEqual(4)
expect(errors).toEqual([])
console.log('Read-along browser acceptance passed: exact audio-position word selection, paragraph seek, controls, resume, chapter replacement and revoked access.')
await browser.close()
