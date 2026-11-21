import { expect, test } from '@playwright/test'

test('UKRK-R displays original Greek and Hebrew without an installed verse alignment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'UKRK')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto('/#/mark/14')
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
  const original = page.getByRole('region', { name: 'Original chapter text' })
  await expect(page.getByRole('region', { name: 'UKRK-R chapter text' })).toBeVisible()
  await expect(page.getByText(/verse numbers have no checked alignment/)).toBeVisible()
  const passover = original.locator('[data-verse="1"] [data-word-link]').filter({ hasText: /^πάσχα$/ })
  await expect(passover).toHaveAttribute('data-word-paired', 'false')
  await passover.click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('G3957')
  await dialog.getByRole('button', { name: /^Mark 14:1\b/ }).click()
  await expect(dialog).toHaveCount(0)
  await expect(original.locator('[data-verse="1"]')).toHaveClass(/bg-yellow-100/)

  await page.evaluate(() => { location.hash = '/genesis/1' })
  const beginning = original.locator('[data-verse="1"]')
  await expect(beginning).toHaveAttribute('dir', 'rtl')
  await expect(beginning).toContainText('בְּרֵאשִׁ֖ית')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)

  await page.evaluate(() => { location.hash = '/habakkuk/3' })
  await original.getByRole('button', { name: 'שִׁגְיֹנֽוֹת', exact: true }).click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await dialog.getByRole('button', { name: /^Psalms 7 · source heading/ }).click()
  await expect(page).toHaveURL(/#\/psalms\/7$/)
  await expect(original.locator('[data-verse="0"]')).toHaveClass(/bg-yellow-100/)
})

test('source occurrence stays in view when reviewed Ukrainian links finish loading', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'UKRK')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto('/#/mark/14')
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
  let releaseLinks
  const postponedLinks = new Promise(resolve => { releaseLinks = resolve })
  await page.route('**/ukrk-word-links/matthew.json', async route => {
    await postponedLinks
    await route.continue()
  })
  try {
    const original = page.getByRole('region', { name: 'Original chapter text' })
    await original.locator('[data-verse="6"]').getByRole('button', { name: 'Ἰησοῦς', exact: true }).click()
    await page.getByRole('button', { name: 'Study word', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^Matthew 1:16\b/ }).click()
    await expect(original.locator('[data-verse="16"]')).toHaveClass(/bg-yellow-100/)
    releaseLinks()
    const alignedSource = page.locator('#verse-1-16 [data-translation="ORIGINAL"]:visible')
    await expect(alignedSource).toHaveClass(/bg-yellow-100/)
    await expect(alignedSource).toBeInViewport()
  } finally {
    releaseLinks()
  }
})

test('UKRK word study follows the written Greek across Philemon’s verse boundary', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'UKRK')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto('/#/philemon/1')
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
  await expect(page.getByText('UKRK-R: 24 of 24 verses have reviewed word links.')).toBeVisible()

  const word = (translation, verse, text) => page
    .locator(`#verse-1-${verse} [data-translation="${translation}"] [data-word-link]:visible`)
    .filter({ hasText: text })
  await word('UKRK', 24, /^Благодать$/).click()
  await expect(word('ORIGINAL', 25, /^χάρις$/)).toHaveClass(/bible-word-link-active/)
  await expect(word('ORIGINAL', 24, /^Μᾶρκος$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('button', { name: 'Show Original 1:25' })).toBeVisible()
  await expect(word('UKRK', 24, /^Амінь$/)).toHaveAttribute('data-word-paired', 'false')

  await word('ORIGINAL', 24, /^Ἀρίσταρχος$/).click()
  await expect(word('UKRK', 23, /^Аристарх$/)).toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G708')
  await expect(dialog.getByLabel('Verse wording')).toHaveValue('UKRK')
  const result = dialog.getByRole('button', { name: /^Philemon 1:24/ })
  await expect(result).toBeEnabled()
  await expect(result.locator('[data-occurrence-translation="UKRK"]')).toContainText('UKRK-R 1:23')
  await expect(result.locator('[data-occurrence-translation="UKRK"] mark')).toHaveText('Аристарх')
})

test('UKRK and BSB distinguish joy and grace through their actual Greek words', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'UKRK')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto('/#/2-john/1')
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.getByRole('button', { name: /Berean Standard Bible/ }).click()

  const word = (translation, verse, text) => page
    .locator(`#verse-1-${verse} [data-translation="${translation}"] [data-word-link]:visible`)
    .filter({ hasText: text })
  const grace = word('BSB', 3, /^Grace$/)
  const joy = word('BSB', 12, /^joy$/)
  await word('UKRK', 3, /^благодать$/).click()
  await expect(grace).toHaveClass(/bible-word-link-active/)
  await expect(joy).not.toHaveClass(/bible-word-link-active/)
  await word('UKRK', 12, /^благодать$/).click()
  await expect(joy).toHaveClass(/bible-word-link-active/)
  await expect(grace).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G5479')
})
