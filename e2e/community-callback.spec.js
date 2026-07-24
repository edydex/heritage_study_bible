import { test, expect } from '@playwright/test'

test.use({
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
})

test('Android web callbacks preserve the token for the Heritage app', async ({ page }) => {
  await page.goto('/#/community/callback?server=https%3A%2F%2Fwotbc.heritage.faith&token=one-time-token')

  await expect(page.getByRole('heading', { name: 'Community sign-in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Heritage app' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue in browser' })).toBeVisible()
  await expect(page.getByText('The one-time link will not be used until the app opens.')).toBeVisible()
})
