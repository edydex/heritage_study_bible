import { expect, test } from '@playwright/test'

test('song title hover and keyboard focus preview the first section without navigating', async ({ page }) => {
  await page.goto('/#/resources/songs')
  const song = page.getByRole('button').filter({ has: page.getByRole('heading', { name:'Amazing Grace', exact:true }) })
  await song.hover()
  const preview = page.getByRole('tooltip')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText(/Amazing grace/i)
  await expect(page).toHaveURL(/#\/resources\/songs$/)
  await page.keyboard.press('Escape')
  await expect(preview).toHaveCount(0)
  await song.focus()
  await expect(preview).toBeVisible()
  await song.click()
  await expect(page).toHaveURL(/#\/resources\/songs\/amazing-grace$/)
})
