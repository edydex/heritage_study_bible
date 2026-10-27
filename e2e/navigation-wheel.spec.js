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
  const bounds = await wheel(page).getByRole('button', { name: 'Audiobooks', exact: true }).getByText('Audiobooks', { exact: true }).boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 5 })
  await expect(wheel(page).getByText('Release for Audiobooks', { exact: true })).toBeVisible()
}

for (const width of [320, 390]) {
  test(`the ${width}px upper wheel stays anchored at the held title with every choice above the finger`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/#/genesis/1')
    const trigger = page.locator('.navigation-wheel-trigger')
    const title = await trigger.boundingBox()
    const origin = { x: title.x + title.width * .4, y: title.y + title.height / 2 }
    await page.mouse.move(origin.x, origin.y)
    await page.mouse.down()
    await expect(wheel(page)).toBeVisible()
    const fan = await wheel(page).boundingBox()
    expect(Math.abs(fan.x + fan.width / 2 - origin.x)).toBeLessThan(1)
    expect(Math.abs(fan.y + fan.height - origin.y)).toBeLessThan(1)
    expect(fan.x).toBeGreaterThanOrEqual(0)
    expect(fan.x + fan.width).toBeLessThanOrEqual(width)
    for (const label of ['Chapters', 'Audiobooks', 'Books', 'Reading plans', 'Cancel navigation']) {
      const bounds = await wheel(page).getByRole('button', { name: label, exact: true }).boundingBox()
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(origin.y + 1)
    }
    await page.screenshot({ path: test.info().outputPath(`navigation-wheel-${width}.png`) })
    await page.mouse.up()
    await page.keyboard.press('Escape')
  })
}

for (const label of ['Chapters', 'Audiobooks', 'Books', 'Reading plans']) {
  test(`holding and sliding upward selects ${label}`, async ({ page }) => {
    await page.goto('/#/genesis/1')
    const title = await pressTitle(page)
    const origin = await title.boundingBox()
    await expect(wheel(page)).toBeVisible()
    const choice = wheel(page).getByRole('button', { name: label, exact: true })
    const target = await choice.getByText(label, { exact: true }).boundingBox()
    expect(target.y + target.height / 2).toBeLessThan(origin.y + origin.height / 2)
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 })
    await expect(wheel(page).getByText(`Release for ${label}`, { exact: true })).toBeVisible()
    await page.mouse.up()
    if (label === 'Chapters') await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toBeVisible()
    else if (label === 'Audiobooks') await expect(page).toHaveURL(/#\/audio\?kind=audiobook$/)
    else if (label === 'Books') await expect(page).toHaveURL(/#\/resources\/books$/)
    else await expect(page).toHaveURL(/#\/resources\/reading-plans$/)
  })
}

test('a downward slide clears the upward selection and cannot navigate', async ({ page }) => {
  await page.goto('/#/genesis/1')
  const trigger = await pressTitle(page)
  const title = await trigger.boundingBox()
  await expect(wheel(page)).toBeVisible()
  await highlightAudiobooks(page)
  await page.mouse.move(title.x + title.width / 2 + 60, title.y + title.height / 2 + 5, { steps: 4 })
  await expect(wheel(page).locator('.navigation-wheel-choice.is-active')).toHaveCount(0)
  await page.mouse.up()
  await expect(page).toHaveURL(/#\/genesis\/1$/)
  await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
})

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
