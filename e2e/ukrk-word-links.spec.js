import { expect, test } from '@playwright/test'

test('UKRK word study follows the written Greek across Philemon’s verse boundary', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'UKRK')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto('/#/philemon/1')
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
  await expect(page.getByText('UKRK: 24 of 24 verses have reviewed word links.')).toBeVisible()

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
  await expect(result.locator('[data-occurrence-translation="UKRK"]')).toContainText('UKRK 1:23')
  await expect(result.locator('[data-occurrence-translation="UKRK"] mark')).toHaveText('Аристарх')
})
