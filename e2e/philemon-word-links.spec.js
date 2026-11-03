import { expect, test } from '@playwright/test'

async function compare(page, original = false, primary = 'BSB') {
  await page.addInitScript(id => {
    localStorage.setItem('heritage-translation', id)
    localStorage.setItem('heritage-default-translation-v2', 'done')
  }, primary)
  await page.goto('/#/philemon/1')
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: original ? 'Original languages' : 'English', exact: true }).click()
  await page.getByRole('button', { name: original ? /^Original (Selected )?Original languages/ : /^KJV (Selected )?/ }).click()
  await expect(page.getByText('Loading word links…', { exact: true })).toHaveCount(0)
  await expect(words(page, primary, 1, primary === 'KJV' ? /^PAUL$/ : /^Paul$/)).toHaveAttribute('data-word-paired', 'true')
}

const words = (page, translation, verse, text) => page.locator(`#verse-1-${verse} [data-translation="${translation}"] [data-word-link]:visible`).filter({ hasText: text })

test('Philemon keeps an implied our distinct from the actual shared coworker possessive', async ({ page }) => {
  await compare(page)
  for (const id of ['BSB', 'KJV']) {
    const our = words(page, id, 1, /^our$/)
    await expect(our).toHaveCount(2)
    await expect(our.first()).toHaveAttribute('data-word-paired', 'false')
    await expect(our.nth(1)).toHaveAttribute('data-word-paired', 'true')
  }
  const bsb = words(page, 'BSB', 1, /^our$/), kjv = words(page, 'KJV', 1, /^our$/)
  await bsb.nth(1).click()
  await expect(kjv.nth(1)).toHaveClass(/bible-word-link-active/)
  await expect(kjv.first()).not.toHaveClass(/bible-word-link-active/)
  await expect(bsb.first()).not.toHaveClass(/bible-word-link-active/)
})

test('Philemon ours studies the actual first-person form while a differing you stays unlinked', async ({ page }) => {
  await compare(page)
  const ours = words(page, 'BSB', 6, /^ours$/), you = words(page, 'KJV', 6, /^you$/)
  await expect(you).toHaveAttribute('data-word-paired', 'false')
  await ours.click()
  await expect(you).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const study = page.getByRole('dialog')
  await expect(study.getByRole('heading', { level: 3 }).first()).toContainText('G1473')
  await expect(study).toContainText('first-person community')
})

test('Philemon preserves differing titles and labels the KJV subscription as absent from Greek', async ({ page }) => {
  await compare(page)
  const lord = words(page, 'KJV', 20, /^Lord$/)
  await expect(lord).toHaveCount(2)
  await expect(lord.first()).toHaveAttribute('data-word-paired', 'true')
  await expect(lord.nth(1)).toHaveAttribute('data-word-paired', 'false')
  await lord.nth(1).click()
  await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText('N1904 has Christ')
  const rome = words(page, 'KJV', 25, /^Rome$/)
  await expect(rome).toHaveAttribute('data-word-paired', 'false')
  await rome.click()
  await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText('concluding subscription')
})

test('the repeated appeal recipient points to the original pronoun in its actual following verse', async ({ page }) => {
  await compare(page, true, 'KJV')
  const english = words(page, 'KJV', 9, /^thee$/), greek = words(page, 'ORIGINAL', 10, /^σε$/)
  await expect(english).toHaveAttribute('data-word-paired', 'true')
  await english.click()
  await expect(greek).toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('button', { name: 'Show Original 1:10', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('G4771')
})
