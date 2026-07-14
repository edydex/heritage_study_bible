import { expect, test } from '@playwright/test'

async function openJournal(page, path = '/#/journal/genesis/1') {
  await page.goto(path, { waitUntil: 'networkidle' })
  await expect(page.locator('#verse-1-1')).toBeVisible({ timeout: 20_000 })
  const tips = page.getByTestId('journal-tips-banner')
  if (await tips.isVisible()) {
    await page.getByTestId('journal-tips-dismiss').click()
  }
}

test.describe('Journaling mode', () => {
  test('opens journal from the reader header', async ({ page }) => {
    await page.goto('/#/genesis/1', { waitUntil: 'networkidle' })
    await expect(page.locator('#verse-1-1')).toBeVisible({ timeout: 20_000 })
    await page.getByTitle('Journaling mode').click()
    await expect(page).toHaveURL(/#\/journal\/genesis\/1/)
    await expect(page.getByTestId('notes-paper-page')).toBeVisible()
  })

  test('shows a one-time tip about double-tap between verses', async ({ page }) => {
    await page.goto('/#/journal/genesis/1', { waitUntil: 'networkidle' })
    await expect(page.locator('#verse-1-1')).toBeVisible({ timeout: 20_000 })

    const banner = page.getByTestId('journal-tips-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('between verses')

    await page.getByTestId('journal-tips-dismiss').click()
    await expect(banner).not.toBeVisible()

    await page.reload({ waitUntil: 'networkidle' })
    await expect(banner).not.toBeVisible({ timeout: 10_000 })
  })

  test('highlights selected text and persists across reload', async ({ page }) => {
    await openJournal(page)

    await page.getByTitle('Highlight text (drag with mouse, finger, or pencil)').click()
    await page.getByTitle('Yellow').click()

    const verseText = page.locator('#verse-1-1 [data-verse-text]')
    const box = await verseText.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.move(box.x + 8, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2)
    await page.mouse.up()

    await expect(page.locator('#verse-1-1 mark.verse-highlight')).toBeVisible({ timeout: 10_000 })

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('#verse-1-1 mark.verse-highlight')).toBeVisible({ timeout: 20_000 })
  })

  test('highlights text via touch pointer drag', async ({ page }) => {
    await openJournal(page)

    await page.getByTitle('Highlight text (drag with mouse, finger, or pencil)').click()
    await page.getByTitle('Yellow').click()

    const verseText = page.locator('#verse-1-1 [data-verse-text]')
    const box = await verseText.boundingBox()
    expect(box).toBeTruthy()

    const startX = box.x + 8
    const endX = box.x + box.width * 0.45
    const y = box.y + box.height / 2

    await page.evaluate(({ startX, endX, y }) => {
      const target = document.querySelector('#verse-1-1 [data-verse-text]')
      const pane = target.closest('.overflow-y-auto') || target
      const fire = (type, x, on) => {
        on.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: 'touch',
          buttons: type === 'pointerup' ? 0 : 1,
        }))
      }
      fire('pointerdown', startX, target)
      fire('pointermove', endX, pane)
      fire('pointerup', endX, pane)
    }, { startX, endX, y })

    await expect(page.locator('#verse-1-1 mark.verse-highlight')).toBeVisible({ timeout: 10_000 })
  })

  test('inserts inline gap on double-tap and saves typed margin notes', async ({ page }) => {
    await openJournal(page)

    const zone = page.getByTestId('gap-zone-after-1')
    await zone.scrollIntoViewIfNeeded()
    await zone.dblclick()
    const gapText = page.getByTestId('journal-gap-text')
    await expect(gapText).toBeVisible()
    await gapText.fill('Margin reflection beside verse 1.')

    await page.waitForTimeout(800)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByTestId('journal-gap-text'))
      .toHaveValue('Margin reflection beside verse 1.', { timeout: 20_000 })
  })

  test('creates notes text block on double-tap and persists', async ({ page }) => {
    await openJournal(page)

    const paper = page.getByTestId('notes-paper-page')
    await paper.dblclick({ position: { x: 40, y: 60 } })

    const block = page.getByTestId('notes-block-text')
    await expect(block).toBeVisible({ timeout: 10_000 })
    await block.fill('In the beginning — my reflection.')
    await page.waitForTimeout(800)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByTestId('notes-block-text'))
      .toHaveValue('In the beginning — my reflection.', { timeout: 20_000 })
  })

  test('deletes a notes text block', async ({ page }) => {
    await openJournal(page)

    const paper = page.getByTestId('notes-paper-page')
    await paper.dblclick({ position: { x: 40, y: 60 } })
    const block = page.getByTestId('notes-block-text')
    await expect(block).toBeVisible()
    await block.fill('Temporary note')

    await page.getByTestId('notes-block-delete').click()
    await expect(block).not.toBeVisible()
  })

  test('adds notes page space', async ({ page }) => {
    await openJournal(page)

    const paper = page.getByTestId('notes-paper-page')
    const before = await paper.evaluate(el => el.style.minHeight)
    await page.getByTestId('add-notes-space').click()
    const after = await paper.evaluate(el => el.style.minHeight)
    expect(after).not.toBe(before)
  })
})
