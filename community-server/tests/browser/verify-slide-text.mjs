import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
const origin=process.env.CANVAS_TEST_ORIGIN || 'http://127.0.0.1:4211'
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[]
page.on('pageerror',error=>errors.push(error.message))
const values=async()=>JSON.parse(await page.getByRole('status',{name:'Committed content'}).textContent())
const commits=async()=>JSON.parse(await page.getByRole('status',{name:'Commits'}).textContent())
try {
 await page.goto(`${origin}/community-server/tests/browser/slide-text.html`)
 const heading=page.getByRole('textbox',{name:'Heading',exact:true}),body=page.getByRole('textbox',{name:'Body',exact:true})
 await heading.fill('Already autosaved')
 await expect.poll(async()=>(await values()).heading).toBe('Already autosaved')
 await expect(heading).toBeFocused()
 await heading.press('Escape')
 assert.equal((await values()).heading,'Already autosaved','Escape keeps typing already committed while focused')
 await heading.fill('Pending typing to cancel')
 await heading.press('Escape')
 assert.equal((await values()).heading,'Already autosaved','Escape cancels only the newest uncommitted typing')
 await heading.fill('Heading before body switch')
 await body.fill('Body before outline switch')
 assert.equal((await values()).heading,'Heading before body switch','A rapid switch commits the previous field')
 const points=page.locator('[data-role="outline-text"]')
 await points.nth(0).fill('First rapid point')
 assert.equal((await values()).body,'Body before outline switch')
 await points.nth(1).fill('Second rapid point')
 await page.getByRole('button',{name:'Leave editor',exact:true}).click()
 assert.equal((await values()).outline,'1. First rapid point\n2. Second rapid point','Multiple outline fields retain every pending edit')
 const objects=page.locator('[data-role="canvas-text"]')
 await objects.nth(0).fill('First rapid object')
 await objects.nth(1).fill('Second rapid object')
 await page.getByRole('button',{name:'Leave editor',exact:true}).click()
 assert.deepEqual((await values()).objects.map(object=>object.text),['First rapid object','Second rapid object'])
 // Replace the focused document without a blur, as external undo or reload can.
 await heading.fill('Pending before external replacement')
 await page.getByRole('button',{name:'External Undo',exact:true}).dispatchEvent('click')
 await expect(heading).toHaveText('Original heading')
 await heading.press('Escape')
 assert.equal((await values()).heading,'Original heading','Escape cannot restore text from before an external replacement')
 const afterReplacement=(await commits()).length
 await page.waitForTimeout(850)
 assert.equal((await commits()).length,afterReplacement,'The previous idle timer cannot commit over external undo')
 assert.deepEqual(errors,[])
 console.log('Focused slide text, Escape, external replacement, rapid header/body/outline/canvas edits passed')
} finally {await browser.close()}
