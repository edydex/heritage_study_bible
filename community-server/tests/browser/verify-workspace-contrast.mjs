import { chromium, firefox, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import core from '../../packages/service-core/index.js'
import { authoringFixture } from './authoring-fixture.ts'

// Inspect operator controls, never the congregation's authored slide colors.
const evidence = process.env.CONTRAST_EVIDENCE || '/private/tmp/heritage-workspace-contrast'
await mkdir(evidence, { recursive: true })
const results = []
for (const [engineName, engine] of Object.entries({ chromium, firefox })) {
  const browser = await engine.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1512, height: 1100 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let project = core.addProjectItem(authoringFixture(), {
    id: 'welcome', kind: 'sermon', title: 'Welcome', sermonTemplate: 'other', presetId: 'wotbc-sermon', textByChannel: { english: '', russian: '', media: '' },
    objectsByChannel: Object.fromEntries(['english', 'russian', 'media'].map(id => [id, [
      { id: 'welcome-topic', type: 'text', frame: { x: .15, y: .2, width: .4, height: .24, rotation: 0 }, fontSize: 64, align: 'left', spans: [], text: id === 'english' ? 'Our service topic' : 'Тема служения', color: '#ffc000' },
    ]])),
  }, { index: 0 })
  let forceConflict = false
  let envelope = { syncId: project.id, syncVersion: 1, revision: 'sample', project, status: 'planning', changedAt: new Date().toISOString() }
  await page.route('**/api/community/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/history')) return route.fulfill({ json: { groups: [{ id: 'sample', savedAt: envelope.changedAt, saveKind: 'manual', savedBy: 'Sample pastor', entries: [{ id: 'sample', syncVersion: 1, savedAt: envelope.changedAt, saveKind: 'manual', savedBy: 'Sample pastor' }] }], hasNextPage: false } })
    if (/\/history\/1$/.test(path)) return route.fulfill({ json: { serviceDocument: envelope } })
    if (route.request().method() === 'PUT') {
      if (forceConflict) return route.fulfill({ status: 412, json: { error: 'This document changed elsewhere' } })
      project = core.parseHeritageServiceDocumentSource(route.request().postDataJSON().documentSource).project
      envelope = { ...envelope, project, syncVersion: envelope.syncVersion + 1 }
    }
    if (path.includes('/sermon-presentations/')) return route.fulfill({ json: { serviceDocument: envelope } })
    if (path.endsWith('/library/bible-passage')) return route.fulfill({ json: { books: [{ id: 'John', name: 'John', chapters: 21 }], translations: [{ id: 'BSB', name: 'Berean Standard Bible' }, { id: 'SYNO-W', name: 'Russian Synodal Bible' }] } })
    return route.fulfill({ json: { items: [] } })
  })
  await page.goto(`${process.env.CANVAS_TEST_ORIGIN || 'http://127.0.0.1:4291'}/community-server/tests/browser/planner.html`)
  await expect(page.getByRole('button', { name: 'Preview slide 1: Our service topic', exact: true })).toBeVisible()
  async function audit(name) {
    const report = await page.evaluate(() => {
      const root = document.querySelector('dialog[open]') || document.body
      const excluded = '.heritage-service-planner__stage,.heritage-service-preview__tile-frame,.heritage-service-preview__output-frame,.heritage-preset-sample,[aria-hidden="true"]'
      const rgba = value => (value.match(/[\d.]+/g) || []).map(Number)
      const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * (fg[3] ?? 1) + bg[i] * (1 - (fg[3] ?? 1)))
      const luminance = rgb => rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
      const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
      const nodes = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent.trim()
        if (text.length > 1) nodes.push({ element: walker.currentNode.parentElement, text })
      }
      root.querySelectorAll('input:not([type="checkbox"]):not([type="color"]):not([type="file"]),textarea,select').forEach(element => nodes.push({ element, text: element.value || element.placeholder }))
      return nodes.flatMap(({ element, text }) => {
        if (!text || element.closest(excluded) || element.closest('option,script,style,[hidden]')) return []
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
        if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight || style.visibility !== 'visible') return []
        const ancestors = []; let opacity = 1
        for (let node = element; node; node = node.parentElement) { ancestors.unshift(node); opacity *= Number(getComputedStyle(node).opacity) }
        if (!opacity) return []
        let bg = [255, 255, 255]
        for (const node of ancestors) bg = over(rgba(getComputedStyle(node).backgroundColor), bg)
        const fg = over([...rgba(style.color).slice(0, 3), opacity], bg)
        const contrast = ratio(fg, bg), large = parseFloat(style.fontSize) >= 24 || Number(style.fontWeight) >= 700 && parseFloat(style.fontSize) >= 18.66
        const minimum = element.closest(':disabled') || large ? 3 : 4.5
        return [{ text: text.slice(0, 100), className: element.className, contrast: Number(contrast.toFixed(2)), minimum, pass: contrast + .01 >= minimum }]
      })
    })
    results.push({ engine: engineName, name, checked: report.length, failures: report.filter(row => !row.pass) })
    await page.screenshot({ path: `${evidence}/${engineName}-${name}.png` })
  }
  await audit('slide-overview')
  await page.getByRole('button', { name: 'Preview slide 1: Our service topic', exact: true }).dblclick()
  await expect(page.getByLabel('Welcome slide topic')).toBeVisible()
  await audit('welcome-field')
  const authored = page.locator('.heritage-canvas__object [contenteditable]').first()
  await authored.click()
  await authored.evaluate(element => { element.focus(); const range = document.createRange(); range.selectNodeContents(element); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange')) })
  await expect(page.getByRole('toolbar', { name: 'Selected text formatting' })).toBeVisible()
  await audit('text-formatting')
  await page.getByRole('button', { name: 'Text color', exact: true }).click()
  await audit('text-color-palette')
  await page.getByRole('group', { name: 'Text color palette', exact: true }).getByRole('textbox').press('Escape')
  await page.getByRole('button', { name: 'Text highlight', exact: true }).click()
  await audit('text-highlight-palette')
  await page.getByRole('group', { name: 'Text highlight palette', exact: true }).getByRole('textbox').press('Escape')
  const selectionStyle = await authored.evaluate(element => { const style = getComputedStyle(element, '::selection'); return { color: style.color, background: style.backgroundColor } })
  assert.deepEqual(selectionStyle, {color:'rgb(255, 255, 255)',background:'rgb(49, 91, 133)'}, 'Selected authored words need a readable editing overlay')
  await authored.press('Escape')
  assert.equal(await page.locator('.heritage-canvas__object [contenteditable]').first().evaluate(element => getComputedStyle(element).color), 'rgb(255, 192, 0)', 'Operator theme must preserve authored slide colors')
  await page.getByLabel('Welcome slide topic').fill('')
  await audit('welcome-placeholder')
  await page.locator('[data-slide-id]').first().click({ button: 'right' })
  await audit('slide-menu')
  await page.getByRole('menuitem', { name: 'Slide settings…', exact: true }).click()
  await audit('slide-settings')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.locator('.heritage-service-planner__history-button').click()
  await expect(page.getByRole('dialog', { name: 'Version history' })).toBeVisible()
  await audit('version-history')
  await page.getByRole('button', { name: 'Back to editing', exact: true }).click()
  await page.getByRole('button', { name: '＋ Add slide', exact: true }).click()
  for (const name of ['Sermon', 'Songs', 'Scripture', 'Media']) {
    await page.getByRole('tab', { name, exact: true }).click()
    await audit(`add-${name.toLowerCase()}`)
    await page.getByRole('tab', { name, exact: true }).hover()
    await page.getByRole('tab', { name, exact: true }).focus()
    await audit(`add-${name.toLowerCase()}-selected-focus`)
  }
  await page.getByRole('button', { name: 'Close add slide palette' }).click()
  forceConflict = true
  await page.getByLabel('Welcome slide topic').fill('A draft awaiting conflict review')
  await page.getByRole('button', { name: 'Save sermon slides', exact: true }).click()
  await page.getByRole('button', { name: 'Review saved version', exact: true }).click()
  await expect(page.locator('.heritage-save-conflict')).toBeVisible()
  await audit('save-conflict')
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await page.evaluate(() => { document.documentElement.lang = 'ru' })
  await expect(page.getByLabel('Тема приветственного слайда')).toBeVisible()
  await audit('russian-editor')
  assert.deepEqual(errors, [], `${engineName} browser errors`)
  await browser.close()
}
await writeFile(`${evidence}/contrast-report.json`, JSON.stringify(results, null, 2))
const failures = results.filter(result => result.failures.length)
console.log(JSON.stringify({ states: results.length, checked: results.reduce((sum, result) => sum + result.checked, 0), failures }, null, 2))
assert.deepEqual(failures, [], 'Operator text must meet the contrast thresholds across the reviewed states')
