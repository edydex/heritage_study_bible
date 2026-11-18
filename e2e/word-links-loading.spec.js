import { expect, test } from '@playwright/test'

const word = (page, ref, text) => page.locator(`#verse-${ref} [data-translation="SYNO-W"] [data-word-link]:visible`).filter({ hasText: text })
async function holdRussianLinks(page) {
  let release, requested
  const gate = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { requested = resolve })
  await page.route('**/data/original-languages/syno-w-word-links/romans.json', async route => {
    requested()
    await gate
    await route.continue()
  })
  return { release, started }
}
async function compare(page, chapter) {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'SYNO-W')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
  await page.goto('/#/romans/' + chapter)
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: 'Original languages', exact: true }).click()
  await page.getByRole('button', { name: /^Original (Selected )?Original languages/ }).click()
}

test('an early tap resolves its original match and pending study when word links finish loading', async ({ page }) => {
  const pending = await holdRussianLinks(page)
  await compare(page, 1)
  await pending.started
  await word(page, '1-30', /^злоречивы$/).click()
  const selection = page.getByRole('region', { name: 'Selected word match', exact: true })
  await expect(selection).toContainText('Loading word links')
  await selection.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  pending.release()
  await expect(selection).toContainText('ψιθυριστάς')
  await expect(selection.getByRole('button', { name: 'Show Original 1:29', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G5588')
})

test('clearing a pending study prevents it from opening after links arrive', async ({ page }) => {
  const pending = await holdRussianLinks(page)
  await compare(page, 1)
  await pending.started
  const selected = word(page, '1-30', /^злоречивы$/)
  await selected.click()
  const selection = page.getByRole('region', { name: 'Selected word match', exact: true })
  await selection.getByRole('button', { name: 'Study word', exact: true }).click()
  await selection.getByRole('button', { name: 'Clear word match', exact: true }).click()
  pending.release()
  await expect(selected).toHaveAttribute('data-word-paired', 'true')
  await expect(selection).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.bible-word-link-active:visible')).toHaveCount(0)
})

test.describe('touch hold during link loading', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 932 } })
  test('a held moved word opens the resolved source after release without a second hold', async ({ page }) => {
    const pending = await holdRussianLinks(page)
    await compare(page, 6)
    await pending.started
    const selected = word(page, '6-1', /^Никак$/)
    await selected.scrollIntoViewIfNeeded()
    const box = await selected.boundingBox(), touch = await page.context().newCDPSession(page)
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] })
      await page.waitForTimeout(700)
    } finally {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch.detach()
    }
    await expect(page.getByRole('region', { name: 'Selected word match', exact: true })).toContainText('Loading word links')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    pending.release()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G3361')
    await expect(dialog.locator('[data-grammar-reference="Romans:6:2"]')).toHaveCount(1)
  })
})
