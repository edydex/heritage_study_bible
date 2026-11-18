import { test, expect } from '@playwright/test'
async function enable(page) {
  await page.goto('/#/romans/1')
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('heritage-translation', 'BSB'); localStorage.setItem('heritage-default-translation-v2', 'done') })
})
test('tap visibly highlights both columns and hold opens real Greek word study', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enable(page)
  const servant = page.locator('#verse-1-1 [data-translation="BSB"] [data-word-link="1:1:1"]:visible').filter({ hasText: 'servant' })
  await expect(servant).toBeVisible()
  await servant.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText('δοῦλος ↔ a servant')
  await expect(page.locator('.bible-word-link-active:visible')).toHaveCount(3)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Word study: servant' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('δοῦλος (II) G1401')
  await expect(dialog).toContainText('Matthew')
  const example = dialog.getByRole('button', { name: /^Matthew 8:9/ })
  await expect(example.locator('[data-occurrence-translation=BSB]')).toContainText('BSB · “servant”')
  await expect(example.locator('[data-occurrence-translation=BSB] mark')).toHaveText('servant')
  await expect(example).toContainText('For I myself am a man under authority')
  await dialog.getByRole('button', { name: 'Close word study' }).click()
  await servant.click({ delay: 600 })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close word study' }).click()
  await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText('δοῦλος ↔ a servant')
  await expect(page.locator('.bible-word-link-active:visible')).toHaveCount(3)
  await page.getByRole('button', { name: 'Clear word match' }).click()
  await servant.press('Shift+Enter')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close word study' }).click()
  await page.getByRole('button', { name: 'Clear word match' }).click()
  await page.getByTitle('Text size settings').click()
  await page.getByRole('button', { name: 'More settings', exact: true }).click()
  await page.getByLabel('B&W', { exact: true }).check()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  // Re-enter session-only parallel mode after returning from settings.
  await enable(page)
  await expect(page.locator('.word-links-monochrome')).toBeVisible()
  await expect(servant).toHaveCSS('background-image', /M-1/)
  await page.screenshot({ path: test.info().outputPath('parallel-patterns-phone.png') })
  await page.reload()
  await page.getByTitle('Text size settings').click()
  await page.getByRole('button', { name: 'More settings', exact: true }).click()
  await expect(page.getByLabel('B&W', { exact: true })).toBeChecked()
})
test('occurrence links navigate on the first click and unsupported matching remains explicit', async ({ page }) => {
  await enable(page)
  await page.locator('#verse-1-1 [data-translation="ORIGINAL"] [data-word-link="1:1:0"]:visible').click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Word study: Παῦλος' })
  await expect(dialog).toContainText('Greek New Testament · Nestle 1904')
  await dialog.getByRole('button', { name: /^Acts 13:9/ }).click()
  await expect(page).toHaveURL(/#\/acts\/13$/)
  await expect(page.locator('#verse-13-9')).toBeInViewport()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // The same source-backed lookup also works from English outside Romans,
  // even when the user disables the visual word-link colors.
  await page.getByLabel('Word links', { exact: true }).uncheck()
  const paul = page.locator('#verse-13-9 [data-translation="BSB"] [role="button"]:visible').filter({ hasText: /^Paul$/ })
  await paul.click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Word study: Paul' })).toContainText('Occurrences of the source lemma')
})

test('word occurrences show contextual translations on later pages and retain source verses on mapping failure', async ({ page }) => {
  let mappingUnavailable = true
  await page.route('**/bsb-word-links/matthew.json', async route => {
    if (mappingUnavailable) return route.fulfill({ status: 503, body: 'Temporarily unavailable' })
    const response = await route.fetch()
    const mapping = await response.json()
    // Exercise an absent match deliberately as the reviewed corpus grows.
    delete mapping.verses['18:27']
    await route.fulfill({ response, json: mapping })
  })
  // Grammar and translation requests have independent status messages.
  await page.route('**/greek-morphology-pilot.json', route => route.fulfill({ status: 503, body: 'Temporarily unavailable' }))
  const requested = []
  page.on('request', request => { if (request.url().includes('/bsb-word-links/')) requested.push(request.url()) })
  await enable(page)
  await page.locator('#verse-1-1 [data-translation="BSB"] [data-word-link="1:1:1"]:visible').filter({ hasText: 'servant' }).click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Word study: servant' })
  const first = dialog.getByRole('button', { name: /^Matthew 8:9/ })
  await expect(dialog.getByRole('status').filter({ hasText: 'Some BSB wording or word mappings could not load' })).toBeVisible()
  await expect(dialog.getByRole('status').filter({ hasText: 'The grammar could not load' })).toBeVisible()
  await expect(first).toContainText('For I myself am a man under authority')
  await expect(first).toContainText('Greek · N1904')
  await expect(first.locator('[data-occurrence-translation=BSB] mark')).toHaveCount(0)
  expect(requested.some(url => url.endsWith('/revelation.json'))).toBe(false)
  mappingUnavailable = false
  await dialog.getByRole('button', { name: 'Retry translations' }).click()
  await expect(first.locator('[data-occurrence-translation=BSB] mark')).toHaveText('servant')
  const unmapped = dialog.getByRole('button', { name: /^Matthew 18:27/ })
  await expect(unmapped).toContainText('Exact word mapping unavailable')
  await expect(unmapped.locator('[data-occurrence-translation=BSB] mark')).toHaveCount(0)
  const romans = dialog.getByRole('button', { name: /^Romans 6:19/ })
  for (let pageNumber = 0; pageNumber < 5 && await romans.count() === 0; pageNumber++) {
    await dialog.getByRole('button', { name: 'Show more' }).click()
  }
  await expect(romans.locator('[data-occurrence-translation=BSB]')).toContainText('BSB · “in slavery”')
  await expect(romans.locator('[data-occurrence-translation=BSB] mark')).toHaveText(['in slavery', 'in slavery'])
  await page.screenshot({ path: test.info().outputPath('word-occurrence-translations.png') })
  await dialog.getByRole('button', { name: 'Close word study' }).click()
  await page.context().setOffline(true)
  await page.locator('#verse-1-1 [data-translation="BSB"] [data-word-link="1:1:1"]:visible').filter({ hasText: 'servant' }).click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /^Matthew 8:9/ }).locator('[data-occurrence-translation=BSB] mark')).toHaveText('servant')
})

for (const translation of ['LSV', 'KJV']) {
  test(`BSB and ${translation} highlight the same checked Greek source anchor without an Original column`, async ({ page }) => {
    const displayedName = translation === 'KJV' ? 'PAUL' : 'Paul'
    await page.goto('/#/romans/1')
    await page.getByTitle('Enable parallel mode', { exact: true }).click()
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await page.getByRole('button', { name: new RegExp(`^${translation} (Selected )?`) }).click()
    const paul = page.locator('#verse-1-1 [data-translation="BSB"] [data-word-paired="true"]:visible').filter({ hasText: /^Paul$/ })
    await expect(paul).toBeVisible()
    await paul.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const match = page.getByRole('region', { name: 'Selected word match' })
    await expect(match).toContainText('Παῦλος')
    await expect(match).toContainText(`${translation}: ${displayedName}`)
    await expect(page.locator('.bible-word-link-active:visible')).toHaveCount(2)
    const translated = page.locator(`#verse-1-1 [data-translation="${translation}"] .bible-word-link-active:visible`)
    await expect(translated).toHaveText(displayedName)
    await translated.click()
    await page.getByRole('button', { name: 'Study word', exact: true }).click()
    await expect(page.getByRole('dialog', { name: `Word study: ${displayedName}` })).toContainText('Occurrences of the source lemma')
    await page.getByRole('button', { name: 'Close word study' }).click()
    await expect(translated).toHaveClass(/bible-word-link-active/)
  })
}

test.describe('touch word interactions', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  test('finger tap selects both columns, a long hold studies the word, and vertical swipes still scroll', async ({ page }) => {
    await enable(page)
    const word = page.locator('#verse-1-1 [data-translation="ORIGINAL"] [data-word-link="1:1:0"]:visible')
    await word.tap()
    await expect(page.locator('.bible-word-link-active:visible')).toHaveCount(2)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Clear word match' }).tap()
    await word.scrollIntoViewIfNeeded()
    const box = await word.boundingBox()
    const touch = await page.context().newCDPSession(page)
    const x = box.x + box.width / 2, y = box.y + box.height / 2
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
      // Hold beyond the browser's usual long-press threshold. A later pointer
      // cancellation must not undo the already completed word-study action.
      await page.waitForTimeout(700)
      await expect(page.getByRole('dialog', { name: 'Word study: Παῦλος' })).toBeVisible()
    } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
    await page.getByRole('button', { name: 'Close word study' }).tap()
    await expect(page.locator('.bible-word-link-active:visible')).toHaveCount(2)
    await page.getByRole('button', { name: 'Clear word match' }).tap()
    await word.scrollIntoViewIfNeeded()
    const start = await word.boundingBox(), before = await page.evaluate(() => window.scrollY)
    const sx = start.x + start.width / 2, sy = start.y + start.height / 2
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 2 }] })
    for (let step = 1; step <= 5; step++) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - step * 20, id: 2 }] })
      await page.waitForTimeout(20)
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(500)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Selected word match' })).toHaveCount(0)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 30)
    await touch.detach()
  })
})
