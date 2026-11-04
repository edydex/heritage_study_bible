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

test('the resumed prices in Acts keep the actual preceding-verse source occurrence', async ({ page }) => {
  await compare(page, 'acts', 4, 'LSV', 'ORIGINAL')
  const resumed = words(page, 'LSV', 4, 35, /^them$/)
  const prices = words(page, 'ORIGINAL', 4, 34, /^τιμὰς$/)
  await expect(resumed).toHaveAttribute('data-word-paired', 'true')
  await resumed.click()
  await expect(prices).toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('button', { name: 'Show Original 4:34', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G5092')
})

test('one actual preposition owns both coordinated recipients without borrowing the personal name', async ({ page }) => {
  await compare(page, '1-corinthians', 4, 'LSV', 'ORIGINAL')
  const preposition = words(page, 'ORIGINAL', 4, 6, /^εἰς$/)
  const repeated = words(page, 'LSV', 4, 6, /^to$/)
  await repeated.nth(1).click()
  await expect(preposition).toHaveClass(/bible-word-link-active/)
  await expect(repeated.nth(0)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'LSV', 4, 6, /^Apollos$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 4, 6, /^Ἀπολλῶν$/)).not.toHaveClass(/bible-word-link-active/)
})

test('different James dwelling readings stay unpaired while word study retains the actual lemma', async ({ page }) => {
  await compare(page, 'james', 4, 'BSB', 'KJV')
  const caused = words(page, 'BSB', 4, 5, /^caused$/)
  const dwelleth = words(page, 'KJV', 4, 5, /^dwelleth$/)
  // Paired describes a match between the two displayed translations. The
  // original-source lookup still supports study when that counterpart is absent.
  await expect(caused).toHaveAttribute('data-word-paired', 'false')
  await expect(dwelleth).toHaveAttribute('data-word-paired', 'false')
  await caused.click()
  await expect(dwelleth).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const study = page.getByRole('dialog')
  await expect(study.getByRole('heading', { level: 3 }).first()).toContainText('κατοικίζω')
  await expect(study.getByRole('heading', { level: 3 }).first()).toContainText(/G0*2730\b/)
  await expect(study.locator('strong').filter({ hasText: /^James 4:5$/ })).toBeVisible()
  await expect(study.locator('strong').filter({ hasText: /^Matthew 2:23$/ })).toHaveCount(0)
})

test('singular English recipients retain their distinct actual plural pronoun occurrences', async ({ page }) => {
  await compare(page, 'james', 2, 'BSB', 'KJV')
  const recipients = words(page, 'KJV', 2, 16, /^them$/)
  await expect(recipients).toHaveCount(2)
  for (const [text, index] of [[/^him$/, 0], [/^his$/, 1]]) {
    const singular = words(page, 'BSB', 2, 16, text)
    await expect(singular).toHaveAttribute('data-word-paired', 'true')
    await singular.click()
    await expect(recipients.nth(index)).toHaveClass(/bible-word-link-active/)
    await expect(recipients.nth(1 - index)).not.toHaveClass(/bible-word-link-active/)
    await page.getByRole('button', { name: 'Clear word match' }).click()
  }
})

test('the repeated contrast predicate retains its one actual preceding-verse source', async ({ page }) => {
  await compare(page, '1-peter', 3, 'KJV', 'ORIGINAL')
  const repeated = words(page, 'KJV', 3, 4, /^be$/).first()
  const original = words(page, 'ORIGINAL', 3, 3, /^ἔστω$/)
  await repeated.click()
  await expect(original).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 3, 3, /^be$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 3, 4, /^is$/).first()).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('button', { name: 'Show Original 3:3', exact: true })).toBeVisible()
})

test('Peter comparison keeps different named readings separate and preserves moved qualifications', async ({ page }) => {
  await compare(page, '1-peter', 3, 'BSB', 'KJV')
  const christ = words(page, 'BSB', 3, 15, /^Christ$/)
  const god = words(page, 'KJV', 3, 15, /^God$/)
  await expect(christ).toHaveAttribute('data-word-paired', 'false')
  await expect(god).toHaveAttribute('data-word-paired', 'false')
  await christ.click()
  await expect(god).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Clear word match' }).click()

  const respect = words(page, 'BSB', 3, 15, /^respect$/)
  const fear = words(page, 'KJV', 3, 15, /^fear$/)
  await expect(respect).toHaveAttribute('data-word-paired', 'true')
  await respect.click()
  await expect(fear).toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('region', { name: 'Selected word match' }).getByRole('status')).toContainText('Greek 3:16:')
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText(/G0*5401\b/)
})

test('one Peter comparison word covers its coordinated list without selecting the later occurrence', async ({ page }) => {
  await compare(page, '1-peter', 4, 'KJV', 'ORIGINAL')
  const translated = words(page, 'KJV', 4, 15, /^as$/)
  const originals = words(page, 'ORIGINAL', 4, 15, /^ὡς$/)
  await expect(translated).toHaveCount(4)
  await expect(originals).toHaveCount(2)
  await translated.nth(2).click()
  for (const index of [0, 1, 2]) await expect(translated.nth(index)).toHaveClass(/bible-word-link-active/)
  await expect(originals.nth(0)).toHaveClass(/bible-word-link-active/)
  await expect(translated.nth(3)).not.toHaveClass(/bible-word-link-active/)
  await expect(originals.nth(1)).not.toHaveClass(/bible-word-link-active/)
})

test('translated Thessalonian adverbs match across the verse boundary and retain their original study reference', async ({ page }) => {
  await compare(page, '1-thessalonians', 1, 'BSB', 'KJV')
  const continually = words(page, 'BSB', 1, 3, /^continually$/)
  await expect(continually).toHaveAttribute('data-word-paired', 'true')
  await continually.click()
  await expect(words(page, 'KJV', 1, 3, /^without$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 1, 3, /^ceasing$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 1, 2, /^always$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('region', { name: 'Selected word match' }).getByRole('status')).toContainText('Greek 1:2:')
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText(/G0*89\b/)
})

test('the Thessalonian walking subject stays separate from the encouragement and calling recipients', async ({ page }) => {
  await compare(page, '1-thessalonians', 2, 'BSB', 'KJV')
  const recipients = words(page, 'BSB', 2, 12, /^you$/)
  await expect(recipients).toHaveCount(4)
  await recipients.nth(2).click()
  await expect(words(page, 'KJV', 2, 12, /^ye$/)).toHaveClass(/bible-word-link-active/)
  for (const index of [0, 1, 3]) await expect(recipients.nth(index)).not.toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 2, 12, /^you$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 2, 11, /^you$/)).not.toHaveClass(/bible-word-link-active/)
})

test('Peter links the actual gloom word without confusing it with weather mists', async ({ page }) => {
  await compare(page, '2-peter', 2, 'BSB', 'KJV')
  const mist = words(page, 'KJV', 2, 17, /^mist$/)
  await expect(mist).toHaveAttribute('data-word-paired', 'true')
  await mist.click()
  await expect(words(page, 'BSB', 2, 17, /^Blackest$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'BSB', 2, 17, /^mists$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'BSB', 2, 17, /^darkness$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 2, 17, /^clouds$/)).toHaveAttribute('data-word-paired', 'false')
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText(/G0*2217\b/)
})

test('the writing instrument relation selects the real hand head and preserves its separate possessor', async ({ page }) => {
  await compare(page, 'colossians', 4, 'LSV', 'ORIGINAL')
  await words(page, 'LSV', 4, 18, /^by$/).click()
  await expect(words(page, 'LSV', 4, 18, /^hand$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 4, 18, /^τῇ$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 4, 18, /^χειρὶ$/)).toHaveClass(/bible-word-link-active/)
  const possessors = words(page, 'LSV', 4, 18, /^my$/)
  await expect(possessors).toHaveCount(2)
  for (const index of [0, 1]) await expect(possessors.nth(index)).not.toHaveClass(/bible-word-link-active/)
})

test('a translated verse absent from the Greek numbering studies the actual preceding-verse word', async ({ page }) => {
  await compare(page, 'acts', 19, 'LSV', 'ORIGINAL')
  const dismissed = words(page, 'LSV', 19, 41, /^dismissed$/)
  await expect(dismissed).toHaveAttribute('data-word-paired', 'true')
  await dismissed.click()
  await expect(words(page, 'ORIGINAL', 19, 40, /^ἀπ.λυσεν$/)).toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('region', { name: 'Selected word match' }).getByRole('status')).toContainText('Greek 19:40:')
  await expect(page.getByRole('button', { name: 'Show Original 19:40', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText(/G0*630\b/)
})
