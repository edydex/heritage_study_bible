import { test, expect } from '@playwright/test'
import catalog from '../src/data/audioCatalog.json' with { type: 'json' }
import timing from '../public/data/audio/books/martyrdom-of-polycarp.json' with { type: 'json' }
const track = catalog.books.find(book => book.id === 'martyrdom-of-polycarp').editions[0].tracks[0]
const span = timing.tracks[track.id].spans.find(span => span.start > 150 && timing.paragraphs[span.paragraph].chapterIndex > 1)
const position = Math.round((span.start + span.end) / 2)
const paragraph = timing.paragraphs[span.paragraph]
test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ id, position }) => localStorage.setItem('heritage-audio-progress-v1', JSON.stringify({ lastTrackId: id, positions: { [id]: position }, rate: 1 })), { id: track.id, position })
})
test('first audio-text click selects and reveals the matched paragraph without changing its text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/audio')
  const player = page.getByRole('region', { name: 'Audio player', exact: true })
  await player.locator('.audio-player-title').click()
  await player.getByRole('button', { name: 'Go to nearby text' }).click()
  const marked = page.locator('[data-audio-paragraph="true"]')
  await expect(marked).toHaveCount(1)
  await expect(marked).toBeInViewport()
  await expect(marked).toBeFocused()
  await expect(marked).toContainText(paragraph.text.replace(/\[\d+\]/g, '').slice(0, 55))
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('automatic paragraph match')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('nearby-text-phone.png'), fullPage: false })
  await page.reload()
  await expect(marked).toBeInViewport()
})
test('failed timing request keeps the recording and plain book navigation usable', async ({ page }) => {
  await page.route('**/data/audio/books/**', route => route.abort('internetdisconnected'))
  await page.goto('/#/audio')
  const player = page.getByRole('region', { name: 'Audio player', exact: true })
  await player.locator('.audio-player-title').click()
  await expect(player.getByRole('button', { name: 'Open book text' })).toBeVisible()
  await player.getByRole('button', { name: 'Open book text' }).click()
  await expect(page).toHaveURL(/resources\/books\/martyrdom-of-polycarp/)
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.locator('[data-audio-paragraph="true"]')).toHaveCount(0)
})
