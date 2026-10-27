import { test, expect } from '@playwright/test'

async function originalParallel(page, path, translation = 'BSB') {
  await page.addInitScript(id => {
    localStorage.setItem('heritage-translation', id)
    localStorage.setItem('heritage-default-translation-v2', 'done')
  }, translation)
  await page.goto(path)
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
}

test('Hebrew source lookup finds inflected forms throughout the OT and preserves source-only matching', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await originalParallel(page, '/#/genesis/1', 'LSV')
  const create = page.locator('#verse-1-1 [data-translation="ORIGINAL"] [role="button"]:visible').nth(1)
  await expect(create).toContainText('בָּרָ֣א')
  await create.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Occurrences of the source lemma, including its inflected forms')
  await expect(dialog).toContainText('H1254 a')
  await expect(dialog).toContainText('Hebrew / Aramaic Old Testament')
  const genesis = dialog.getByRole('button', { name: /^Genesis 1:1 / })
  await expect(genesis.locator('[data-occurrence-translation="LSV"]')).toContainText('In [the] beginning God created')
  await expect(genesis.locator('[data-occurrence-translation="LSV"] mark')).toHaveCount(0)
  await expect(dialog).toContainText('Isaiah')
  await page.screenshot({ path: test.info().outputPath('lsv-hebrew-lemma-phone.png') })
  await dialog.getByRole('button', { name: 'Close word study' }).click()
})

test('an unlinked LSV word offers the entire source verse without guessing a Hebrew counterpart', async ({ page }) => {
  await originalParallel(page, '/#/genesis/1', 'LSV')
  const created = page.locator('#verse-1-1 [data-translation="LSV"] [role="button"]:visible').filter({ hasText: /^created$/ })
  await created.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Matching word form')
  await dialog.getByRole('button', { name: 'Study original words in this verse' }).click()
  await expect(dialog).toContainText('No exact translation match is implied for “created”')
  await dialog.getByRole('button', { name: 'בָּרָ֣א', exact: true }).click()
  await expect(dialog).toContainText('H1254 a')
  await expect(dialog).toContainText('Occurrences of the source lemma')
  await expect(dialog.locator('[data-occurrence-translation="LSV"]').first()).toBeVisible()
  await dialog.getByRole('button', { name: 'Back to LSV word forms' }).click()
  await expect(dialog).toContainText('Matching word form')
})

test('a saved WEB selection migrates to BSB and LSV keeps separate verse lines', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'WEB')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto('/#/genesis/1')
  await expect(page.getByTitle('Change translation')).toContainText('BSB')
  await expect(page.locator('span#verse-1-1')).toBeVisible()
  await page.getByTitle('Change translation').click()
  await expect(page.getByRole('button', { name: /World English Bible/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /King James Version/ })).toBeVisible()
  await page.getByRole('button', { name: /Literal Standard Version/ }).click()
  await expect(page.locator('div#verse-1-1')).toBeVisible()
  await page.getByTitle('Change translation').click()
  await page.getByRole('button', { name: /Berean Standard Bible/ }).click()
  await expect(page.locator('span#verse-1-1')).toBeVisible()
})
