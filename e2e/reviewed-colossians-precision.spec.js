import { expect, test } from '@playwright/test'

const word = (page, ref, translation, text) => page.locator(`#verse-${ref} [data-translation="${translation}"] [data-word-link]:visible`).filter({ hasText: text })
async function compare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'LSV')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto('/#/colossians/1')
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
  await expect(page.locator('[data-translation="LSV"] [data-word-paired="true"]:visible').first()).toBeVisible()
}
async function study(page, selected, strong) {
  await expect(selected).toHaveCount(1)
  await selected.click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText(strong)
  return dialog
}
const close = page => page.getByRole('button', { name: 'Close word study', exact: true }).click()

test('LSV Jesus and Christ retain separate source names, visual matches and dictionary heads despite reversed Greek order', async ({ page }) => {
  await compare(page)
  const jesus = word(page, '1-1', 'LSV', /^Jesus$/), christ = word(page, '1-1', 'LSV', /^Christ$/)
  const greekJesus = word(page, '1-1', 'ORIGINAL', /^Ἰησοῦ$/), greekChrist = word(page, '1-1', 'ORIGINAL', /^Χριστοῦ$/)
  for (const selected of [jesus, christ, greekJesus, greekChrist]) await expect(selected).toHaveCount(1)
  const jesusLink = await jesus.getAttribute('data-word-link'), christLink = await christ.getAttribute('data-word-link')
  expect(jesusLink).not.toBeNull()
  expect(christLink).not.toBeNull()
  expect(jesusLink).not.toBe(christLink)
  const jesusColor = await jesus.getAttribute('data-word-color'), christColor = await christ.getAttribute('data-word-color')
  expect(jesusColor).not.toBeNull()
  expect(christColor).not.toBeNull()
  expect(jesusColor).not.toBe(christColor)
  await study(page, jesus, 'G2424')
  await close(page)
  await expect(greekJesus).toHaveClass(/bible-word-link-active/)
  await expect(greekChrist).not.toHaveClass(/bible-word-link-active/)
  await expect(christ).not.toHaveClass(/bible-word-link-active/)
  await study(page, greekJesus, 'G2424')
  await close(page)
  await study(page, christ, 'G5547')
  await close(page)
  await expect(greekChrist).toHaveClass(/bible-word-link-active/)
  await expect(greekJesus).not.toHaveClass(/bible-word-link-active/)
  await study(page, greekChrist, 'G5547')
})

test('LSV pleasing opens the actual noun and its first in opens eis inside the same preserved phrase', async ({ page }) => {
  await compare(page)
  const pleasing = word(page, '1-10', 'LSV', /^pleasing$/), inWords = word(page, '1-10', 'LSV', /^in$/)
  await expect(pleasing).toHaveCount(1)
  await expect(inWords).toHaveCount(3)
  const inside = inWords.first()
  for (const attribute of ['data-word-link', 'data-word-color', 'data-word-texture']) {
    const value = await pleasing.getAttribute(attribute)
    expect(value).not.toBeNull()
    expect(await inside.getAttribute(attribute)).toBe(value)
  }
  await study(page, pleasing, 'G699')
  await close(page)
  await expect(inside).toHaveClass(/bible-word-link-active/)
  const dialog = await study(page, inside, 'G1519')
  await dialog.getByRole('button', { name: 'ἀρεσκεία', exact: true }).click()
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G699')
  await close(page)
  await study(page, word(page, '1-10', 'ORIGINAL', /^εἰς$/), 'G1519')
  await close(page)
  await study(page, word(page, '1-10', 'ORIGINAL', /^ἀρεσκείαν$/), 'G699')
})
