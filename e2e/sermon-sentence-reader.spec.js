import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { serializePublicSermonDetail, serializePublicSermonCatalog } from '../src/services/sermonCatalog.js'
const fixture = JSON.parse(readFileSync(new URL('../tests/fixtures/community-sermon-publication-conformance-v1.json', import.meta.url), 'utf8'))
const detail = JSON.parse(fixture.detailSource), catalog = JSON.parse(fixture.catalogSource)
const captionUrl = 'https://media.example.church/sermons/prayer.vtt'
detail.body[0].text = 'First sentence.\n\nSecond sentence.'
detail.media.push({ kind: 'transcript', title: 'Timed transcript', language: 'en', mediaType: 'text/vtt', durationSeconds: null, url: captionUrl })
const detailSource = await serializePublicSermonDetail(detail)
catalog.items[0].checksum = createHash('sha256').update(detailSource).digest('hex')
const server = { manifestUrl: 'https://church.example/heritage-content.json', enabled: true, lastCheckedAt: '2026-07-29T20:15:30.000Z', manifest: {
  schemaVersion: 2, kind: 'heritage-content-server', id: 'example-church', name: 'Example Church', publications: { sermons: {
    schemaVersion: 1, kind: 'heritage-public-sermon-publication', catalog: { url: '/publications/sermons/catalog.json', mediaType: 'application/json' },
    detailMediaType: 'application/vnd.heritage.sermon+json', passageIndex: { url: '/indexes/sermon-passages', mediaType: 'application/json' },
  } },
} }
test('sermon sentences seek the real media clock and share Bible playback controls', async ({ page }) => {
  await page.addInitScript(server => { localStorage.setItem('heritage-content-servers-v2', JSON.stringify([server])); localStorage.setItem('heritage-dark-mode', 'true') }, server)
  await page.route('https://church.example/publications/sermons/catalog.json', async route => route.fulfill({ body: await serializePublicSermonCatalog(catalog), headers: { 'Content-Type': 'application/json; charset=utf-8' } }))
  await page.route(`https://church.example${catalog.items[0].content.url}`, route => route.fulfill({ body: detailSource, headers: { 'Content-Type': 'application/vnd.heritage.sermon+json; charset=utf-8' } }))
  let captionRequests = 0
  await page.route(captionUrl, route => { captionRequests++; return route.fulfill({ body: 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nFirst sentence.\n\n00:00:10.000 --> 00:00:30.000\nSecond sentence.', contentType: 'text/vtt' }) })
  const wave = Buffer.alloc(44 + 40 * 8000 * 2)
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8)
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22)
  wave.writeUInt32LE(8000, 24); wave.writeUInt32LE(16000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34)
  wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40)
  await page.route(detail.media[0].url, route => {
    const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/)
    const start = Number(range?.[1] || 0), end = range?.[2] ? Math.min(Number(range[2]), wave.length - 1) : wave.length - 1
    return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wave.subarray(start, end + 1), headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wave.length}` } : {}) } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/#/resources/sermons/example-church/${detail.publicId}`)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(dialog.getByText('First sentence. Second sentence.')).toBeVisible()
  expect(captionRequests).toBe(0)
  await dialog.getByLabel('Verse scroll mode').check()
  await expect(dialog.getByLabel('Follow audio')).toBeChecked()
  const second = dialog.getByRole('button', { name: 'Play from: Second sentence.' })
  await second.click()
  await expect(second).toHaveAttribute('data-audio-sentence', 'true')
  await expect.poll(() => page.getByLabel('Play Sermon audio (EN)').evaluate(audio => audio.currentTime)).toBeGreaterThanOrEqual(10)
  await expect(dialog.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Rewind 10 seconds' }).scrollIntoViewIfNeeded()
  await expect(dialog.getByLabel('Playback speed')).toBeVisible()
  await dialog.getByLabel('Playback speed').selectOption('1.25')
  expect(await page.getByLabel('Play Sermon audio (EN)').evaluate(audio => audio.playbackRate)).toBe(1.25)
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click()
  await second.scrollIntoViewIfNeeded()
  await page.screenshot({ path: test.info().outputPath('sermon-sentences-phone.png') })
})
