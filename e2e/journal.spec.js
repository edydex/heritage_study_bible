import { expect, test } from '@playwright/test'

async function openJournal(page, path = '/#/journal/genesis/1') {
  await page.goto(path, { waitUntil: 'networkidle' })
  await expect(page.locator('#verse-1-1')).toBeVisible({ timeout: 20_000 })
}

test.describe('Journaling mode', () => {
  test('opens journal from the reader header', async ({ page }) => {
    await page.goto('/#/genesis/1', { waitUntil: 'networkidle' })
    await expect(page.locator('#verse-1-1')).toBeVisible({ timeout: 20_000 })
    await page.getByTitle('Journaling mode').click()
    await expect(page).toHaveURL(/#\/journal\/genesis\/1/)
    await expect(page.getByPlaceholder('Write your reflections, prayers, and notes here...')).toBeVisible()
  })

  test('highlights a verse and persists it across reload', async ({ page }) => {
    await openJournal(page)

    await page.getByTitle('Highlight verses').click()
    await page.getByTitle('Yellow').click()
    await page.locator('#verse-1-1').click()

    await expect(page.locator('#verse-1-1')).toHaveClass(/bg-yellow-200/)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('#verse-1-1')).toHaveClass(/bg-yellow-200/, { timeout: 20_000 })
  })

  test('saves a typed journal note across reload', async ({ page }) => {
    await openJournal(page)

    const textarea = page.getByPlaceholder('Write your reflections, prayers, and notes here...')
    await textarea.fill('In the beginning — my reflection.')
    // Allow debounced autosave to fire.
    await page.waitForTimeout(800)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByPlaceholder('Write your reflections, prayers, and notes here...'))
      .toHaveValue('In the beginning — my reflection.', { timeout: 20_000 })
  })

  test('adds bible margin space and saves typed margin notes', async ({ page }) => {
    await openJournal(page)

    await page.getByTestId('add-bible-space').click()
    const margin = page.getByTestId('bible-margin-notes')
    await margin.fill('Margin reflection beside the text.')
    await page.waitForTimeout(800)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByTestId('bible-margin-notes'))
      .toHaveValue('Margin reflection beside the text.', { timeout: 20_000 })
  })
})
