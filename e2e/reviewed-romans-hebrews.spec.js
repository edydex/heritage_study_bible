import { expect, test } from '@playwright/test'

const word = (page, ref, translation, text) => page.locator(`#verse-${ref} [data-translation="${translation}"] [data-word-link]:visible`).filter({ hasText: text })
async function compare(page, primary, path) {
  await page.addInitScript(id => {
    localStorage.setItem('heritage-translation', id)
    localStorage.setItem('heritage-default-translation-v2', 'done')
  }, primary)
  await page.goto('/#/' + path)
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
  await expect(page.locator(`[data-translation="${primary}"] [data-word-paired="true"]:visible`).first()).toBeVisible()
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

test('Russian preaching navigates to its actual preceding Greek occurrence', async ({ page }) => {
  await compare(page, 'SYNO-W', 'romans/2')
  await expect(page.locator('[data-russian-link-coverage]')).toContainText('29 of 29')
  const translated = word(page, '2-22', 'SYNO-W', /^Проповедуя$/)
  await expect(translated).toHaveCount(1)
  await translated.click()
  const selected = page.getByRole('region', { name: 'Selected word match', exact: true })
  await expect(selected.getByRole('status')).toContainText('Greek 2:21: κηρύσσων')
  await selected.getByRole('button', { name: 'Show Original 2:21', exact: true }).click()
  const original = word(page, '2-21', 'ORIGINAL', /^κηρύσσων$/)
  await expect(original).toHaveClass(/bible-word-link-active/)
  await expect(page.locator('#verse-2-22 [data-translation="ORIGINAL"] .bible-word-link-active:visible')).toHaveCount(0)
  await study(page, translated, 'G2784')
  await close(page)
  await study(page, original, 'G2784')
})

for (const fixture of [
  { chapter: 3, verse: 26, target: /^явится$/, strong: 'G1510', alternatives: [['εἰς', 'G1519'], ['ὁ', 'G3588']], original: /^εἶναι$/, other: /^τὸ$/, otherStrong: 'G3588' },
  { chapter: 4, verse: 21, target: /^обещанное$/, strong: 'G1861', alternatives: [['ὅς', 'G3739']], original: /^ἐπήγγελται$/, other: /^ὃ$/, otherStrong: 'G3739' },
]) test(`Russian Romans ${fixture.chapter}:${fixture.verse} opens its reviewed head and retains every actual alternative`, async ({ page }) => {
  await compare(page, 'SYNO-W', `romans/${fixture.chapter}`)
  const ref = `${fixture.chapter}-${fixture.verse}`
  const dialog = await study(page, word(page, ref, 'SYNO-W', fixture.target), fixture.strong)
  for (const [lemma] of fixture.alternatives) await expect(dialog.getByRole('button', { name: lemma, exact: true })).toHaveAttribute('aria-pressed', 'false')
  for (const [lemma, strong] of fixture.alternatives) {
    await dialog.getByRole('button', { name: lemma, exact: true }).click()
    await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText(strong)
  }
  await close(page)
  await study(page, word(page, ref, 'ORIGINAL', fixture.original), fixture.strong)
  await close(page)
  await study(page, word(page, ref, 'ORIGINAL', fixture.other), fixture.otherStrong)
})

test('Hebrews Nothing retains creation and the unlike sharing frame stays explicitly unpaired', async ({ page }) => {
  await compare(page, 'BSB', 'hebrews/4')
  const nothing = word(page, '4-13', 'BSB', /^Nothing$/), creation = word(page, '4-13', 'BSB', /^creation$/)
  const dialog = await study(page, nothing, 'G3756')
  await expect(dialog.getByRole('button', { name: 'κτίσις', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await dialog.getByRole('button', { name: 'κτίσις', exact: true }).click()
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G2937')
  await close(page)
  await expect(creation).toHaveClass(/bible-word-link-active/)
  expect(await nothing.getAttribute('data-word-link')).toBe(await creation.getAttribute('data-word-link'))
  await study(page, word(page, '4-13', 'ORIGINAL', /^οὐκ$/), 'G3756')
  await close(page)
  const did = word(page, '4-2', 'BSB', /^did$/)
  await expect(did).toHaveCount(2)
  await expect(did.first()).toHaveAttribute('data-word-paired', 'true')
  for (const supplied of [word(page, '4-2', 'BSB', /^since$/), did.last(), word(page, '4-2', 'BSB', /^share$/)]) {
    await expect(supplied).toHaveAttribute('data-word-paired', 'false')
    await supplied.click()
    await expect(page.getByRole('region', { name: 'Selected word match', exact: true })).toContainText('singular nominative passive')
    await expect(page.locator('[data-translation="ORIGINAL"] .bible-word-link-active:visible')).toHaveCount(0)
  }
})

test('Philippians same opens the pronoun separately from the preceding article', async ({ page }) => {
  await compare(page, 'LSV', 'philippians/4')
  await study(page, word(page, '4-2', 'LSV', /^same$/), 'G846')
  await close(page)
  await expect(word(page, '4-2', 'ORIGINAL', /^αὐτὸ$/)).toHaveClass(/bible-word-link-active/)
  await expect(word(page, '4-2', 'ORIGINAL', /^τὸ$/)).not.toHaveClass(/bible-word-link-active/)
  const article = word(page, '4-2', 'LSV', /^the$/)
  await expect(article).toHaveCount(2)
  await study(page, article.first(), 'G3588')
  await close(page)
  await expect(word(page, '4-2', 'ORIGINAL', /^τὸ$/)).toHaveClass(/bible-word-link-active/)
  await expect(word(page, '4-2', 'ORIGINAL', /^αὐτὸ$/)).not.toHaveClass(/bible-word-link-active/)
})
