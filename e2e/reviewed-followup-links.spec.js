import { expect, test } from '@playwright/test'

const word = (page, ref, translation, text) => page.locator(`#verse-${ref} [data-translation="${translation}"] [data-word-link]:visible`).filter({ hasText: text })
async function compare(page, primary, path, secondary = 'ORIGINAL') {
  await page.addInitScript(id => {
    localStorage.setItem('heritage-translation', id)
    localStorage.setItem('heritage-default-translation-v2', 'done')
  }, primary)
  await page.goto('/#/' + path)
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: secondary === 'ORIGINAL' ? 'Original languages' : 'English', exact: true }).click()
  await page.getByRole('button', { name: secondary === 'ORIGINAL' ? /^Original (Selected )?Original languages/ : new RegExp(`^${secondary} (Selected )?`) }).click()
  await expect(page.locator(`[data-translation="${primary}"] [data-word-paired="true"]:visible`).first()).toBeVisible()
}
async function study(page, selected, strong) {
  await expect(selected).toHaveCount(1)
  await selected.click()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText(strong)
  return dialog
}
const close = page => page.getByRole('button', { name: 'Close word study', exact: true }).click()

for (const f of [
  { translation: 'KJV', ref: '7-11', target: /^therefore$/, strong: 'G3767', original: /^οὖν$/ },
  { translation: 'BSB', ref: '7-18', target: /^So$/, strong: 'G1063', original: /^γὰρ$/ },
  { translation: 'BSB', ref: '7-20', target: /^others$/, strong: 'G3588', original: /^οἱ$/ },
  { translation: 'KJV', ref: '7-21', target: /^those$/, strong: 'G3588', original: /^οἱ$/, originalRef: '7-20' },
]) test(`${f.translation} Hebrews ${f.ref} ${f.target.source} opens its actual connective or personal class`, async ({ page }) => {
  await compare(page, f.translation, 'hebrews/7')
  const dialog = await study(page, word(page, f.ref, f.translation, f.target), f.strong)
  await expect(dialog.getByRole('button', { name: 'μέν', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await dialog.getByRole('button', { name: 'μέν', exact: true }).click()
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G3303')
  await close(page)
  const ref = f.originalRef || f.ref
  const original = word(page, ref, 'ORIGINAL', f.original)
  await expect(original).toHaveClass(/bible-word-link-active/)
  if (f.originalRef) await expect(page.getByRole('button', { name: 'Show Original 7:20', exact: true })).toBeVisible()
  await study(page, original, f.strong)
  await close(page)
  await study(page, word(page, ref, 'ORIGINAL', /^μὲν$/), 'G3303')
})

test('Russian comparative wording shares the actual original phrase with BSB and keeps its own preferred head', async ({ page }) => {
  await compare(page, 'SYNO-W', 'romans/5', 'BSB')
  await expect(page.locator('[data-russian-link-coverage]')).toContainText('21 of 21')
  const russian = word(page, '5-15', 'SYNO-W', /^более$/), english = word(page, '5-15', 'BSB', /^more$/)
  await russian.click()
  await expect(english).toHaveClass(/bible-word-link-active/)
  for (const attr of ['data-word-link', 'data-word-color', 'data-word-texture']) expect(await russian.getAttribute(attr)).toBe(await english.getAttribute(attr))
  const dialog = await study(page, russian, 'G3123')
  await expect(dialog.getByRole('button', { name: 'πολύς', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await dialog.getByRole('button', { name: 'πολύς', exact: true }).click()
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G4183')
})

test('Russian rejection wording navigates to the actual next Greek verse and preserves both source choices', async ({ page }) => {
  await compare(page, 'SYNO-W', 'romans/6')
  await expect(page.locator('[data-russian-link-coverage]')).toContainText('23 of 23')
  const russian = word(page, '6-1', 'SYNO-W', /^Никак$/)
  await russian.click()
  await page.getByRole('button', { name: 'Show Original 6:2', exact: true }).click()
  await expect(word(page, '6-2', 'ORIGINAL', /^μὴ$/)).toHaveClass(/bible-word-link-active/)
  await expect(word(page, '6-2', 'ORIGINAL', /^γένοιτο$/)).toHaveClass(/bible-word-link-active/)
  const dialog = await study(page, russian, 'G3361')
  await expect(dialog.getByRole('button', { name: 'γίνομαι', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await close(page)
  await study(page, word(page, '6-2', 'ORIGINAL', /^γένοιτο$/), 'G1096')
})

test('LSV continuous and life open their separate actual adjective and noun', async ({ page }) => {
  await compare(page, 'LSV', 'john/5')
  const continuous = word(page, '5-24', 'LSV', /^continuous$/), life = word(page, '5-24', 'LSV', /^life$/)
  await expect(life).toHaveCount(2)
  await study(page, continuous, 'G166')
  await close(page)
  await expect(life.first()).not.toHaveClass(/bible-word-link-active/)
  await expect(word(page, '5-24', 'ORIGINAL', /^αἰώνιον$/)).toHaveClass(/bible-word-link-active/)
  await study(page, life.first(), 'G2222')
  await close(page)
  await expect(continuous).not.toHaveClass(/bible-word-link-active/)
})

test.describe('Russian moved-word touch hold', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 932 } })
  test('holding the moved rejection opens its actual negative and stays open after release', async ({ page }) => {
    await compare(page, 'SYNO-W', 'romans/6')
    const selected = word(page, '6-1', 'SYNO-W', /^Никак$/)
    await selected.scrollIntoViewIfNeeded()
    const box = await selected.boundingBox(), touch = await page.context().newCDPSession(page)
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] })
      await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G3361')
    } finally {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch.detach()
    }
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G3361')
    await expect(dialog.locator('[data-grammar-reference="Romans:6:2"]')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'γίνομαι', exact: true }).click()
    await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G1096')
    await expect(dialog.locator('[data-grammar-reference="Romans:6:2"]')).toHaveCount(1)
    await expect(dialog.locator('[data-word-grammar]').getByRole('button', { name: /Желательное/ })).toBeVisible()
  })
})
