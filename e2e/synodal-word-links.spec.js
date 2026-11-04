import { test, expect } from '@playwright/test'

async function compare(page, primary, path, secondary = 'ORIGINAL') {
  await page.addInitScript(id => {
    localStorage.setItem('heritage-translation', id)
    localStorage.setItem('heritage-default-translation-v2', 'done')
  }, primary)
  await page.goto('/#/' + path)
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: secondary === 'ORIGINAL' ? 'Original languages' : 'Russian', exact: true }).click()
  await page.getByRole('button', { name: secondary === 'ORIGINAL' ? /^Original (Selected )?Original languages/ : /^SYNO-W (Selected )?Russian/ }).click()
}
const token = (page, ref, translation, text) => page.locator('#verse-' + ref + ' [data-translation="' + translation + '"] [data-word-link]:visible').filter({ hasText: text })

for (const english of ['BSB', 'LSV']) test(english + ' and Russian share reviewed colors without an Original column', async ({ page }) => {
  await compare(page, english, 'romans/1', 'SYNO-W')
  await expect(page.locator('[data-russian-link-coverage]')).toContainText('32 of 32')
  const paul = token(page, '1-1', english, /^Paul$/)
  const russian = token(page, '1-1', 'SYNO-W', /^Павел$/)
  await paul.click()
  await expect(russian).toHaveClass(/bible-word-link-active/)
  await expect(page.locator('.bible-word-link-active:visible')).toHaveCount(2)
  expect(await paul.getAttribute('data-word-link')).toBe(await russian.getAttribute('data-word-link'))
  for (const css of ['background-color', 'background-image']) expect(await paul.evaluate((node, css) => getComputedStyle(node)[css], css)).toBe(await russian.evaluate((node, css) => getComputedStyle(node)[css], css))
  await russian.click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Word study: Павел' })
  await expect(dialog.getByRole('heading', { level: 3, name: /G3972/ })).toBeVisible()
  await expect(dialog.locator('[data-word-grammar]')).toHaveAttribute('lang', 'ru')
})

test('Russian counterpart navigation points to the actual preceding Greek verse', async ({ page }) => {
  await compare(page, 'SYNO-W', 'romans/1')
  await token(page, '1-30', 'SYNO-W', /^злоречивы$/).click()
  const selected = page.getByRole('region', { name: 'Selected word match' })
  await expect(selected).toContainText('ψιθυριστάς')
  await expect(selected.getByRole('button', { name: 'Show Original 1:29', exact: true })).toBeVisible()
  await selected.getByRole('button', { name: 'Show Original 1:29', exact: true }).click()
  await expect(token(page, '1-29', 'ORIGINAL', /^ψιθυριστάς$/)).toHaveClass(/bible-word-link-active/)
})

test('an unreviewed Russian numeric word stays studyable without a guessed Greek link', async ({ page }) => {
  await compare(page, 'SYNO-W', 'john/21')
  await expect(page.locator('[data-russian-link-coverage]')).toContainText('0 of 25')
  const number = token(page, '21-11', 'SYNO-W', /^153$/)
  await expect(number).toHaveAttribute('data-word-paired', 'false')
  await number.click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Word study: 153' })
  await expect(dialog).toContainText('Matching word form')
  await expect(dialog.locator('[data-word-grammar]')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Изучить слова оригинала в этом стихе', exact: true }).click()
  await expect(dialog).toContainText('Точное соответствие русскому слову')
  await expect(dialog.getByRole('button', { name: 'ἑκατὸν', exact: true })).toBeVisible()
})

test.describe('Russian touch hold', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 932 } })
  test('hold opens reviewed Russian study and releasing keeps the dialog open', async ({ page }) => {
    await compare(page, 'SYNO-W', 'romans/1')
    const word = token(page, '1-1', 'SYNO-W', /^раб$/)
    await word.scrollIntoViewIfNeeded()
    const box = await word.boundingBox(), touch = await page.context().newCDPSession(page)
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] })
      await page.waitForTimeout(700)
      await expect(page.getByRole('dialog', { name: 'Word study: раб' })).toBeVisible()
    } finally {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch.detach()
    }
    const dialog = page.getByRole('dialog', { name: 'Word study: раб' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { level: 3, name: /G1401/ })).toBeVisible()
    await expect(dialog.locator('[data-word-grammar]')).toHaveAttribute('lang', 'ru')
    await expect(dialog.locator('[data-word-grammar]')).toContainText('Существительное')
    await page.screenshot({ path: test.info().outputPath('synodal-reviewed-romans-study.png') })
  })
})
