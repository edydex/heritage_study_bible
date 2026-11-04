import { expect, test } from '@playwright/test'

const words = (page, translation, chapter, verse, text) => page.locator(`#verse-${chapter}-${verse} [data-translation="${translation}"] [data-word-link]:visible`).filter({ hasText: text })

async function compare(page, chapter, primary, original = false) {
  await page.addInitScript(id => {
    localStorage.setItem('heritage-translation', id)
    localStorage.setItem('heritage-default-translation-v2', 'done')
  }, primary)
  await page.goto(`/#/1-john/${chapter}`)
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: original ? 'Original languages' : 'English', exact: true }).click()
  await page.getByRole('button', { name: original ? /^Original (Selected )?Original languages/ : /^KJV (Selected )?/ }).click()
  await expect(words(page, primary, chapter, 1, chapter === 5 ? /^WHOSOEVER$/ : /^children$/)).toHaveAttribute('data-word-paired', 'true')
}

test('a translation naming Jesus retains its actual demonstrative source rather than inventing a Jesus noun', async ({ page }) => {
  await compare(page, 2, 'BSB')
  const named = words(page, 'BSB', 2, 6, /^Jesus$/)
  const personal = words(page, 'KJV', 2, 6, /^he$/).nth(1)
  await named.click()
  await expect(personal).toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const heading = page.getByRole('dialog').getByRole('heading', { level: 3 }).first()
  await expect(heading).toContainText('G1565')
  await expect(heading).not.toContainText('G2424')
})

test('KJV heavenly additions stay distinct from the actual earthly witness prefix in its original verse', async ({ page }) => {
  await compare(page, 5, 'KJV', true)
  const heavenlyWord = words(page, 'KJV', 5, 7, /^Word$/)
  const witness = words(page, 'KJV', 5, 8, /^witness$/)
  const source = words(page, 'ORIGINAL', 5, 7, /^μαρτυροῦντες$/)
  await expect(heavenlyWord).toHaveAttribute('data-word-paired', 'false')
  await expect(witness).toHaveAttribute('data-word-paired', 'true')
  await witness.click()
  await expect(source).toHaveClass(/bible-word-link-active/)
  await expect(heavenlyWord).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('button', { name: 'Show Original 5:7', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G3140')
})
