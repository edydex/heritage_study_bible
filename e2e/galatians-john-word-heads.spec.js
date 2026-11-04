import { expect, test } from '@playwright/test'

const words = (page, translation, chapter, verse, text) => page.locator(`#verse-${chapter}-${verse} [data-translation="${translation}"] [data-word-link]:visible`).filter({ hasText: text })

async function compare(page, book, chapter, primary, secondary) {
  await page.addInitScript(id => {
    localStorage.setItem('heritage-translation', id)
    localStorage.setItem('heritage-default-translation-v2', 'done')
  }, primary)
  await page.goto(`/#/${book}/${chapter}`)
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  const original = secondary === 'ORIGINAL'
  await page.getByRole('button', { name: original ? 'Original languages' : 'English', exact: true }).click()
  await page.getByRole('button', { name: original ? /^Original (Selected )?Original languages/ : new RegExp(`^${secondary} (Selected )?`) }).click()
  await expect(page.locator(`[data-translation="${primary}"] [data-word-paired="true"]:visible`).first()).toBeVisible()
}

test('Galatians greeting names retain separate heads across translated columns', async ({ page }) => {
  await compare(page, 'galatians', 1, 'BSB', 'KJV')
  for (const [name, other, strong] of [['Jesus', 'Christ', 'G2424'], ['Christ', 'Jesus', 'G5547']]) {
    const source = words(page, 'BSB', 1, 3, new RegExp(`^${name}$`))
    const counterpart = words(page, 'KJV', 1, 3, new RegExp(`^${name}$`))
    const color = await source.getAttribute('data-word-color')
    expect(color).not.toBeNull()
    await expect(counterpart).toHaveAttribute('data-word-color', color)
    await expect(counterpart).toHaveAttribute('data-word-texture', await source.getAttribute('data-word-texture'))
    await source.click()
    await expect(counterpart).toHaveClass(/bible-word-link-active/)
    await expect(words(page, 'KJV', 1, 3, new RegExp(`^${other}$`))).not.toHaveClass(/bible-word-link-active/)
    await page.getByRole('button', { name: 'Study word', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText(strong)
    await page.getByRole('button', { name: 'Close word study', exact: true }).click()
  }
})

test('the moved co-crucifixion clause shares translated colors and its actual prior reference', async ({ page }) => {
  await compare(page, 'galatians', 2, 'BSB', 'KJV')
  const bsb = words(page, 'BSB', 2, 20, /^crucified$/), kjv = words(page, 'KJV', 2, 20, /^crucified$/)
  const color = await bsb.getAttribute('data-word-color')
  expect(color).not.toBeNull()
  await expect(kjv).toHaveAttribute('data-word-color', color)
  await expect(kjv).toHaveAttribute('data-word-texture', await bsb.getAttribute('data-word-texture'))
  await kjv.click()
  await expect(bsb).toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('region', { name: 'Selected word match', exact: true }).getByRole('status')).toContainText('Greek 2:19: συνεσταύρωμαι')
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G4957')
})

test('the first translated Christ retains the moved dative rather than the local repeated name', async ({ page }) => {
  await compare(page, 'galatians', 2, 'KJV', 'ORIGINAL')
  const christ = words(page, 'KJV', 2, 20, /^Christ$/)
  await expect(christ).toHaveCount(2)
  await christ.first().click()
  await expect(words(page, 'ORIGINAL', 2, 19, /^Χριστῷ$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 2, 20, /^Χριστός$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(christ.last()).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('button', { name: 'Show Original 2:19', exact: true })).toBeVisible()
})

for (const fixture of [
  { verse: 10, word: 'living', greek: /^ζῶν$/, other: /^ὕδωρ$/, strong: 'G2198' },
  { verse: 44, word: 'own', greek: /^ἰδίᾳ$/, other: /^πατρίδι$/, strong: 'G2398' },
  { verse: 52, word: 'seventh', greek: /^ἑβδόμην$/, other: /^ὥραν$/, otherOccurrence: 1, strong: 'G1442' },
]) {
  test(`John 4:${fixture.verse} ${fixture.word} opens its precise head separately from the noun`, async ({ page }) => {
    await compare(page, 'john', 4, 'LSV', 'ORIGINAL')
    await words(page, 'LSV', 4, fixture.verse, new RegExp(`^${fixture.word}$`)).click()
    await expect(words(page, 'ORIGINAL', 4, fixture.verse, fixture.greek)).toHaveClass(/bible-word-link-active/)
    await expect(words(page, 'ORIGINAL', 4, fixture.verse, fixture.other).nth(fixture.otherOccurrence ?? 0)).not.toHaveClass(/bible-word-link-active/)
    await page.getByRole('button', { name: 'Study word', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText(fixture.strong)
  })
}
