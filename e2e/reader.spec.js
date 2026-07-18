import { expect, test } from '@playwright/test'

async function openReader(page, path = '/#/genesis/1', expectedVerse = '#verse-1-1') {
  await page.goto(path, { waitUntil: 'networkidle' })
  await expect(page.locator(expectedVerse)).toBeVisible({ timeout: 20_000 })
}

async function submitSearch(page, query) {
  const input = page.getByTestId('reader-search-input')
  await input.fill(query)
  await page.getByRole('button', { name: 'Search' }).click()
}

async function selectTextSnippet(page, verseSelector, snippet) {
  await page.evaluate(({ verseSelector, snippet }) => {
    const root = document.querySelector(`${verseSelector} [data-verse-content]`)
    if (!root) throw new Error(`Missing verse content for ${verseSelector}`)

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes = []
    let fullText = ''
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (node.parentElement?.closest('[data-selection-ignore]')) continue
      nodes.push({ node, start: fullText.length, end: fullText.length + node.data.length })
      fullText += node.data
    }

    const start = fullText.indexOf(snippet)
    if (start < 0) throw new Error(`Could not find “${snippet}” in “${fullText}”`)
    const end = start + snippet.length
    const startNode = nodes.find(item => start >= item.start && start < item.end)
    const endNode = nodes.find(item => end > item.start && end <= item.end)
    if (!startNode || !endNode) throw new Error('Could not map snippet to text nodes')

    const range = document.createRange()
    range.setStart(startNode.node, start - startNode.start)
    range.setEnd(endNode.node, end - endNode.start)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }, { verseSelector, snippet })
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

  test('selects multiple verses with the phone action bar', async ({ page }) => {
    const reactUpdateErrors = []
    page.on('console', message => {
      if (message.type() === 'error' && message.text().includes('Maximum update depth exceeded')) {
        reactUpdateErrors.push(message.text())
      }
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await openReader(page, '/#/jeremiah/20', '#verse-20-1')

    await page.locator('#verse-20-13 .verse-text').click()
    const enterSelection = page.getByRole('button', { name: /Select Verses/ })
    await expect(enterSelection).toBeVisible()
    await enterSelection.click()

    const actions = page.getByRole('region', { name: 'Verse selection actions' })
    await expect(actions).toBeVisible()
    await expect(enterSelection).toBeHidden()
    await expect(page.locator('#verse-20-13')).toHaveAttribute('aria-pressed', 'true')

    await page.locator('#verse-20-14').click()
    await expect(page.locator('#verse-20-14')).toHaveAttribute('aria-pressed', 'true')
    await expect(actions.getByText('2 verses selected')).toBeVisible()
    await expect(actions.getByRole('button', { name: /Copy/ })).toBeVisible()
    await expect(actions.getByRole('button', { name: /Compare/ })).toBeVisible()

    await actions.getByRole('button', { name: 'Done' }).click()
    await expect(actions).toBeHidden()
    await expect(page.getByRole('button', { name: /Select Verses/ })).toBeVisible()
    expect(reactUpdateErrors).toEqual([])
  })

  test('keeps a multi-snippet text selection alive while opening its note dialog', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openReader(page, '/#/john/3', '#verse-3-16')

    await selectTextSnippet(page, '#verse-3-16', 'God so loved')
    const actions = page.getByRole('region', { name: 'Selected text actions' })
    await expect(actions).toBeVisible()
    await actions.getByRole('button', { name: 'Select More' }).click()
    await expect(page.locator('[data-selection-preview="true"]')).toContainText('God so loved')

    await selectTextSnippet(page, '#verse-3-18', 'is not condemned')
    await expect(actions.getByText('2 text snippets')).toBeVisible()

    await actions.getByRole('button', { name: 'Note' }).click()
    await expect(page.getByRole('dialog', { name: 'Note on 2 selected snippets' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Commentary' })).toBeHidden()
    await page.getByPlaceholder('Write your note...').fill('These phrases belong together.')
    await page.getByLabel('Highlight the selected text').check()
    await page.getByRole('button', { name: 'Blue highlight' }).click()
    await page.getByRole('button', { name: 'Save Note' }).click()
    await expect(actions).toBeHidden()
  })

  test('cancels text selection when a verse is tapped without opening commentary', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openReader(page, '/#/john/3', '#verse-3-16')

    await selectTextSnippet(page, '#verse-3-16', 'God so loved')
    const actions = page.getByRole('region', { name: 'Selected text actions' })
    await expect(actions).toBeVisible()

    await page.locator('#verse-3-17 .verse-text').click()
    await expect(actions).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Commentary' })).toBeHidden()
  })
})
