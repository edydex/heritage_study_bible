import { test, expect } from '@playwright/test'
import catalog from '../src/data/audioCatalog.json' with { type: 'json' }

test('Bible books are hidden from Audiobooks by default and the optional setting persists without losing progress', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const book = catalog.books.find(book => book.kind !== 'bible')
  const track = book.editions[0].tracks[0]
  await page.addInitScript(id => {
    if (localStorage.getItem('heritage-bible-audiobook-option-seeded')) return
    localStorage.setItem('heritage-bible-audiobook-option-seeded', 'true')
    localStorage.setItem('heritage-audio-progress-v1', JSON.stringify({ lastTrackId: id,
      positions: { [id]: 37, 'bsb-hays-01-001': 43 },
      lastPlayed: { [id]: 1000, 'bsb-hays-01-001': 2000 }, rate: 1 }))
  }, track.id)
  await page.goto('/#/audio?kind=audiobook')
  const shelf = page.getByRole('region', { name: 'Continue listening', exact: true })
  await expect(shelf.locator('article')).toHaveCount(1)
  await expect(shelf).toContainText(book.title)
  await expect(page.getByRole('button', { name: 'Bible', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Resume Genesis', exact: true })).toHaveCount(0)
  const player = page.getByRole('region', { name: 'Audio player', exact: true })
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Audio Settings', exact: true }).click()
  const setting = page.getByLabel('Show Bible books in Audiobooks menu', { exact: true })
  await expect(setting).not.toBeChecked()
  await setting.check()
  await page.reload()
  await expect(setting).toBeChecked()
  await page.goto('/#/audio?kind=audiobook')
  await expect(shelf.locator('article')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Resume Genesis', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Bible', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'BSB Audio Bible', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Browse BSB books' }).click()
  await page.getByLabel('Search audio library').fill('Genesis')
  await expect(page.getByRole('heading', { name: 'Genesis', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Audio Settings', exact: true }).click()
  await setting.uncheck()
  await page.reload()
  await expect(setting).not.toBeChecked()
  await page.goto('/#/audio')
  await expect(shelf.locator('article')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Bible', exact: true })).toHaveCount(0)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('heritage-audio-progress-v1')))
  expect(saved.positions[track.id]).toBe(37)
  expect(saved.positions['bsb-hays-01-001']).toBe(43)
})
