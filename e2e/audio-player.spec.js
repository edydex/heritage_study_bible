import { test, expect } from '@playwright/test'
import catalog from '../src/data/audioCatalog.json' with { type: 'json' }

const track = catalog.books[0].editions[0].tracks[0]
// Real, local WAV media keeps browser tests deterministic and makes no network
// request for copyrighted or metered audio. HTMLMediaElement itself is not mocked.
const samples = 180 * 8000
const wave = Buffer.alloc(44 + samples * 2)
wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8)
wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22)
wave.writeUInt32LE(8000, 24); wave.writeUInt32LE(16000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34)
wave.write('data', 36); wave.writeUInt32LE(samples * 2, 40)

test.beforeEach(async ({ page }) => {
  await page.route('https://archive.org/download/**', route => {
    const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/)
    const start = Number(range?.[1] || 0)
    const end = range?.[2] ? Math.min(Number(range[2]), wave.length - 1) : wave.length - 1
    return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wave.subarray(start, end + 1), headers: {
      'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wave.length}` } : {}),
    } })
  })
})

test('internal player keeps exact position across routes and reload, without autoplay on reopen', async ({ page }) => {
  await page.goto('/#/resources/books/josephus-wars')
  await page.getByRole('button', { name: 'Listen from the beginning' }).click()
  await page.getByRole('button', { name: 'Audio library', exact: true }).click()
  const player = page.getByRole('region', { name: 'Audio player', exact: true })
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await player.getByLabel('Audio position', { exact: true }).fill('47')
  await player.getByRole('button', { name: 'Pause', exact: true }).click()
  await player.getByLabel('Playback speed').selectOption('1.5')
  await player.getByRole('button', { name: 'Audio library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Audio library', exact: true })).toBeVisible()
  await expect(player.getByLabel('Audio position', { exact: true })).toHaveValue(/^4[7-9]/)
  await page.reload()
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)
  await expect(player.getByLabel('Audio position', { exact: true })).toHaveValue(/^4[7-9]/)
  await expect(player.getByLabel('Playback speed')).toHaveValue('1.5')
  await player.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(player.getByLabel('Audio position', { exact: true })).toHaveValue(/^4[7-9]/)
})

test('failed audio fetch leaves saved track and timestamp available to retry', async ({ page }) => {
  await page.addInitScript(({ id }) => localStorage.setItem('heritage-audio-progress-v1', JSON.stringify({ lastTrackId: id, positions: { [id]: 73 }, rate: 1 })), { id: track.id })
  await page.route('https://archive.org/download/**', route => route.abort('internetdisconnected'))
  await page.goto('/#/audio')
  const player = page.getByRole('region', { name: 'Audio player', exact: true })
  await player.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player.getByRole('status')).toContainText('Your saved position is kept')
  await expect(player.locator('.audio-player-title')).toContainText('1:13')
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('phone player and Internal Storage remain usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(({ id }) => localStorage.setItem('heritage-audio-progress-v1', JSON.stringify({ lastTrackId: id, positions: { [id]: 73 }, rate: 1 })), { id: track.id })
  await page.goto('/#/genesis/1')
  await expect(page.getByRole('region', { name: 'Audio player', exact: true })).toHaveCount(0)
  await expect(page.locator('.reader-bottom-nav')).toBeVisible()
  await page.getByTitle('Text size settings').click()
  await page.getByRole('button', { name: 'Audio Settings', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible()
  await page.getByRole('button', { name: 'Internal Storage', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Internal Storage' })).toBeVisible()
  await expect(page.getByText('Offline audio downloads are available in the Android app. Browser playback streams the recording.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('audio-storage-phone.png'), fullPage: true })
})
