import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
const timing = JSON.parse(readFileSync('public/data/audio/bsb-hays/romans.json', 'utf8')).chapters[1]
const first = timing.verses[0], late = timing.verses.find(span => span.verse >= 25)
const wave = Buffer.alloc(44 + 360 * 8000 * 2)
wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8)
wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22)
wave.writeUInt32LE(8000, 24); wave.writeUInt32LE(16000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34)
wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('heritage-translation', 'BSB'); localStorage.setItem('heritage-default-translation-v2', 'done') })
  await page.route('https://openbible.com/audio/hays/**', route => {
    const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/)
    const start = Number(range?.[1] || 0), end = range?.[2] ? Math.min(Number(range[2]), wave.length - 1) : wave.length - 1
    return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wave.subarray(start, end + 1), headers: {
      'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wave.length}` } : {}),
    } })
  })
})

async function settings(page) {
  await page.getByTitle('Text size settings').click()
  await page.getByRole('button', { name: 'More settings', exact: true }).click()
  await page.getByRole('button', { name: /^Audio Settings/ }).click()
  await expect(page.getByRole('heading', { name: 'Audio Settings' })).toBeVisible()
}
test('compact chapter playback seeks by verse, defaults to following and keeps annotations untouched', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/romans/1')
  const before = await page.evaluate(() => Object.fromEntries(['bible-study-bookmarks', 'bible-study-commentary-bookmarks', 'bible-study-notes', 'bible-study-highlights'].map(key => [key, JSON.parse(localStorage.getItem(key) || '[]')])))
  await page.getByRole('button', { name: 'Play chapter audio' }).click()
  await expect(page.getByRole('button', { name: 'Pause chapter audio' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Audio player' })).toHaveCount(0)
  await expect(page.locator('.bible-audio-controls')).toHaveCount(0)
  await page.locator(`#verse-1-${late.verse} [data-verse-content]`).click()
  await expect(page.locator('[data-audio-active="true"]')).toHaveAttribute('data-verse', String(late.verse))
  await expect(page.locator('[data-audio-active="true"]')).toBeInViewport()
  await page.getByRole('button', { name: 'Pause chapter audio' }).click()
  await settings(page)
  await expect(page.getByLabel('Auto-scroll Bible recordings')).toBeChecked()
  await expect(page.getByLabel('Auto-scroll audiobooks')).toBeChecked()
  const player = page.getByRole('region', { name: 'Audio player', exact: true })
  await expect.poll(async () => Number(await player.getByLabel('Audio position', { exact: true }).inputValue())).toBeGreaterThanOrEqual(Math.floor(late.start))
  await player.getByLabel('Audio position', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.locator('[data-audio-active="true"]')).toHaveCount(0)
  expect(await page.evaluate(() => Object.fromEntries(['bible-study-bookmarks', 'bible-study-commentary-bookmarks', 'bible-study-notes', 'bible-study-highlights'].map(key => [key, JSON.parse(localStorage.getItem(key) || '[]')])))).toEqual(before)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('compact-audio-phone.png') })
})
test('failed timing keeps playback available and settings preserve the follow preference', async ({ page }) => {
  await page.route('**/data/audio/bsb-hays/romans.json', route => route.abort())
  await page.goto('/#/romans/1')
  await page.getByRole('button', { name: 'Play chapter audio' }).click()
  await expect(page.getByRole('button', { name: 'Pause chapter audio' })).toBeVisible()
  await page.locator('#verse-1-2 [data-verse-content]').click()
  await expect(page.getByText('This verse has no verified audio position yet.')).toBeVisible()
  await expect(page.locator('[data-audio-active="true"]')).toHaveCount(0)
  await settings(page)
  await page.getByLabel('Auto-scroll Bible recordings').uncheck()
  await page.reload()
  await expect(page.getByLabel('Auto-scroll Bible recordings')).not.toBeChecked()
  await page.getByRole('button', { name: 'Browse chapters and audiobooks' }).click()
  await page.getByRole('button', { name: 'Browse BSB books' }).click()
  await page.getByLabel('Search audio library').fill('Romans')
  await page.getByRole('button', { name: 'Tracks and downloads' }).click()
  await expect(page.getByRole('button', { name: /^Play Romans/ })).toHaveCount(16)
})
test('Romans 8 plays and marks the reported verse gaps using the replacement data', async ({ page }) => {
  await page.goto('/#/romans/8')
  await page.getByRole('button', { name: 'Play chapter audio' }).click()
  for (const verse of [2, 3, 6, 7, 8]) {
    await page.locator(`#verse-8-${verse} [data-verse-content]`).click()
    await expect(page.locator('[data-audio-active="true"]')).toHaveAttribute('data-verse', String(verse))
  }
  await page.getByRole('button', { name: 'Pause chapter audio' }).click()
})
test('phone parallel playback marks only BSB, with no additional player pane', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/romans/1')
  await page.getByRole('button', { name: 'Play chapter audio' }).click()
  await page.locator(`#verse-1-${first.verse} [data-verse-content]`).click()
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original Original languages/ }).click()
  await expect(page.locator('[data-audio-active="true"]:visible')).toHaveCount(1)
  await expect(page.locator('[data-audio-active="true"]:visible')).toHaveAttribute('data-translation', 'BSB')
  await expect(page.locator('[data-translation="ORIGINAL"][data-audio-active]')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Audio player' })).toHaveCount(0)
})

test('playback advances continuously into an untimed verse without inventing a seek timestamp', async ({ page }) => {
  const chapter = JSON.parse(readFileSync('public/data/audio/bsb-hays/romans.json', 'utf8')).chapters[8]
  const eight = chapter.verses.find(span => span.verse === 8)
  await page.addInitScript(position => localStorage.setItem('heritage-audio-progress-v1', JSON.stringify({ lastTrackId: 'bsb-hays-45-008', positions: { 'bsb-hays-45-008': position }, rate: 1 })), eight.end - 0.8)
  await page.goto('/#/romans/8')
  const marked = page.locator('[data-audio-active="true"]')
  await expect(marked).toHaveAttribute('data-verse', '8')
  await page.evaluate(() => {
    window.audioReadingFrames = []
    const sample = () => {
      const verse = document.querySelector('[data-audio-active="true"]')?.getAttribute('data-verse') || null
      window.audioReadingFrames.push(verse)
      if (verse !== '9' && window.audioReadingFrames.length < 300) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.getByRole('button', { name: 'Play chapter audio' }).click()
  await expect(marked).toHaveAttribute('data-verse', '9', { timeout: 4000 })
  expect(await page.evaluate(() => window.audioReadingFrames)).not.toContain(null)
  await expect(marked).toBeInViewport()
  const verseNine = page.locator('#verse-8-9 [data-verse-content]')
  const point = await verseNine.evaluate(element => { const rect = element.getClientRects()[0]; return { x: rect.x + Math.min(20, rect.width / 2), y: rect.y + rect.height / 2 } })
  await page.mouse.click(point.x, point.y)
  await expect(page.getByText('This verse has no verified audio position yet.')).toBeVisible()
  await expect(marked).toHaveAttribute('data-verse', '9')
  await page.locator('#verse-8-10 [data-verse-content]').click()
  await expect(marked).toHaveAttribute('data-verse', '10')
  await page.getByRole('button', { name: 'Pause chapter audio' }).click()
})
