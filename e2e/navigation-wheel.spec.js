import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'BSB')
    localStorage.setItem('heritage-default-translation-v2', 'done')
  })
})

const wheel = page => page.getByRole('dialog', { name: 'Slide to navigate' })
async function pressTitle(page) {
  const trigger = page.locator('.navigation-wheel-trigger')
  await expect(trigger).toBeVisible()
  const bounds = await trigger.boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  return trigger
}
async function highlightAudiobooks(page) {
  const bounds = await wheel(page).getByRole('button', { name: 'Audiobooks', exact: true }).boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 5 })
  await expect(wheel(page).getByText('Release for Audiobooks', { exact: true })).toBeVisible()
}

for (const book of [false, true]) {
  test(`${book ? 'book' : 'Bible'} title preserves a tap for chapters and opens only the navigation wheel on hold`, async ({ page }) => {
    const path = book ? '/#/resources/books/martyrdom-of-polycarp-lake' : '/#/genesis/1'
    const pickerName = book ? 'Navigate Chapters' : 'Select Book'
    await page.goto(path)
    await page.locator('.navigation-wheel-trigger').click()
    await expect(page.getByRole('heading', { name: pickerName, exact: true })).toBeVisible()
    await expect(wheel(page)).toHaveCount(0)

    await page.reload()
    await pressTitle(page)
    await expect(wheel(page)).toBeVisible()
    await page.mouse.up()
    await expect(wheel(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: pickerName, exact: true })).toHaveCount(0)
    await wheel(page).getByRole('button', { name: 'Cancel navigation' }).click()
    await expect(wheel(page)).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`${book ? 'martyrdom-of-polycarp-lake' : 'genesis/1'}$`))
  })
}

test('a single hold-slide-release gesture opens the audiobook library', async ({ page }) => {
  await page.goto('/#/genesis/1')
  await pressTitle(page)
  await expect(wheel(page)).toBeVisible()
  await highlightAudiobooks(page)
  await page.screenshot({ path: test.info().outputPath('navigation-wheel-phone.png') })
  await page.mouse.up()
  await expect(page).toHaveURL(/#\/audio\?kind=audiobook$/)
  await expect(page.getByRole('button', { name: 'Audiobooks', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toHaveCount(0)
})

test('Escape cancels an already highlighted held gesture without navigating on release', async ({ page }) => {
  await page.goto('/#/genesis/1')
  const trigger = await pressTitle(page)
  await expect(wheel(page)).toBeVisible()
  await highlightAudiobooks(page)
  await page.keyboard.press('Escape')
  await expect(wheel(page)).toHaveCount(0)
  await page.mouse.up()
  await expect(page).toHaveURL(/#\/genesis\/1$/)
  await expect(trigger).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toHaveCount(0)
})

test('pointer cancellation cannot activate the highlighted choice or the ordinary picker', async ({ page }) => {
  await page.goto('/#/genesis/1')
  const trigger = await pressTitle(page)
  await expect(wheel(page)).toBeVisible()
  await highlightAudiobooks(page)
  await trigger.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })
  await expect(wheel(page)).toHaveCount(0)
  await page.mouse.up()
  await expect(page).toHaveURL(/#\/genesis\/1$/)
  await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toHaveCount(0)
})

test('Android Back dismisses the wheel and consumes the event before the underlying reader handles it', async ({ page }) => {
  await page.goto('/#/genesis/1')
  await pressTitle(page)
  await expect(wheel(page)).toBeVisible()
  await highlightAudiobooks(page)
  const consumed = await page.evaluate(() => {
    const event = new CustomEvent('heritage:native-back', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(consumed).toBe(true)
  await expect(wheel(page)).toHaveCount(0)
  await page.mouse.up()
  await expect(page).toHaveURL(/#\/genesis\/1$/)
  await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toHaveCount(0)
})

test('moving before the hold threshold cancels navigation instead of opening the picker', async ({ page }) => {
  await page.goto('/#/genesis/1')
  const trigger = await pressTitle(page)
  const bounds = await trigger.boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 40)
  await page.waitForTimeout(550)
  await page.mouse.up()
  await expect(wheel(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/#\/genesis\/1$/)
})

test('keyboard navigation traps focus, cancels back to the title, and activates a destination', async ({ page }) => {
  await page.goto('/#/genesis/1')
  const trigger = page.locator('.navigation-wheel-trigger')
  await trigger.focus()
  await trigger.press('Shift+Enter')
  await expect(wheel(page)).toBeVisible()
  const chapters = wheel(page).getByRole('button', { name: 'Chapters', exact: true })
  await expect(chapters).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(wheel(page).getByRole('button', { name: 'Cancel navigation' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(chapters).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(wheel(page)).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.press('Shift+Enter')
  await expect(wheel(page)).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(wheel(page).getByRole('button', { name: 'Audiobooks', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/audio\?kind=audiobook$/)
})
