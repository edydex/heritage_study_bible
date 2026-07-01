import { expect, test } from '@playwright/test'

async function openReader(page, path = '/#/genesis/1') {
  await page.goto(path, { waitUntil: 'networkidle' })
  await expect(page.locator('#verse-1-1')).toBeVisible({ timeout: 20_000 })
}

async function submitSearch(page, query) {
  const input = page.getByTestId('reader-search-input')
  await input.fill(query)
  await page.getByRole('button', { name: 'Search' }).click()
}

test.describe('Heritage reader', () => {
  test('loads a chapter from the hash route', async ({ page }) => {
    await openReader(page)
    await expect(page.locator('#verse-1-1')).toContainText('In the beginning God created')
  })

  test('navigates to the next chapter', async ({ page }) => {
    await openReader(page)
    await page.getByRole('button', { name: 'Next chapter' }).click()
    await expect(page).toHaveURL(/#\/genesis\/2/)
    await expect(page.locator('#verse-2-1')).toBeVisible({ timeout: 20_000 })
  })

  test('jumps to a verse reference from search', async ({ page }) => {
    await openReader(page)
    await submitSearch(page, 'John 3:16')
    await expect(page).toHaveURL(/#\/john\/3/)
    await expect(page.locator('#verse-3-16')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#verse-3-16')).toContainText('For God so loved')
  })

  test('shows bible search results', async ({ page }) => {
    await openReader(page)
    await submitSearch(page, 'shepherd')
    await expect(page.getByRole('heading', { name: 'Search Results' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Psalms 23:1').first()).toBeVisible()
  })

  test('bookmarks and unbookmarks a verse', async ({ page }) => {
    await openReader(page)

    const bookmarkButton = page.getByTestId('verse-bookmark-1')
    await page.locator('#verse-1-1').hover()
    await bookmarkButton.click({ force: true })

    await page.getByTestId('open-bookmarks').click()
    await expect(page.getByText('Bookmarks (1)')).toBeVisible()
    await page.getByRole('button', { name: 'By Books' }).click()
    await page.getByRole('button', { name: /Genesis/ }).click()
    await page.getByRole('button', { name: /Chapter 1/ }).click()
    await expect(page.getByText('Verse 1')).toBeVisible()

    await page.keyboard.press('Escape')
    await page.locator('#verse-1-1').hover()
    await bookmarkButton.click({ force: true })

    await page.getByTestId('open-bookmarks').click()
    await expect(page.getByText('No bookmarks yet. Click the star on any verse or commentary to bookmark it!')).toBeVisible()
  })
})
