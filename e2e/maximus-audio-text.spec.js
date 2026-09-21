import { test, expect } from '@playwright/test'
import data from '../public/data/audio/books/maximus-cosmic-mystery.json' with { type: 'json' }
const id = 'lv-b61af91e3bbc5c0154f8cc06'
const recording = data.tracks[id]

for (const [part, after] of [['opening', 60], ['middle', 1200], ['closing', 2300]]) {
  test(`Maximus ${part} opens the matching internal paragraph on the first visit and reload`, async ({ page }) => {
    const span = recording.spans.find(span => span.start > after && span.end - span.start > 2)
    expect(span).toBeTruthy()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/#/resources/books/maximus-cosmic-mystery?audioTrack=${id}&at=${Math.ceil(span.start)}`)
    const marked = page.locator('[data-audio-paragraph="true"]')
    await expect(marked).toHaveCount(1)
    await expect(marked).toBeFocused()
    await expect(marked).toBeInViewport()
    await expect(marked).toContainText(data.paragraphs[span.paragraph].text.slice(0, 75))
    await expect(page.getByText('William R. Clark, 1896 · Audio text', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play book audio', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`${part}-phone.png`) })
    await page.reload()
    await expect(marked).toBeFocused()
    await expect(marked).toBeInViewport()
  })
}

test('existing Maximus listening progress opens nearby text and survives a timing failure', async ({ page }) => {
  const span = recording.spans.find(span => span.start > 1200 && span.end - span.start > 2)
  const position = Math.ceil(span.start)
  await page.addInitScript(({ id, position }) => {
    if (!localStorage.getItem('heritage-audio-progress-v1')) localStorage.setItem('heritage-audio-progress-v1', JSON.stringify({ lastTrackId: id, positions: { [id]: position }, rate: 1 }))
  }, { id, position })
  await page.goto('/#/settings/audio')
  const player = page.getByRole('region', { name: 'Audio player', exact: true })
  await player.getByRole('button', { name: 'Go to nearby text', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`maximus-cosmic-mystery\\?audioTrack=${id}`))
  await expect(page.locator('[data-audio-paragraph="true"]')).toBeInViewport()
  await page.route('**/data/audio/books/maximus-cosmic-mystery.json', route => route.abort('internetdisconnected'))
  await page.goto('/#/settings/audio')
  await page.reload()
  await expect(player.getByLabel('Audio position', { exact: true })).toHaveValue(String(position))
  await player.getByRole('button', { name: 'Open book text', exact: true }).click()
  await expect(page).toHaveURL(/#\/resources\/books\/maximus-cosmic-mystery$/)
  await expect(page.getByRole('button', { name: 'Play book audio', exact: true })).toBeVisible()
  await expect(page.locator('[data-audio-paragraph="true"]')).toHaveCount(0)
})
