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

test('reviewed BSB Matthew keeps repeated pronouns distinct and links John to the written name', async ({ page }) => {
  await compareWithOriginal(page, 'matthew', 4, 'BSB')
  const english = words(page, 'BSB', 4, 11, /^Him$/)
  const patient = words(page, 'ORIGINAL', 4, 11, /^αὐτὸν$/)
  const recipient = words(page, 'ORIGINAL', 4, 11, /^αὐτῷ$/)
  await expect(english).toHaveCount(2)
  await english.first().click()
  await expect(patient).toHaveClass(/bible-word-link-active/)
  await expect(recipient).not.toHaveClass(/bible-word-link-active/)
  await english.last().click()
  await expect(recipient).toHaveClass(/bible-word-link-active/)
  await expect(patient).not.toHaveClass(/bible-word-link-active/)

  await expect(words(page, 'BSB', 4, 12, /^Jesus$/)).toHaveAttribute('data-word-paired', 'false')
  await words(page, 'BSB', 4, 12, /^John$/).click()
  await expect(words(page, 'ORIGINAL', 4, 12, /^Ἰωάνης$/)).toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '2491')
})

test('BSB Otherwise highlights both written particles and studies the negative first', async ({ page }) => {
  await compareWithOriginal(page, 'matthew', 5, 'BSB')
  await words(page, 'BSB', 5, 25, /^Otherwise$/).click()
  await expect(words(page, 'ORIGINAL', 5, 25, /^μή$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 5, 25, /^ποτέ$/)).toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '3361')
})

test('BSB Matthew 8 keeps the touching and speaking predicates separate', async ({ page }) => {
  await compareWithOriginal(page, 'matthew', 8, 'BSB')
  const touching = words(page, 'ORIGINAL', 8, 3, /^ἥψατο$/)
  const speaking = words(page, 'ORIGINAL', 8, 3, /^λέγων$/)
  await words(page, 'BSB', 8, 3, /^touched$/).click()
  await expect(touching).toHaveClass(/bible-word-link-active/)
  await expect(speaking).not.toHaveClass(/bible-word-link-active/)
  await words(page, 'BSB', 8, 3, /^said$/).click()
  await expect(speaking).toHaveClass(/bible-word-link-active/)
  await expect(touching).not.toHaveClass(/bible-word-link-active/)
})

test('BSB Take keeps the written command in the preceding verse', async ({ page }) => {
  await compareWithOriginal(page, 'matthew', 10, 'BSB')
  await words(page, 'BSB', 10, 10, /^Take$/).click()
  await expect(words(page, 'ORIGINAL', 10, 9, /^κτήσησθε$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 10, 10, /^μὴ$/)).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '2932')
})

test('BSB Matthew 17 keeps the personal article and the reply separate', async ({ page }) => {
  await compareWithOriginal(page, 'matthew', 17, 'BSB')
  const speaker = words(page, 'ORIGINAL', 17, 20, /^ὁ$/)
  const reply = words(page, 'ORIGINAL', 17, 20, /^λέγει$/)
  await words(page, 'BSB', 17, 20, /^He$/).click()
  await expect(speaker).toHaveClass(/bible-word-link-active/)
  await expect(reply).not.toHaveClass(/bible-word-link-active/)

  await words(page, 'BSB', 17, 20, /^answered$/).click()
  await expect(reply).toHaveClass(/bible-word-link-active/)
  await expect(speaker).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expectStudyHead(page, '3004')
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
