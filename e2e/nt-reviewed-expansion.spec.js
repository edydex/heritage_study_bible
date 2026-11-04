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

test('the repeated seeing subject in Acts retains its actual preceding infinitive subject', async ({ page }) => {
  await compare(page, 'acts', 22, 'LSV', 'ORIGINAL')
  await words(page, 'LSV', 22, 18, /^I$/).click()
  await expect(words(page, 'ORIGINAL', 22, 17, /^με$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 22, 18, /^ἰδεῖν$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('button', { name: 'Show Original 22:17', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G1473')
})

test('the Asian name moved in Acts preserves its true source verse and separate indefinite qualifier', async ({ page }) => {
  await compare(page, 'acts', 24, 'LSV', 'ORIGINAL')
  await words(page, 'LSV', 24, 18, /^Asia$/).click()
  await expect(words(page, 'ORIGINAL', 24, 19, /^Ἀσίας$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 24, 19, /^τινὲς$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('button', { name: 'Show Original 24:19', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G773')
})

test('Colossians publisher cross wording studies the actual pronoun without borrowing the earlier cross noun', async ({ page }) => {
  await compare(page, 'colossians', 2, 'BSB', 'KJV')
  await words(page, 'BSB', 2, 15, /^cross$/).click()
  await expect(words(page, 'KJV', 2, 15, /^it$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'BSB', 2, 14, /^cross$/)).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G846')
})

test('the repeated clothing command keeps its real Colossians source across translated columns', async ({ page }) => {
  await compare(page, 'colossians', 3, 'BSB', 'KJV')
  await words(page, 'BSB', 3, 14, /^put$/).click()
  await expect(words(page, 'KJV', 3, 14, /^put$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 3, 12, /^Put$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'BSB', 3, 14, /^love$/)).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G1746')
  await expect(dialog.locator('[data-grammar-reference="Colossians:3:12"]')).toHaveCount(1)
})

test('the repeated sending event retains its original Colossians verb and tense', async ({ page }) => {
  await compare(page, 'colossians', 4, 'BSB', 'KJV')
  await words(page, 'BSB', 4, 9, /^sending$/).click()
  await expect(words(page, 'KJV', 4, 8, /^sent$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'BSB', 4, 9, /^Onesimus$/)).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G3992')
  const grammar = dialog.locator('[data-word-grammar]')
  await expect(grammar.locator('[data-grammar-reference="Colossians:4:8"]')).toHaveCount(1)
  await expect(grammar.getByRole('button', { name: /Tense \/ aspect: Aorist/ })).toBeVisible()
})

test('the added broken wording does not borrow the earlier real breaking predicate', async ({ page }) => {
  await compare(page, '1-corinthians', 11, 'LSV', 'ORIGINAL')
  const broken = words(page, 'LSV', 11, 24, /^broken$/)
  await expect(broken).toHaveAttribute('data-word-paired', 'false')
  await broken.click()
  await expect(words(page, 'ORIGINAL', 11, 24, /^ἔκλασεν$/)).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Clear word match' }).click()
  await words(page, 'LSV', 11, 24, /^broke$/).click()
  await expect(words(page, 'ORIGINAL', 11, 24, /^ἔκλασεν$/)).toHaveClass(/bible-word-link-active/)
  await expect(broken).not.toHaveClass(/bible-word-link-active/)
})

test('a feeding verb does not invent a source pronoun for its supplied English recipient', async ({ page }) => {
  await compare(page, '1-corinthians', 13, 'LSV', 'ORIGINAL')
  const others = words(page, 'LSV', 13, 3, /^others$/)
  await expect(others).toHaveAttribute('data-word-paired', 'false')
  await words(page, 'LSV', 13, 3, /^feed$/).click()
  await expect(words(page, 'ORIGINAL', 13, 3, /^ψωμίσω$/)).toHaveClass(/bible-word-link-active/)
  await expect(others).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText('G5595')
})

test('the moved Colossians reconciliation keeps its source verse and cross-translation styling', async ({ page }) => {
  await compare(page, 'colossians', 1, 'KJV', 'BSB')
  const kjv = words(page, 'KJV', 1, 21, /^reconciled$/)
  const bsb = words(page, 'BSB', 1, 22, /^reconciled$/)
  await expect(kjv).toHaveAttribute('data-word-paired', 'true')
  const color = await kjv.getAttribute('data-word-color')
  expect(color).not.toBeNull()
  await expect(bsb).toHaveAttribute('data-word-color', color)
  await expect(bsb).toHaveAttribute('data-word-texture', await kjv.getAttribute('data-word-texture'))
  await kjv.click()
  await expect(bsb).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 1, 21, /^alienated$/)).not.toHaveClass(/bible-word-link-active/)
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G604')
  const grammar = dialog.locator('[data-word-grammar]')
  await expect(grammar.locator('[data-grammar-reference="Colossians:1:22"]')).toHaveCount(1)
  await expect(grammar.getByRole('button', { name: /Tense \/ aspect: Aorist/ })).toBeVisible()
})

test('reordered forgiveness clauses retain both actual perfect occurrences and only their own resumption', async ({ page }) => {
  await compare(page, '2-corinthians', 2, 'LSV', 'ORIGINAL')
  const english = words(page, 'LSV', 2, 10, /^forgiven$/)
  const greek = words(page, 'ORIGINAL', 2, 10, /^κεχ.ρισμαι$/)
  await expect(english).toHaveCount(2)
  await expect(greek).toHaveCount(2)
  for (const [target, source] of [[0, 1], [1, 0]]) {
    await english.nth(target).click()
    await expect(greek.nth(source)).toHaveClass(/bible-word-link-active/)
    await expect(greek.nth(1 - source)).not.toHaveClass(/bible-word-link-active/)
    await page.getByRole('button', { name: 'Clear word match' }).click()
  }
  await words(page, 'LSV', 2, 10, /^forgive$/).nth(1).click()
  await expect(greek.nth(0)).toHaveClass(/bible-word-link-active/)
  await expect(english.nth(1)).toHaveClass(/bible-word-link-active/)
  await expect(english.nth(0)).not.toHaveClass(/bible-word-link-active/)
})

test('an unlike through reading stays unpaired while the actual second Jesus remains distinct', async ({ page }) => {
  await compare(page, '2-corinthians', 4, 'LSV', 'ORIGINAL')
  await expect(words(page, 'LSV', 4, 14, /^through$/)).toHaveAttribute('data-word-paired', 'false')
  const english = words(page, 'LSV', 4, 14, /^Jesus$/)
  await english.nth(1).click()
  await expect(words(page, 'ORIGINAL', 4, 14, /^Ἰησοῦ$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 4, 14, /^Ἰησοῦν$/)).not.toHaveClass(/bible-word-link-active/)
  const withWords = words(page, 'ORIGINAL', 4, 14, /^σὺν$/)
  await expect(withWords).toHaveCount(2)
  await expect(withWords.nth(0)).toHaveAttribute('data-word-paired', 'false')
  await expect(withWords.nth(1)).toHaveAttribute('data-word-paired', 'true')
  for (const index of [0, 1]) await expect(withWords.nth(index)).not.toHaveClass(/bible-word-link-active/)
  await expect(english.nth(0)).not.toHaveClass(/bible-word-link-active/)
})

test('the added Acts verse has explained English without borrowing neighboring Greek', async ({ page }) => {
  await compare(page, 'acts', 28, 'LSV', 'ORIGINAL')
  const verse = page.locator('#verse-28-29')
  await expect(verse.locator('[data-translation="LSV"] [data-word-link]')).not.toHaveCount(0)
  await expect(verse.locator('[data-translation="LSV"] [data-word-paired="true"]')).toHaveCount(0)
  await expect(verse.locator('[data-translation="ORIGINAL"] [data-word-link]')).toHaveCount(0)
  await words(page, 'LSV', 28, 29, /^went$/).click()
  await expect(page.locator('[data-translation="ORIGINAL"] .bible-word-link-active')).toHaveCount(0)
})

test.describe('reviewed Colossians reconciliation on touch screens', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('tap and a held finger study the moved reconciliation predicate', async ({ page }) => {
    await compare(page, 'colossians', 1, 'KJV', 'BSB')
    const reconciled = words(page, 'KJV', 1, 21, /^reconciled$/)
    await reconciled.tap()
    await expect(words(page, 'BSB', 1, 22, /^reconciled$/)).toHaveClass(/bible-word-link-active/)
    await page.getByRole('button', { name: 'Clear word match' }).tap()
    await reconciled.scrollIntoViewIfNeeded()
    const box = await reconciled.boundingBox()
    const touch = await page.context().newCDPSession(page)
    const x = box.x + box.width / 2, y = box.y + box.height / 2
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { level: 3 }).first()).toContainText('G604')
      await expect(dialog.locator('[data-grammar-reference="Colossians:1:22"]')).toHaveCount(1)
    } finally {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch.detach()
    }
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

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

test('reordered eating conditions keep their own repeated Greek predicates and negative', async ({ page }) => {
  await compare(page, '1-corinthians', 8, 'LSV', 'ORIGINAL')
  const english = words(page, 'LSV', 8, 8, /^eat$/)
  const original = words(page, 'ORIGINAL', 8, 8, /^φ.γωμεν$/)
  await expect(english).toHaveCount(2)
  await expect(original).toHaveCount(2)
  for (const [target, source] of [[0, 1], [1, 0]]) {
    await english.nth(target).click()
    await expect(original.nth(source)).toHaveClass(/bible-word-link-active/)
    await expect(original.nth(1 - source)).not.toHaveClass(/bible-word-link-active/)
    await page.getByRole('button', { name: 'Clear word match' }).click()
  }
  await words(page, 'LSV', 8, 8, /^not$/).nth(1).click()
  await expect(words(page, 'ORIGINAL', 8, 8, /^μ.$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'ORIGINAL', 8, 8, /^ο.$/)).not.toHaveClass(/bible-word-link-active/)
})

test('mighty studies the actual power noun without selecting angels or the possessor', async ({ page }) => {
  await compare(page, '2-thessalonians', 1, 'BSB', 'KJV')
  const mighty = words(page, 'BSB', 1, 7, /^mighty$/)
  const counterpart = words(page, 'KJV', 1, 7, /^mighty$/)
  await expect(mighty).toHaveAttribute('data-word-paired', 'true')
  const color = await mighty.getAttribute('data-word-color')
  expect(color).not.toBeNull()
  await expect(counterpart).toHaveAttribute('data-word-color', color)
  await expect(counterpart).toHaveAttribute('data-word-texture', await mighty.getAttribute('data-word-texture'))
  await mighty.click()
  await expect(counterpart).toHaveClass(/bible-word-link-active/)
  for (const translation of ['BSB', 'KJV']) {
    await expect(words(page, translation, 1, 7, /^angels$/)).not.toHaveClass(/bible-word-link-active/)
    await expect(words(page, translation, 1, 7, /^his$/i)).not.toHaveClass(/bible-word-link-active/)
  }
  await page.getByRole('button', { name: 'Study word', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText(/G0*1411\b/)
})

test('the grant of relief shares the real preceding recompense predicate across translations', async ({ page }) => {
  await compare(page, '2-thessalonians', 1, 'BSB', 'KJV')
  await words(page, 'BSB', 1, 7, /^grant$/).click()
  await expect(words(page, 'BSB', 1, 6, /^repay$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 1, 6, /^recompense$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'KJV', 1, 7, /^rest$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(page.getByRole('region', { name: 'Selected word match' }).getByRole('status')).toContainText('Greek 1:6:')
})

test('the repeated restraining predicate matches its actual present head without inventing continuation', async ({ page }) => {
  await compare(page, '2-thessalonians', 2, 'KJV', 'BSB')
  await words(page, 'KJV', 2, 7, /^let$/).click()
  await expect(words(page, 'KJV', 2, 7, /^letteth$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'BSB', 2, 7, /^restrains$/)).toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'BSB', 2, 7, /^continue$/)).not.toHaveClass(/bible-word-link-active/)
  await expect(words(page, 'BSB', 2, 7, /^continue$/)).toHaveAttribute('data-word-paired', 'false')
})

test.describe('reviewed Thessalonian heads on touch screens', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('tap and a long finger hold study the efficacy head across powerful and strong', async ({ page }) => {
    await compare(page, '2-thessalonians', 2, 'BSB', 'KJV')
    const powerful = words(page, 'BSB', 2, 11, /^powerful$/)
    await powerful.tap()
    await expect(words(page, 'KJV', 2, 11, /^strong$/)).toHaveClass(/bible-word-link-active/)
    await expect(words(page, 'BSB', 2, 11, /^delusion$/)).not.toHaveClass(/bible-word-link-active/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Clear word match' }).tap()
    await powerful.scrollIntoViewIfNeeded()
    const box = await powerful.boundingBox()
    const touch = await page.context().newCDPSession(page)
    const x = box.x + box.width / 2, y = box.y + box.height / 2
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
      await expect(page.getByRole('dialog').getByRole('heading', { level: 3 }).first()).toContainText(/G0*1753\b/)
    } finally {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch.detach()
    }
  })
})
