import { test, expect } from '@playwright/test'

async function compareJohn(page, secondary) {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'LSV')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto('/#/john/1')
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: secondary === 'ORIGINAL' ? 'Original languages' : 'English', exact: true }).click()
  await page.getByRole('button', { name: secondary === 'ORIGINAL' ? /^Original (Selected )?Original languages/ : /^KJV (Selected )?/ }).click()
  await expect(page.getByLabel('Word links', { exact: true })).toBeChecked()
  await expect(page.locator('.word-links-color')).toBeVisible()
  await expect(page.getByText('Loading word links…', { exact: true })).toHaveCount(0)
  await expect(page.locator('#verse-1-1 [data-translation="LSV"] [data-word-paired="true"]:visible').first()).toBeVisible()
}

function words(page, translation, text, verse = 1) {
  return page.locator(`#verse-1-${verse} [data-translation="${translation}"] [data-word-link]:visible`).filter({ hasText: text })
}

async function expectSameTint(left, right) {
  await expect(left).toHaveAttribute('data-word-paired', 'true')
  await expect(right).toHaveAttribute('data-word-paired', 'true')
  const pattern = await left.getAttribute('data-word-pattern')
  expect(pattern).not.toBeNull()
  await expect(right).toHaveAttribute('data-word-pattern', pattern)
  const background = await left.evaluate(node => getComputedStyle(node).backgroundColor)
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
  expect(background).not.toBe('transparent')
  await expect(right).toHaveCSS('background-color', background)
}

async function expectOnlyRepeatedWordSelected(left, right, selected) {
  for (let index = 0; index < 3; index++) {
    if (index === selected) {
      await expect(left.nth(index)).toHaveClass(/bible-word-link-active/)
      await expect(right.nth(index)).toHaveClass(/bible-word-link-active/)
    } else {
      await expect(left.nth(index)).not.toHaveClass(/bible-word-link-active/)
      await expect(right.nth(index)).not.toHaveClass(/bible-word-link-active/)
    }
  }
  await expect(left.page().getByRole('dialog')).toHaveCount(0)
}

test.describe('reviewed LSV Greek correspondence on touch screens', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('each John 1 Word has the tint and touch highlight of its own Greek Logos occurrence', async ({ page }) => {
    await compareJohn(page, 'ORIGINAL')
    const english = words(page, 'LSV', /^Word$/)
    const greek = words(page, 'ORIGINAL', /^Λόγος$/)
    await expect(english).toHaveCount(3)
    await expect(greek).toHaveCount(3)

    for (let index = 0; index < 3; index++) {
      await expect(english.nth(index)).toHaveAttribute('data-word-paired', 'true')
      await expect(greek.nth(index)).toHaveAttribute('data-word-paired', 'true')
      await expectSameTint(english.nth(index), greek.nth(index))
      await greek.nth(index).tap()
      await expectOnlyRepeatedWordSelected(english, greek, index)
      await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText('Λόγος')
      await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText('the Word')
      if (index === 0) {
        await page.screenshot({ path: test.info().outputPath('john-lsv-greek-word-touch.png') })
        await page.getByRole('button', { name: 'Study word', exact: true }).tap()
        const study = page.getByRole('dialog', { name: 'Word study: Λόγος' })
        await expect(study).toContainText('Occurrences of the source lemma')
        await expect(study).toContainText('G3056')
        await study.getByRole('button', { name: 'Close word study' }).tap()
        await expect(english.first()).toHaveClass(/bible-word-link-active/)
      }
      await page.getByRole('button', { name: 'Clear word match' }).tap()
    }
  })
})

test('LSV and KJV keep repeated Word occurrences distinct through the same Greek source', async ({ page }) => {
  await compareJohn(page, 'KJV')
  const lsv = words(page, 'LSV', /^Word$/)
  const kjv = words(page, 'KJV', /^Word$/)
  await expect(lsv).toHaveCount(3)
  await expect(kjv).toHaveCount(3)

  for (let index = 0; index < 3; index++) {
    await expectSameTint(lsv.nth(index), kjv.nth(index))
    await lsv.nth(index).click()
    await expectOnlyRepeatedWordSelected(lsv, kjv, index)
    const match = page.getByRole('region', { name: 'Selected word match' })
    await expect(match).toContainText('Λόγος')
    await expect(match).toContainText('LSV: the Word')
    await expect(match).toContainText('KJV: the Word')
    await expect(page.locator('#verse-1-1 [data-translation="LSV"] .bible-word-link-active:visible').filter({ hasText: /^(God|was)$/ })).toHaveCount(0)
    if (index === 0) await page.screenshot({ path: test.info().outputPath('john-lsv-kjv-word.png') })
    await page.getByRole('button', { name: 'Clear word match' }).click()
  }
})

test('the John 1 Bethabara reading does not claim a match with the Greek Bethany reading', async ({ page }) => {
  await compareJohn(page, 'ORIGINAL')
  const bethabara = words(page, 'LSV', /^Bethabara$/, 28)
  const bethany = words(page, 'ORIGINAL', /^Βηθανίᾳ$/, 28)
  await expect(bethabara).toHaveAttribute('data-word-paired', 'false')
  await expect(bethany).toHaveAttribute('data-word-paired', 'false')
  await bethabara.click()
  await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText(/Bethabara|Bethany/)
  await expect(bethabara).toHaveClass(/bible-word-link-active/)
  await expect(bethany).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a transposed Philippians verse highlights the source in its actual neighboring row', async ({ page }) => {
  await compareJohn(page, 'ORIGINAL')
  await page.goto('/#/philippians/1')
  // Direct navigation recreates the session-only parallel pane.
  if (await page.getByTitle('Enable parallel mode', { exact: true }).count()) {
    await page.getByTitle('Enable parallel mode', { exact: true }).click()
    await page.getByRole('button', { name: 'Original languages', exact: true }).click()
    await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
  }
  const english = page.locator('#verse-1-16 [data-translation="LSV"] [data-word-link]:visible').filter({ hasText: /^affliction$/ })
  const source = page.locator('#verse-1-17 [data-translation="ORIGINAL"] [data-word-link]:visible').filter({ hasText: /^θλῖψιν$/ })
  await expectSameTint(english, source)
  await english.click()
  await expect(source).toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText('Greek 1:17')
  await page.getByRole('button', { name: 'Show Original 1:17', exact: true }).click()
  await expect(source).toBeInViewport()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Word study: affliction' })).toContainText('G2347')
})
