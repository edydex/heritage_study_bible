import { expect, test } from '@playwright/test'

async function pressVolume(page, direction, count = 1) {
  await page.evaluate(({ direction, count }) => {
    for (let index = 0; index < count; index += 1) {
      window.dispatchEvent(new CustomEvent('heritage:native-scroll', { detail: { direction } }))
    }
  }, { direction, count })
}

async function openCommentary(page) {
  await page.goto('/#/daniel/11', { waitUntil: 'networkidle' })
  await expect(page.locator('#verse-11-36 [data-verse-content]')).toBeVisible()
  await page.locator('#verse-11-36 [data-verse-content]').click()
  const pane = page.getByRole('complementary', { name: 'Commentary', exact: true })
  await expect(pane.getByRole('button', { name: 'Expand commentary', exact: true })).toBeVisible()
  await pane.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
  const reader = page.getByRole('region', { name: 'Commentary text', exact: true })
  await expect(reader.locator('[data-commentary-entry="11:36"] [data-reader-text]').first()).toBeVisible()
  // Auto-positioning on verse selection uses a smooth scroll; finish it before
  // testing button movement independently.
  await reader.evaluate(async element => {
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    const section = element.querySelector('[data-commentary-entry="11:36"]')
    const top = section.getBoundingClientRect().top - element.getBoundingClientRect().top + element.scrollTop
    element.scrollTo({ top, behavior: 'instant' })
  })
  return { pane, reader }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-side-button-scroll', 'true')
    localStorage.setItem('heritage-commentary-text-size', '22')
    localStorage.setItem('heritage-advanced-settings', JSON.stringify({ volumeScrollAnimationMs: 0 }))
  })
})

for (const viewport of [{ width: 412, height: 915 }, { width: 1440, height: 1000 }]) {
  test(`commentary owns volume scrolling and expands at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    const { pane, reader } = await openCommentary(page)
    const bibleTop = await page.evaluate(() => window.scrollY)
    const startTop = await reader.evaluate(element => element.scrollTop)

    await pressVolume(page, 'down')
    await expect.poll(() => reader.evaluate(element => element.scrollTop)).toBeGreaterThan(startTop)
    const downTop = await reader.evaluate(element => element.scrollTop)
    expect(await page.evaluate(() => window.scrollY)).toBe(bibleTop)

    await pressVolume(page, 'up')
    await expect.poll(() => reader.evaluate(element => element.scrollTop)).toBeLessThan(downTop - 100)
    expect(await page.evaluate(() => window.scrollY)).toBe(bibleTop)

    const originalHeight = await reader.evaluate(element => element.clientHeight)
    await page.screenshot({ path: testInfo.outputPath(`commentary-${viewport.width}-pane.png`) })
    await pane.getByRole('button', { name: 'Expand commentary', exact: true }).click()
    await expect(pane).toHaveAttribute('data-commentary-expanded', 'true')
    await expect(pane.getByTitle('Compare translations')).toBeHidden()
    await expect.poll(() => reader.evaluate(element => element.clientHeight)).toBeGreaterThan(originalHeight + 100)
    expect((await pane.boundingBox()).width).toBe(viewport.width)
    await expect(reader.locator('[data-commentary-entry="11:36"] [data-reader-text]').first()).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`commentary-${viewport.width}-expanded.png`) })

    const expandedTop = await reader.evaluate(element => element.scrollTop)
    await pressVolume(page, 'down')
    await expect.poll(() => reader.evaluate(element => element.scrollTop)).toBeGreaterThan(expandedTop)
    const marker = page.locator('#heritage-volume-scroll-marker')
    await expect(marker).toBeVisible()
    const markerBox = await marker.boundingBox()
    const readerBox = await reader.boundingBox()
    expect(markerBox.y).toBeGreaterThan(readerBox.y)
    expect(markerBox.y).toBeLessThan(readerBox.y + readerBox.height)
    expect(await page.evaluate(() => window.scrollY)).toBe(bibleTop)

    // At commentary's end, repeated down presses must never invoke Scripture's
    // next chapter / reading-plan shortcut.
    await reader.evaluate(element => { element.scrollTop = element.scrollHeight })
    await pressVolume(page, 'down', 3)
    await expect(page).toHaveURL(/#\/daniel\/11$/)
    expect(await page.evaluate(() => window.scrollY)).toBe(bibleTop)

    await pane.getByRole('button', { name: 'Restore commentary pane' }).click()
    await expect(pane).toHaveAttribute('data-commentary-expanded', 'false')
    await expect(pane.getByRole('button', { name: 'Expand commentary', exact: true })).toBeVisible()
    await pane.getByRole('button', { name: 'Expand commentary', exact: true }).click()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('heritage:native-back', { cancelable: true })))
    await expect(pane).toHaveAttribute('data-commentary-expanded', 'false')
    await pane.getByRole('button', { name: 'Expand commentary', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(pane).toHaveAttribute('data-commentary-expanded', 'false')

    await pane.getByRole('button', { name: 'Close commentary' }).click()
    await expect(pane).toBeHidden()
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }))
    await pressVolume(page, 'down')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
  })
}

test('short or empty commentary and its dialogs never scroll the Bible behind them', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 })
  const { pane, reader } = await openCommentary(page)
  const bibleTop = await page.evaluate(() => window.scrollY)
  const commentaryTop = await reader.evaluate(element => element.scrollTop)

  await pane.getByTitle('Compare translations').click()
  await expect(reader).toHaveAttribute('data-native-scroll-disabled', 'true')
  await pressVolume(page, 'down')
  expect(await reader.evaluate(element => element.scrollTop)).toBe(commentaryTop)
  expect(await page.evaluate(() => window.scrollY)).toBe(bibleTop)
  await page.keyboard.press('Escape')
  await expect(reader).toHaveAttribute('data-native-scroll-disabled', 'false')

  await pane.getByTitle('Add notes').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await pressVolume(page, 'down')
  expect(await reader.evaluate(element => element.scrollTop)).toBe(commentaryTop)
  expect(await page.evaluate(() => window.scrollY)).toBe(bibleTop)
  await page.keyboard.press('Escape')

  await pane.getByRole('button', { name: /John Calvin/ }).click()
  await page.getByPlaceholder('Search authors...').fill('Gavin Ortlund')
  await pane.getByRole('button', { name: /Gavin Ortlund/ }).click()
  await expect(reader).toContainText('No commentary available')
  await pressVolume(page, 'down', 3)
  expect(await page.evaluate(() => window.scrollY)).toBe(bibleTop)
  await expect(page).toHaveURL(/#\/daniel\/11$/)
})
