import { expect, test } from '@playwright/test'

async function openPsalm(page, chapter, translation, parallelTranslation) {
  await page.addInitScript(({ translation, parallelTranslation }) => {
    localStorage.setItem('heritage-translation', translation)
    localStorage.setItem('heritage-default-translation-v2', 'done')
    if (parallelTranslation) localStorage.setItem('heritage-parallel-translation', parallelTranslation)
  }, { translation, parallelTranslation })
  await page.goto(`/#/psalms/${chapter}`)
}

async function enableParallel(page, edition) {
  await page.getByTitle('Enable parallel mode', { exact: true }).click()
  await page.getByRole('button', { name: edition }).click()
}

function verse(page, translation, number) {
  return page.locator(`[data-verse-content][data-translation="${translation}"][data-verse="${number}"]:visible`)
}

async function expectGapAfterHeading(page, chapter) {
  const heading = page.locator(`#verse-${chapter}-0`)
  const body = page.locator(`#verse-${chapter}-1`)
  await expect(heading).toBeVisible()
  await expect(body).toBeVisible()
  const titleBox = await heading.boundingBox()
  const bodyBox = await body.boundingBox()
  expect(bodyBox.y - (titleBox.y + titleBox.height)).toBeGreaterThanOrEqual(8)
}

for (const stacking of [true, false]) {
  test(`Psalm 51 has a paragraph gap after the title with verse stacking ${stacking}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(value => { localStorage.setItem('heritage-verse-stacking', String(value)) }, stacking)
    await openPsalm(page, 51, 'UKRK')
    await expectGapAfterHeading(page, 51)
  })
}

test('Ukrainian and Russian Psalm 51 show their own heading before the aligned prayer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPsalm(page, 51, 'UKRK', 'SYNO-W')
  await expect(verse(page, 'UKRK', 0)).toContainText('Проводиреві хора')
  await expect(verse(page, 'UKRK', 1)).toHaveText(/^Помилуй мене, Боже/)
  await enableParallel(page, /^SYNO-W Selected Russian Synodal/)
  await expect(verse(page, 'SYNO-W', 0)).toContainText('Начальнику хора. Псалом Давида, когда')
  await expect(verse(page, 'SYNO-W', 1)).toHaveText(/^Помилуй меня, Боже/)
  await expect(verse(page, 'UKRK', 0)).toHaveCount(1)
  await expect(verse(page, 'SYNO-W', 0)).toHaveCount(1)
  await expectGapAfterHeading(page, 51)
})

test('Parallel Psalm 60 lines up Ukrainian and Western body text at their printed references', async ({ page }) => {
  await openPsalm(page, 60, 'UKRK', 'BSB')
  await enableParallel(page, /^BSB Selected Berean Standard Bible/)
  await expect(verse(page, 'UKRK', 0)).toContainText('Проводиреві хора')
  await expect(verse(page, 'UKRK', 1)).toHaveCount(0)
  await expect(verse(page, 'UKRK', 2)).toHaveCount(0)
  const firstBodyRow = page.locator('#verse-60-3')
  await expect(verse(firstBodyRow, 'UKRK', 3)).toContainText('Боже, ти покинув нас')
  await expect(verse(firstBodyRow, 'UKRK', 3).getByTitle('Editorial paragraph break')).toBeVisible()
  await expect(verse(firstBodyRow, 'BSB', 1)).toContainText('You have rejected us, O God')
  await expect(verse(page.locator('#verse-60-14'), 'BSB', 12)).toContainText('With God we will perform')
})

test('Russian Psalm 87 identifies the two opening verses printed together', async ({ page }) => {
  await openPsalm(page, 87, 'BSB', 'SYNO-W')
  await enableParallel(page, /^SYNO-W Selected Russian Synodal/)
  await expect(verse(page, 'SYNO-W', 0)).toContainText('Сынов Кореевых. Псалом. Песнь.')
  await expect(page.locator('#verse-87-1').getByText('Included with verse 2.').filter({ visible: true })).toBeVisible()
  await expect(verse(page, 'SYNO-W', 2)).toHaveText(/^Основание его на горах святых. Господь любит врата Сиона/)
  await expect(page.locator('#verse-87-2').getByRole('button', { name: 'Bookmark verse 1–2', exact: true })).toBeVisible()
})
