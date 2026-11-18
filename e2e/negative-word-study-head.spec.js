import { expect, test } from '@playwright/test'

const words = (page, translation, chapter, verse, text) => page
  .locator(`#verse-${chapter}-${verse} [data-translation="${translation}"] [data-word-link]:visible`)
  .filter({ hasText: text })

async function compareWithOriginal(page, book, chapter, translation) {
  await page.addInitScript(id => {
    localStorage.setItem('heritage-translation', id)
    localStorage.setItem('heritage-default-translation-v2', 'done')
  }, translation)
  await page.goto(`/#/${book}/${chapter}`)
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
  await expect(page.locator(`[data-translation="${translation}"] [data-word-paired="true"]:visible`).first()).toBeVisible()
}

async function expectStudyHead(page, strong) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText(new RegExp(`\\bG0*${strong}\\b`))
}

test('immersing opens its actual verb while Original still opens the exact negative', async ({ page }) => {
  await compareWithOriginal(page, 'john', 4, 'LSV')
  const immersing = words(page, 'LSV', 4, 2, /^immersing$/)
  await expect(immersing).toHaveCount(1)
  await expect(immersing).toHaveAttribute('data-word-paired', 'true')
  await immersing.click()
  await expect(words(page, 'ORIGINAL', 4, 2, /^οὐκ$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 4, 2, /^ἐβάπτιζεν$/)).toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '907')

  await page.getByRole('button', { name: 'Close word study', exact: true }).click()
  await words(page, 'ORIGINAL', 4, 2, /^οὐκ$/).click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '3756')
})

test('never keeps the actual negative first and Original pote keeps its own entry', async ({ page }) => {
  await compareWithOriginal(page, '2-peter', 1, 'LSV')
  await words(page, 'LSV', 1, 10, /^never$/).click()
  for (const source of [/^οὐ$/, /^μὴ$/, /^ποτε$/]) {
    await expect(words(page, 'ORIGINAL', 1, 10, source)).toHaveClass(/bible-word-link-active/)
  }
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '3756')

  await page.getByRole('button', { name: 'Close word study', exact: true }).click()
  await words(page, 'ORIGINAL', 1, 10, /^ποτε$/).click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '4218')
})

test('BSB without opens the actual negative in its coordinated source phrase', async ({ page }) => {
  await compareWithOriginal(page, '2-john', 1, 'BSB')
  await words(page, 'BSB', 1, 9, /^without$/).click()
  await expect(words(page, 'ORIGINAL', 1, 9, /^καὶ$/).first()).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 1, 9, /^μὴ$/)).toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '3361')
})

test('KJV neither opens its actual second prohibition rather than the conjunction', async ({ page }) => {
  await compareWithOriginal(page, '2-john', 1, 'KJV')
  const negatives = words(page, 'ORIGINAL', 1, 10, /^μὴ$/)
  await expect(negatives).toHaveCount(2)
  await words(page, 'KJV', 1, 10, /^neither$/).click()
  await expect(negatives.nth(1)).toHaveClass(/bible-word-link-active/)
  await expect(negatives.nth(0)).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '3361')
})

test.describe('negative-aware word study on an emulated phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('a native hold opens immersing, survives release, and preserves exact Original negative study', async ({ page }) => {
    await compareWithOriginal(page, 'john', 4, 'LSV')
    const immersing = words(page, 'LSV', 4, 2, /^immersing$/)
    await expect(immersing).toHaveCount(1)
    await immersing.scrollIntoViewIfNeeded()
    const box = await immersing.boundingBox()
    expect(box).not.toBeNull()
    const touch = await page.context().newCDPSession(page)
    try {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
      })
      await expectStudyHead(page, '907')
    } finally {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch.detach()
    }
    await page.waitForTimeout(750)
    await expectStudyHead(page, '907')

    await page.getByRole('button', { name: 'Close word study', exact: true }).tap()
    await words(page, 'ORIGINAL', 4, 2, /^οὐκ$/).tap()
    await page.getByRole('button', { name: 'Study word', exact: true }).tap()
    await expectStudyHead(page, '3756')
  })
})
