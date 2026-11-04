import { test, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('heritage-translation', 'BSB')
    localStorage.setItem('heritage-default-translation-v2', 'done')
    const trail = window.__heritageWheelDiagnostic = {
      documentId: crypto.randomUUID(), timeOrigin: performance.timeOrigin,
      events: [], layouts: [],
    }
    const ids = new WeakMap()
    let nextId = 0, pressed = false, scheduled = false, previous = ''
    const boundedPush = (items, value) => { items.push(value); if (items.length > 120) items.shift() }
    const describe = node => node instanceof Element ? {
      tag: node.tagName, class: String(node.getAttribute('class') || '').slice(0, 180),
      label: node.getAttribute('aria-label'),
      trigger: Boolean(node.closest('.navigation-wheel-trigger')),
    } : null
    const snapshot = () => {
      const button = document.querySelector('.navigation-wheel-trigger')
      if (button && !ids.has(button)) ids.set(button, ++nextId)
      const rect = button?.getBoundingClientRect()
      const style = button && getComputedStyle(button)
      return {
        href: location.href, readyState: document.readyState,
        viewport: { width: innerWidth, height: innerHeight, scale: visualViewport?.scale, devicePixelRatio, scrollX, scrollY },
        title: button ? {
          id: ids.get(button), text: button.textContent,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          display: style.display, visibility: style.visibility, pointerEvents: style.pointerEvents,
        } : null,
        menuOpen: Boolean(document.querySelector('[role="dialog"][aria-label="Slide to navigate"]')),
      }
    }
    trail.snapshot = snapshot
    const sample = () => {
      scheduled = false
      const state = snapshot(), serialized = JSON.stringify(state)
      if (serialized !== previous) {
        boundedPush(trail.layouts, { time: performance.now(), ...state })
        previous = serialized
      }
      if (performance.now() < 2500 || pressed) queueSample()
    }
    const queueSample = () => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(sample) }
    }
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'contextmenu', 'resize', 'popstate']) {
      window.addEventListener(type, event => {
        const button = document.querySelector('.navigation-wheel-trigger')
        if (type === 'pointerdown') pressed = true
        if (type === 'pointerup' || type === 'pointercancel') pressed = false
        boundedPush(trail.events, {
          time: performance.now(), type, x: event.clientX, y: event.clientY,
          pointerId: event.pointerId, pointerType: event.pointerType, buttons: event.buttons,
          target: describe(event.target),
          hit: Number.isFinite(event.clientX) ? describe(document.elementFromPoint(event.clientX, event.clientY)) : null,
          triggerHasCapture: event.pointerId != null && Boolean(button?.hasPointerCapture(event.pointerId)),
          state: snapshot(),
        })
        queueSample()
      }, true)
    }
    queueSample()
  })
})

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  let diagnostic
  try {
    diagnostic = await page.evaluate(() => {
      const trail = window.__heritageWheelDiagnostic
      return trail ? { ...trail, snapshot: undefined, final: trail.snapshot() } : { missingTrail: true, href: location.href }
    })
  } catch (error) {
    diagnostic = { captureError: String(error) }
  }
  const path = testInfo.outputPath('navigation-wheel-failure.json')
  await writeFile(path, JSON.stringify({ title: testInfo.title, retry: testInfo.retry, status: testInfo.status, diagnostic }, null, 2))
  await testInfo.attach('navigation-wheel-failure', { path, contentType: 'application/json' })
})

const wheel = page => page.getByRole('dialog', { name: 'Slide to navigate' })
async function readyBibleTitle(page) {
  // These geometry fixtures need the finished footer: its audio button and
  // swapped web font can both move/shrink the title after the first paint.
  await expect(page.getByRole('button', { name: 'Play chapter audio', exact: true })).toBeVisible()
  const trigger = page.locator('.navigation-wheel-trigger')
  await trigger.evaluate(async () => { await document.fonts.ready })
  await trigger.hover({ trial: true })
  return trigger
}
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
    const trigger = await readyBibleTitle(page)
    const title = await trigger.boundingBox()
    const origin = { x: title.x + title.width * .4, y: title.y + title.height / 2 }
    await trigger.hover({ position: { x: title.width * .4, y: title.height / 2 } })
    await page.mouse.down()
    await expect(wheel(page)).toBeVisible()
    const fan = await wheel(page).boundingBox()
    expect(Math.abs(fan.x + fan.width / 2 - origin.x)).toBeLessThan(1)
    expect(Math.abs(fan.y + fan.height - origin.y)).toBeLessThan(1)
    expect(fan.x).toBeGreaterThanOrEqual(0)
    expect(fan.x + fan.width).toBeLessThanOrEqual(width)
    const base = await wheel(page).locator('.navigation-wheel-base').boundingBox()
    expect(Math.abs(base.y - origin.y)).toBeLessThanOrEqual(1.1)
    expect(Math.abs(base.y + base.height - 844)).toBeLessThan(1)
    for (const label of ['Chapters', 'Audiobooks', 'Books', 'Reading plans', 'Cancel navigation']) {
      const bounds = await wheel(page).getByRole('button', { name: label, exact: true }).boundingBox()
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(origin.y + 1)
    }
    await page.screenshot({ path: test.info().outputPath(`navigation-wheel-${width}.png`) })
    await page.mouse.up()
    await page.keyboard.press('Escape')
  })
}

test('a right-edge hold on a narrow phone keeps each visible label inside its own sector', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/#/genesis/1')
  const trigger = await readyBibleTitle(page)
  const title = await trigger.boundingBox()
  const origin = { x: title.x + title.width * .95, y: title.y + title.height / 2 }
  await trigger.hover({ position: { x: title.width * .95, y: title.height / 2 } })
  await page.mouse.down()
  await expect(wheel(page)).toBeVisible()
  for (const label of ['Chapters', 'Audiobooks', 'Books', 'Reading plans']) {
    const choice = wheel(page).getByRole('button', { name: label, exact: true })
    const renderedLines = await choice.locator('.navigation-wheel-label').evaluate(node => {
      const lines = []
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      let text
      while ((text = walker.nextNode())) {
        const range = document.createRange()
        range.selectNodeContents(text)
        for (const rect of range.getClientRects()) {
          if (rect.width > 0) lines.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
        }
      }
      return lines
    })
    expect(renderedLines.length).toBeGreaterThan(0)
    for (const line of renderedLines) {
      expect(line.y + line.height).toBeLessThanOrEqual(origin.y + 1)
      expect(line.x).toBeGreaterThanOrEqual(0)
      expect(line.x + line.width).toBeLessThanOrEqual(320)
      const belongsToChoice = await choice.evaluate((node, rect) => [rect.x + 1, rect.x + rect.width - 1].every(x => node.contains(document.elementFromPoint(x, rect.y + rect.height / 2))), line)
      expect(belongsToChoice, `${label} must not be clipped by its sector`).toBe(true)
    }
  }
  await page.screenshot({ path: test.info().outputPath('navigation-wheel-320-right-edge.png') })
  await page.mouse.up()
  await page.keyboard.press('Escape')
})

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
  await expect(page.getByRole('heading', { name: 'Audio library', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bible', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toHaveCount(0)
})

test.describe('native touch navigation', () => {
  test.use({ hasTouch: true })

  test('touch taps open chapters and a continuous long touch slides to Audiobooks without native default handling', async ({ page }) => {
    await page.goto('/#/genesis/1')
    const input = await page.context().newCDPSession(page)
    await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    const touch = (type, point) => input.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 0 }] : [] })
    // The native tap queues down/up together; awaiting separate CDP acknowledgements
    // can accidentally keep the finger down beyond the real hold threshold.
    await page.locator('.navigation-wheel-trigger').tap()
    await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toBeVisible()
    await expect(wheel(page)).toHaveCount(0)

    await page.reload()
    const title = await page.locator('.navigation-wheel-trigger').boundingBox()
    const origin = { x: title.x + title.width / 2, y: title.y + title.height / 2 }
    await page.evaluate(() => document.addEventListener('touchstart', event => { window.__titleTouchPrevented = event.defaultPrevented }, { once: true }))
    await touch('touchStart', origin)
    await expect(wheel(page)).toBeVisible()
    await page.waitForTimeout(250)
    expect(await page.evaluate(() => window.__titleTouchPrevented)).toBe(true)
    const target = await wheel(page).getByText('Audiobooks', { exact: true }).boundingBox()
    await touch('touchMove', { x: target.x + target.width / 2, y: target.y + target.height / 2 })
    await expect(wheel(page).getByText('Release for Audiobooks', { exact: true })).toBeVisible()
    await touch('touchEnd')
    await expect(page).toHaveURL(/#\/audio\?kind=audiobook$/)
    await expect(page.getByRole('heading', { name: 'Select Book', exact: true })).toHaveCount(0)
  })
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
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.goto('/#/genesis/1')
  const trigger = page.locator('.navigation-wheel-trigger')
  await expect(trigger).toBeVisible()
  // Keep the move before the application deadline even if a host/browser call
  // stalls. The other hold/slide cases continue to exercise real elapsed time.
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'))
  const bounds = await trigger.boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 40)
  await page.clock.runFor(550)
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
