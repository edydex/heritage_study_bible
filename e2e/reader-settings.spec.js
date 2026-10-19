import { expect, test } from '@playwright/test'
import { makeRemoteContentKey } from '../src/utils/contentProtocol.js'

const readers = [
  ['book', '/resources/books/martyrdom-of-polycarp-lake', '[data-book-paragraph="0"]'],
  ['confession', '/resources/confessions/apostles-creed', '.confession-body p'],
  ['Apocrypha', '/resources/tools/apocrypha', '.verse-text'],
  ['hymns', '/resources/tools/hymns', 'p.whitespace-pre-line'],
  ['song', '/resources/songs/before-the-throne', '.song-lyrics p'],
  ['transcript', '/transcript/ortlund-revelation', 'article > p'],
  ['plan note', '/resources/reading-plans/chronological-bible/note/45/note-undated-psalms-covenant-sprinkle', '.reader-note > p.leading-relaxed'],
]

async function checkSettings(page, url, selector, label = 'Reading') {
  await page.goto(`/#${url}`)
  const text = page.locator(selector).first()
  await expect(text).toBeVisible()
  const size = page.getByLabel(`${label} font size`, { exact: true })
  await expect(size).toHaveCount(0)
  const settings = page.locator('header').getByRole('button', { name: 'Settings', exact: true })
  await expect(settings).toBeVisible()
  const buttons = page.locator('header button:visible')
  await expect(buttons.last()).toHaveAccessibleName('Settings')
  await settings.click()
  await expect(size).toHaveValue('18')
  await page.getByRole('button', { name: `Increase ${label.toLowerCase()} font size` }).click()
  await expect(size).toHaveValue('19')
  await expect(text).toHaveCSS('font-size', '19px')
  await page.getByRole('button', { name: `Decrease ${label.toLowerCase()} font size` }).click()
  await expect(size).toHaveValue('18')
  await size.fill('24')
  // Tapping outside commits the typed value before dismissing the menu.
  await page.locator('header').click({ position: { x: 4, y: 4 } })
  await expect(size).toHaveCount(0)
  await expect(text).toHaveCSS('font-size', '24px')
  expect(await page.locator('header').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await settings.click()
  await page.screenshot({ path: test.info().outputPath(`${label.toLowerCase()}-settings-phone.png`) })
  await page.keyboard.press('Escape')
  await expect(size).toHaveCount(0)
  await expect(settings).toBeFocused()
  await page.reload()
  await expect(text).toHaveCSS('font-size', '24px')
  await settings.click()
  await page.evaluate(() => window.dispatchEvent(new Event('heritage:native-back', { cancelable: true })))
  await expect(size).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'BSB')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
})

for (const [name, url, selector] of readers) test(`${name} has Bible-style font controls in its top-right Settings menu`, async ({ page }) => {
  await checkSettings(page, url, selector)
})

test('Bible uses the same font controls and keeps commentary size separate', async ({ page }) => {
  await checkSettings(page, '/genesis/1', '#verse-1-1', 'Bible')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByLabel('Bible font size', { exact: true })).toHaveValue('24')
  const commentary = page.getByLabel('Commentary font size', { exact: true })
  await expect(commentary).toHaveValue('14')
  await commentary.fill('100')
  await commentary.press('Enter')
  await expect(commentary).toHaveValue('64')
  await expect(page.getByRole('button', { name: 'Increase commentary font size' })).toBeDisabled()
})

test('resource readers share the saved size across pages and support the Bible size range', async ({ page }) => {
  await page.goto('/#/resources/books/martyrdom-of-polycarp-lake')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const size = page.getByLabel('Reading font size', { exact: true })
  await size.fill('80')
  await size.press('Enter')
  await expect(size).toHaveValue('64')
  await expect(page.getByRole('button', { name: 'Increase reading font size' })).toBeDisabled()
  await page.reload()
  await expect(page.locator('[data-book-paragraph="0"]').first()).toHaveCSS('font-size', '64px')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await size.fill('5')
  await size.press('Enter')
  await expect(size).toHaveValue('12')
  await expect(page.getByRole('button', { name: 'Decrease reading font size' })).toBeDisabled()
  await size.fill('26')
  await size.press('Enter')
  await page.goto('/#/resources/confessions/apostles-creed')
  await expect(page.locator('.confession-body p').first()).toHaveCSS('font-size', '26px')
})

test('Community text resources put the same font controls in the header', async ({ page }) => {
  const serverId = 'reader-settings-test', itemId = '1'
  await page.addInitScript(({ serverId, itemId }) => localStorage.setItem('heritage-content-servers-v2', JSON.stringify([{
    enabled: true, manifest: { id: serverId, name: 'Test library' },
    catalogs: { documents: { items: [{ id: itemId, title: 'Community reading', content: { url: 'https://reader.example/text.txt', mediaType: 'text/plain' } }] } },
  }])), { serverId, itemId })
  await page.route('https://reader.example/text.txt', route => route.fulfill({ contentType: 'text/plain', body: 'A shared Community text for reading.' }))
  await checkSettings(page, `/resources/content/${makeRemoteContentKey(serverId, 'documents', itemId)}`, 'article pre')
})

// The situation diagram keeps its compact labels; the full note respects the reader size.
test('plan note details respect the font size chosen in the header', async ({ page }) => {
  await page.goto('/#/resources/reading-plans/chronological-bible/note/255/note-jeremiah-historical-appendix')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const size = page.getByLabel('Reading font size', { exact: true })
  await size.fill('24')
  await size.press('Enter')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await expect(page.getByRole('dialog').locator(':scope > p')).toHaveCSS('font-size', '24px')
  await page.getByRole('button', { name: 'Close timeline details' }).click()
  await expect(page.getByRole('region', { name: 'Jeremiah 52 retells Judah’s final collapse' })).toBeVisible()
})

test('book verse mode defaults on, stays in Settings, and More settings returns to the book', async ({ page }) => {
  const bookUrl = '/#/resources/books/martyrdom-of-polycarp-lake'
  await page.goto(bookUrl)
  await expect.poll(() => page.locator('.reader-sentence-row').count()).toBeGreaterThan(0)
  const verseMode = page.getByLabel('Verse scroll mode')
  const more = page.getByRole('button', { name: 'More settings', exact: true })
  await expect(verseMode).toHaveCount(0)
  await expect(more).toHaveCount(0)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(verseMode).toBeChecked()
  await verseMode.uncheck()
  await more.click()
  await expect(page).toHaveURL(/settings\/advanced/)
  await expect(page.getByRole('heading', { name: 'More Settings', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/resources\/books\/martyrdom-of-polycarp-lake/)
  await expect(page.locator('[data-book-paragraph="0"]').first()).toBeVisible()
  await expect(page.locator('.reader-sentence-row')).toHaveCount(0)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(verseMode).not.toBeChecked()
  await verseMode.check()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect.poll(() => page.locator('.reader-sentence-row').count()).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(verseMode).toBeChecked()
  await page.screenshot({ path: test.info().outputPath('book-verse-settings-phone.png') })
})
