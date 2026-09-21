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
  await player.getByRole('button', { name: 'Go to nearby text' }).click()
  await expect(page).toHaveURL(/resources\/books\/martyrdom-of-polycarp-lake\?audioTrack=/)
  const marked = page.locator('[data-audio-paragraph="true"]')
  await expect(marked).toHaveCount(1)
  await expect(marked).toBeInViewport()
  await expect(marked).toBeFocused()
  await expect(marked).toContainText(paragraph.text.replace(/\[\d+\]/g, '').slice(0, 55))
  await expect(page.getByRole('button', { name: 'Play book audio' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('automatic paragraph match')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('nearby-text-phone.png'), fullPage: false })
  await page.reload()
  await expect(marked).toBeInViewport()
})
test('audio editions keep earlier text and bookmarks separate, including direct-link reloads', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('heritage-resource-bookmarks')) localStorage.setItem('heritage-resource-bookmarks', JSON.stringify([
      { id: 'prior-bookmark', resourceId: 'tertullian-apology', title: "Tertullian's Apology", chapterIndex: 2, chapterLabel: 'Chapter 3' },
    ]))
    if (!localStorage.getItem('heritage-reader-progress')) localStorage.setItem('heritage-reader-progress', JSON.stringify({ resources: { 'tertullian-apology': { chapterIndex: 2, chapterLabel: 'Chapter 3' } } }))
  })
  const { default: apology } = await import('../public/data/audio/books/tertullian-apology.json', { with: { type: 'json' } })
  const [id, recording] = Object.entries(apology.tracks)[1]
  const matched = recording.spans.find(span => span.start > 100)
  await page.goto(`/#/resources/books/tertullian-apology-dodgson?audioTrack=${id}&at=${Math.round(matched.start + 1)}`)
  await expect(page.locator('[data-audio-paragraph="true"]')).toBeInViewport()
  await page.getByRole('button', { name: '☆ Section', exact: true }).click()
  const bookmarks = await page.evaluate(() => JSON.parse(localStorage.getItem('heritage-resource-bookmarks')))
  expect(bookmarks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'prior-bookmark', resourceId: 'tertullian-apology', chapterIndex: 2 }),
    expect.objectContaining({ resourceId: 'tertullian-apology-dodgson', chapterIndex: apology.paragraphs[matched.paragraph].chapterIndex }),
  ]))
  await page.reload()
  await expect(page.locator('[data-audio-paragraph="true"]')).toBeInViewport()
  await expect(page.getByRole('button', { name: '★ Section', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Read S. Thelwall, 1869', exact: true }).click()
  await expect(page).toHaveURL(/#\/resources\/books\/tertullian-apology$/)
  await expect(page.getByRole('button', { name: 'Read Charles Dodgson, 1842 · Audio text', exact: true })).toBeVisible()
  await expect(page.locator('[data-audio-paragraph="true"]')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('heritage-reader-progress')).resources['tertullian-apology'].chapterIndex)).toBe(2)
})
test('failed timing request keeps the recording and plain book navigation usable', async ({ page }) => {
  await page.route('**/data/audio/books/**', route => route.abort('internetdisconnected'))
  await page.goto('/#/audio')
  const player = page.getByRole('region', { name: 'Audio player', exact: true })
  await expect(player.getByRole('button', { name: 'Open book text' })).toBeVisible()
  await player.getByRole('button', { name: 'Open book text' }).click()
  await expect(page).toHaveURL(/resources\/books\/martyrdom-of-polycarp/)
  await expect(page.getByRole('button', { name: 'Play book audio' })).toBeVisible()
  await expect(page.locator('[data-audio-paragraph="true"]')).toHaveCount(0)
})
test('the final Institutes recording opens Book IV in the completed text', async ({ page }) => {
  const { default: data } = await import('../public/data/audio/books/institutes.json', { with: { type: 'json' } })
  const [id, recording] = Object.entries(data.tracks).at(-1)
  const span = recording.spans.find(span => span.start > 1000)
  const paragraph = data.paragraphs[span.paragraph]
  expect(paragraph.title).toMatch(/^BOOK IV\./)
  await page.goto(`/#/resources/books/institutes-allen-complete?audioTrack=${id}&at=${Math.ceil(span.start)}`)
  const marked = page.locator('[data-audio-paragraph="true"]')
  await expect(marked).toBeFocused()
  await expect(marked).toBeInViewport()
  await expect(marked).toContainText(paragraph.text.slice(0, 60))
  await page.reload()
  await expect(marked).toBeFocused()
})

test('a playing audiobook follows the next paragraph across a chapter boundary by default', async ({ page }) => {
  // Real media clock; this fixture crosses chapter 2 -> 3 at 68.86 seconds.
  const wave = Buffer.alloc(44 + 400 * 8000 * 2)
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8)
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22)
  wave.writeUInt32LE(8000, 24); wave.writeUInt32LE(16000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34)
  wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40)
  await page.route('https://archive.org/download/**', route => {
    const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/)
    const start = Number(range?.[1] || 0), end = range?.[2] ? Math.min(Number(range[2]), wave.length - 1) : wave.length - 1
    return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wave.subarray(start, end + 1), headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wave.length}` } : {}) } })
  })
  await page.goto('/#/settings/audio')
  await expect(page.getByLabel('Auto-scroll audiobooks')).toBeChecked()
  const player = page.getByRole('region', { name: 'Audio player', exact: true })
  await player.getByLabel('Audio position', { exact: true }).fill('65')
  await player.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await player.getByRole('button', { name: 'Go to nearby text' }).click()
  const marked = page.locator('[data-audio-paragraph="true"]')
  await expect(marked).toContainText(timing.paragraphs['2:0'].text.slice(0, 45))
  await expect(marked).toContainText(timing.paragraphs['3:0'].text.slice(0, 45), { timeout: 10000 })
  await expect(marked).toBeInViewport()
  await page.getByRole('button', { name: 'Pause book audio' }).click()
  await expect(page.getByRole('button', { name: 'Play book audio' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Audio player' })).toHaveCount(0)
})
