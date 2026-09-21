import { test, expect } from '@playwright/test'

const noteUrl = '/#/resources/reading-plans/chronological-bible/note/250/note-ezekiel-egypt-oracles'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'BSB')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
})

test('optional historical context preserves the timeline and navigates to the exact verse on first click', async ({ page }) => {
  await page.goto(noteUrl)
  const timeline = page.getByRole('region', { name: 'When Ezekiel’s Egypt messages are dated' })
  const context = page.locator('[data-prophecy-context]')
  await expect(timeline).toBeVisible()
  await expect(context).not.toHaveAttribute('open', '')
  await expect(page.getByRole('button', { name: 'Mark Done', exact: true })).toBeVisible()
  await context.locator(':scope > summary').click()
  await expect(context.getByRole('table')).toBeVisible()
  await expect(context.locator('[data-prophecy-entry]')).toHaveCount(4)
  await expect(context).toContainText('Fulfillment date not established')
  await expect(context).toContainText('Specialist review pending')
  await expect(context.getByRole('link', { name: /British Museum/ }).first()).toHaveAttribute('href', 'https://www.britishmuseum.org/collection/object/W_1878-1015-22')
  await page.screenshot({ path: test.info().outputPath('prophecy-context-desktop.png'), fullPage: true })
  await context.getByRole('link', { name: 'Ezekiel 29:17', exact: true }).click()
  await expect(page).toHaveURL(/#\/ezekiel\/29$/)
  await expect(page.locator('#verse-29-17')).toBeInViewport()
  await page.goBack()
  await expect(timeline).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Done', exact: true })).toBeVisible()
  await expect(context).not.toHaveAttribute('open', '')
})

test('phone context stacks without horizontal overflow and does not mark the note read', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(noteUrl)
  const context = page.locator('[data-prophecy-context]')
  await context.locator(':scope > summary').click()
  await expect(context.getByRole('table')).toBeVisible()
  const first = context.locator('[data-prophecy-entry]').first()
  await first.scrollIntoViewIfNeeded()
  await expect(first).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  for (const row of await context.locator('[data-prophecy-entry]').all()) {
    const cells = await row.locator(':scope > th, :scope > td').evaluateAll(nodes => nodes.map(node => {
      const { x, y, width } = node.getBoundingClientRect()
      return { x, y, width }
    }))
    expect(cells[1].y).toBeGreaterThan(cells[0].y)
    expect(cells[2].y).toBeGreaterThan(cells[1].y)
    expect(cells.every(cell => cell.x >= 0 && cell.x + cell.width <= 320)).toBe(true)
  }
  await page.screenshot({ path: test.info().outputPath('prophecy-context-phone.png') })
  await context.getByText('About the historical sources', { exact: true }).click()
  await expect(context.getByRole('link', { name: /Herodotus · Histories 2.177/ }).last()).toBeVisible()
  await context.locator(':scope > summary').click()
  await expect(page.getByRole('button', { name: 'Mark Done', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Mark Done', exact: true })).toBeVisible()
  await expect(context).not.toHaveAttribute('open', '')
})

test('other chronology notes remain unchanged', async ({ page }) => {
  await page.goto('/#/resources/reading-plans/chronological-bible/note/248/note-daniel-early-babylonian-exile')
  await expect(page.getByRole('button', { name: 'Mark Done', exact: true })).toBeEnabled()
  await expect(page.locator('[data-prophecy-context]')).toHaveCount(0)
  await expect(page.getByRole('region')).toHaveCount(1)
})
