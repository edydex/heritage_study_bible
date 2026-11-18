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

test('KJV neighbour opens actual polites rather than the different printed TR synonym', async ({ page }) => {
  await compare(page, 'KJV', 'hebrews/8')
  await study(page, word(page, '8-11', 'KJV', /^neighbour$/), 'G4177')
  await close(page)
  const original = word(page, '8-11', 'ORIGINAL', /^πολίτην$/)
  await expect(original).toHaveClass(/bible-word-link-active/)
  await study(page, original, 'G4177')
})

test('BSB need and You open their own real heads inside one source phrase', async ({ page }) => {
  await compare(page, 'BSB', 'hebrews/10')
  const need = word(page, '10-36', 'BSB', /^need$/)
  await study(page, need, 'G5532')
  await close(page)
  await study(page, word(page, '10-36', 'BSB', /^You$/), 'G2192')
})

test('BSB architect and builder highlight and study separate source nouns', async ({ page }) => {
  await compare(page, 'BSB', 'hebrews/11')
  const architect = word(page, '11-10', 'BSB', /^architect$/), builder = word(page, '11-10', 'BSB', /^builder$/)
  await study(page, architect, 'G5079')
  await close(page)
  await expect(builder).not.toHaveClass(/bible-word-link-active/)
  await study(page, builder, 'G1217')
})

test('Russian relative opens the actual relative before its preposition and retains both choices', async ({ page }) => {
  await compare(page, 'SYNO-W', 'romans/8')
  await expect(page.locator('[data-russian-link-coverage]')).toContainText('39 of 39')
  const dialog = await study(page, word(page, '8-15', 'SYNO-W', /^Которым$/), 'G3739')
  await dialog.getByRole('button', { name: 'ἐν', exact: true }).click()
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G1722')
})

test('Russian active seeing reframe stays unlinked while the second actual active verb remains studyable', async ({ page }) => {
  await compare(page, 'SYNO-W', 'romans/8')
  const seeing = word(page, '8-24', 'SYNO-W', /^видит$/)
  await expect(seeing).toHaveCount(2)
  await expect(seeing.first()).toHaveAttribute('data-word-paired', 'false')
  await seeing.first().click()
  await expect(page.getByRole('region', { name: 'Selected word match' })).toContainText('active seeing')
  await study(page, seeing.nth(1), 'G991')
})

test('Russian body adjective and LSV body noun share the actual body source and visual match', async ({ page }) => {
  await compare(page, 'SYNO-W', 'romans/8', 'LSV')
  const ru = word(page, '8-13', 'SYNO-W', /^плотские$/), en = word(page, '8-13', 'LSV', /^body$/)
  await ru.click()
  await expect(en).toHaveClass(/bible-word-link-active/)
  for (const attribute of ['data-word-link', 'data-word-color', 'data-word-texture']) expect(await ru.getAttribute(attribute)).toBe(await en.getAttribute(attribute))
  await study(page, ru, 'G4983')
})

test('Russian immediately resumed formed object uses its actual source noun', async ({ page }) => {
  await compare(page, 'SYNO-W', 'romans/9')
  await expect(page.locator('[data-russian-link-coverage]')).toContainText('33 of 33')
  const noun = word(page, '9-20', 'SYNO-W', /^Изделие$/), resumed = word(page, '9-20', 'SYNO-W', /^его$/)
  await resumed.click()
  await expect(noun).toHaveClass(/bible-word-link-active/)
  await study(page, resumed, 'G4110')
})

test('Russian own righteousness noun is an explicit ellipsis gap between two real source occurrences', async ({ page }) => {
  await compare(page, 'SYNO-W', 'romans/10')
  await expect(page.locator('[data-russian-link-coverage]')).toContainText('21 of 21')
  await expect(word(page, '10-3', 'SYNO-W', /^праведность$/)).toHaveAttribute('data-word-paired', 'false')
  const actual = word(page, '10-3', 'SYNO-W', /^праведности$/)
  await expect(actual).toHaveCount(2)
  await study(page, actual.first(), 'G1343')
  await close(page)
  await expect(actual.nth(1)).not.toHaveClass(/bible-word-link-active/)
  await study(page, actual.nth(1), 'G1343')
})

test.describe('Russian cross-verse formula touch hold', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 932 } })
  test('holding written opens actual Romans 8:36 and remains open on release', async ({ page }) => {
    await compare(page, 'SYNO-W', 'romans/8')
    const selected = word(page, '8-35', 'SYNO-W', /^написано$/)
    await selected.scrollIntoViewIfNeeded()
    const box = await selected.boundingBox(), touch = await page.context().newCDPSession(page)
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] })
      await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G1125')
    } finally {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch.detach()
    }
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G1125')
    await expect(dialog.locator('[data-grammar-reference="Romans:8:36"]')).toHaveCount(1)
  })
})
