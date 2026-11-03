import { expect, test } from '@playwright/test'

const words = (page, translation, verse, text, chapter = 1) => page.locator(`#verse-${chapter}-${verse} [data-translation="${translation}"] [data-word-link]:visible`).filter({ hasText: text })

async function compare(page, book, original = false, chapter = 1) {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'BSB')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto(`/#/${book}/${chapter}`)
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: original ? 'Original languages' : 'English', exact: true }).click()
  await page.getByRole('button', { name: original ? /^Original (Selected )?Original languages/ : /^KJV (Selected )?/ }).click()
  const readiness = book === 'jude' ? /^Jude$/ : book === 'titus' ? (chapter === 3 ? /^Remind$/ : /^Paul$/) : /^elder$/
  await expect(words(page, 'BSB', 1, readiness, chapter)).toHaveAttribute('data-word-paired', 'true')
}

test('the two love renderings retain the actual noun and pronoun in 2 John', async ({ page }) => {
  await compare(page, '2-john', true)
  const love = words(page, 'BSB', 6, /^love$/)
  const noun = words(page, 'ORIGINAL', 6, /^ἀγάπη$/)
  const pronoun = words(page, 'ORIGINAL', 6, /^αὐτῇ$/)
  await expect(love).toHaveCount(2)
  await love.nth(1).click()
  await expect(pronoun).toHaveClass(/bible-word-link-active/)
  await expect(noun).not.toHaveClass(/bible-word-link-active/)
  await expect(love.first()).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G846')
})

test('3 John links our to the actual people while instruction remains supplied', async ({ page }) => {
  await compare(page, '3-john')
  const our = words(page, 'BSB', 9, /^our$/)
  const us = words(page, 'KJV', 9, /^us$/)
  const instruction = words(page, 'BSB', 9, /^instruction$/)
  await expect(instruction).toHaveAttribute('data-word-paired', 'false')
  await our.click()
  await expect(us).toHaveClass(/bible-word-link-active/)
  await expect(instruction).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G1473')
})

test('Jude keeps doubting recipients distinct from the differing KJV mercy-givers description', async ({ page }) => {
  await compare(page, 'jude')
  const doubt = words(page, 'BSB', 22, /^doubt$/)
  const difference = words(page, 'KJV', 22, /^difference$/)
  // Neither word has a counterpart in the other translation. The checked BSB
  // source anchor must still support word study without implying a shared tint.
  await expect(doubt).toHaveAttribute('data-word-paired', 'false')
  await expect(difference).toHaveAttribute('data-word-paired', 'false')
  await doubt.click()
  await expect(difference).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G1252')
  await page.getByRole('button', { name: 'Close word study', exact: true }).click()
  await difference.click()
  await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText('mercy-givers')
  await expect(doubt).not.toHaveClass(/bible-word-link-active/)
})

test('Titus keeps supplied possessors separate from the genuine-child adjective', async ({ page }) => {
  await compare(page, 'titus')
  await expect(words(page, 'BSB', 4, /^my$/)).toHaveAttribute('data-word-paired', 'false')
  await expect(words(page, 'KJV', 4, /^mine$/)).toHaveAttribute('data-word-paired', 'false')
  await words(page, 'KJV', 4, /^own$/).click()
  await expect(words(page, 'BSB', 4, /^true$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'BSB', 4, /^my$/)).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G1103')
})

test('Titus studies the repeated Spirit noun at its actual preceding source reference', async ({ page }) => {
  await compare(page, 'titus', true, 3)
  const spirit = words(page, 'BSB', 6, /^Spirit$/, 3)
  const source = words(page, 'ORIGINAL', 5, /^Πνεύματος$/, 3)
  const relative = words(page, 'ORIGINAL', 6, /^οὗ$/, 3)
  await spirit.click()
  await expect(source).toHaveClass(/bible-word-link-active/)
  await expect(relative).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('button', { name: 'Show Original 3:5', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G4151')
})
