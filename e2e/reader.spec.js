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

  test('accepts compact references for numbered books', async ({ page }) => {
    await openReader(page)
    await submitSearch(page, '1pet2')
    await expect(page).toHaveURL(/#\/1-peter\/2/)
    await expect(page.locator('#verse-2-1')).toBeVisible({ timeout: 20_000 })
  })

  test('keeps textured chronology bars readable on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/resources/reading-plans/chronological-bible/note/255/note-jeremiah-historical-appendix', {
      waitUntil: 'networkidle',
    })

    const timeline = page.getByRole('region', { name: 'Jeremiah 52 retells Judah’s final collapse' })
    await expect(timeline).toBeVisible({ timeout: 20_000 })

    const bars = timeline.locator('[data-situation-bar]')
    await expect(bars).toHaveCount(5)
    await expect(bars.nth(0)).toHaveAttribute('data-timeline-texture', 'diagonal stripes')
    await expect(bars.nth(1)).toHaveAttribute('data-timeline-texture', 'vertical stripes')
    await expect(bars.nth(2)).toHaveAttribute('data-timeline-texture', 'dots')

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.body.scrollWidth,
      clippedAnchors: [...document.querySelectorAll('[data-timeline-anchor]')]
        .filter(anchor => anchor.scrollWidth > anchor.clientWidth)
        .map(anchor => anchor.textContent.trim()),
      barBackgrounds: [...document.querySelectorAll('[data-situation-bar]')]
        .map(bar => getComputedStyle(bar).backgroundImage),
    }))

    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.clippedAnchors).toEqual([])
    expect(layout.barBackgrounds.every(background => background !== 'none')).toBe(true)
    expect(new Set(layout.barBackgrounds).size).toBeGreaterThanOrEqual(3)

    await timeline.getByRole('button', { name: 'Escape to Egypt' }).click()
    await expect(timeline.getByRole('tooltip')).toContainText('After 586 BC (est.)')
  })

  test('shows Daniel’s Jeremiah context and dated anchors on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/resources/reading-plans/chronological-bible/note/248/note-daniel-early-babylonian-exile', {
      waitUntil: 'networkidle',
    })

    const timeline = page.getByRole('region', { name: 'Daniel enters Babylonian service' })
    await expect(timeline).toBeVisible({ timeout: 20_000 })
    await expect(timeline.getByText('Jer 25:1; 46:2')).toBeVisible()
    await expect(timeline.getByText('Jer 24:1')).toBeVisible()
    await expect(timeline.locator('[data-situation-bar="Dan 2"]')).toHaveAccessibleName(
      /spans training through training/
    )

    await timeline.getByRole('button', { name: 'Babylon triumphs' }).click()
    await expect(timeline.getByRole('tooltip')).toContainText('605 BC (est.)')
    await expect(timeline.getByRole('tooltip')).toContainText('Jer 25:1; 46:2')

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.body.scrollWidth,
      clippedAnchors: [...document.querySelectorAll('[data-timeline-anchor]')]
        .filter(anchor => anchor.scrollWidth > anchor.clientWidth)
        .map(anchor => anchor.textContent.trim()),
    }))

    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.clippedAnchors).toEqual([])
  })

  test('places Lamentations beside Jerusalem’s fall on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/resources/reading-plans/chronological-bible/note/255/note-lamentations-after-jerusalem-falls', {
      waitUntil: 'networkidle',
    })

    const timeline = page.getByRole('region', { name: 'Jerusalem falls, and Judah mourns' })
    await expect(timeline).toBeVisible({ timeout: 20_000 })
    await expect(timeline.getByText('Lam 1–2')).toBeVisible()
    await expect(timeline.getByText('Lam 5')).toBeVisible()
    await expect(timeline.getByText('2 Kin 25:1–21')).toBeVisible()
    await expect(timeline.getByText('Jer 39; 52:1–30')).toBeVisible()
    await expect(timeline.getByText('Jer 40–44')).toBeVisible()

    await timeline.getByRole('button', { name: 'Communal mourning' }).click()
    await expect(timeline.getByRole('tooltip')).toContainText('586–539 BC (broad est.)')
    await expect(timeline.getByRole('tooltip')).toContainText(
      'personified Jerusalem, an individual sufferer, and the surviving community'
    )

    await timeline.getByRole('button', { name: 'Flight to Egypt' }).click()
    await expect(timeline.getByRole('tooltip')).toContainText('After 586 BC (est.)')
    await expect(timeline.getByRole('tooltip')).toContainText('surviving remnant took Jeremiah to Egypt')

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.body.scrollWidth,
      clippedAnchors: [...document.querySelectorAll('[data-timeline-anchor]')]
        .filter(anchor => anchor.scrollWidth > anchor.clientWidth)
        .map(anchor => anchor.textContent.trim()),
    }))

    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.clippedAnchors).toEqual([])
  })

  test('shows Jeremiah and Ezekiel’s overlapping ministries on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/resources/reading-plans/chronological-bible/note/237/note-ezekiel-dated-exile-visions', {
      waitUntil: 'networkidle',
    })

    const timeline = page.getByRole('region', { name: 'Jeremiah in Judah, Ezekiel among the exiles' })
    await expect(timeline).toBeVisible({ timeout: 20_000 })
    await expect(timeline.getByText('Jer 27–36')).toBeVisible()
    await expect(timeline.getByText('Ezek 1–7')).toBeVisible()
    await expect(timeline.getByText('2 Kin 24:10–25:21')).toBeVisible()
    await expect(timeline.getByText('2 Chr 36:9–21')).toBeVisible()

    await timeline.getByRole('button', { name: 'Parallel warnings' }).click()
    await expect(timeline.getByRole('tooltip')).toContainText('593–588 BC (est.)')
    await expect(timeline.getByRole('tooltip')).toContainText('Jeremiah warned Judah from Jerusalem')

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.body.scrollWidth,
      clippedAnchors: [...document.querySelectorAll('[data-timeline-anchor]')]
        .filter(anchor => anchor.scrollWidth > anchor.clientWidth)
        .map(anchor => anchor.textContent.trim()),
    }))

    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.clippedAnchors).toEqual([])
  })

  test('shows the historical accounts beside the exile Psalms on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/resources/reading-plans/chronological-bible/note/258/note-exilic-psalm-laments', {
      waitUntil: 'networkidle',
    })

    const timeline = page.getByRole('region', { name: 'Songs of destruction, exile, and return' })
    await expect(timeline).toBeVisible({ timeout: 20_000 })
    await expect(timeline.getByText('2 Kin 25')).toBeVisible()
    await expect(timeline.getByText('2 Chr 36:17–23')).toBeVisible()
    await expect(timeline.getByText('Jer 39–44; 52')).toBeVisible()

    await timeline.getByRole('button', { name: 'Survivors displaced' }).click()
    await expect(timeline.getByRole('tooltip')).toContainText('After 586 BC (est.)')
    await expect(timeline.getByRole('tooltip')).toContainText('deported to Babylon')

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.body.scrollWidth,
      clippedAnchors: [...document.querySelectorAll('[data-timeline-anchor]')]
        .filter(anchor => anchor.scrollWidth > anchor.clientWidth)
        .map(anchor => anchor.textContent.trim()),
    }))

    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.clippedAnchors).toEqual([])
  })

  test('accepts unique numbered-book prefixes without a registered alias', async ({ page }) => {
    await openReader(page)
    await submitSearch(page, '2thes 2')
    await expect(page).toHaveURL(/#\/2-thessalonians\/2/)
    await expect(page.locator('#verse-2-1')).toBeVisible({ timeout: 20_000 })

    await submitSearch(page, '3 joh 1')
    await expect(page).toHaveURL(/#\/3-john\/1/)
    await expect(page.locator('#verse-1-1')).toBeVisible({ timeout: 20_000 })
  })

  test('offers numbered-book choices and accepts the first with Enter', async ({ page }) => {
    await openReader(page)
    await submitSearch(page, 'pet2')

    const chooser = page.getByRole('dialog', { name: 'Which book did you mean?' })
    await expect(chooser).toBeVisible()
    await expect(chooser.getByRole('option', { name: /1 Peter 2/ })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/#\/1-peter\/2/)
    await expect(page.locator('#verse-2-1')).toBeVisible({ timeout: 20_000 })
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
