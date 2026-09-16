import { expect, test } from '@playwright/test'

const church = { manifest: { id: 'calendar-test', name: 'Calendar Test Church', apiBaseUrl: 'https://calendar.example/api' }, status: 'following', primary: true }
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.addInitScript(church => {
    localStorage.setItem('heritage-communities-v1', JSON.stringify([church]))
    localStorage.setItem('heritage-content-servers-v2', JSON.stringify([{ enabled: true, manifest: { id: 'test-songs', name: 'Test songs' }, catalogs: { songs: { items: [{ id: '1', title: 'Formatting Example', content: { url: 'https://calendar.example/song.json', mediaType: 'application/vnd.heritage.song+json' } }] } } }]))
  }, church)
  await page.route('https://calendar.example/**', route => {
    if (route.request().url().includes('/song.json')) return route.fulfill({ json: { title: 'Formatting Example', lyrics: '^1\nFirst sung line\nSecond sung line\n---\nA new paragraph\n\n^2\nThe next verse', russianLyrics: '^1\nПервая строка\n---\nВторая строка\n\n^2\nДругой куплет' } })
    if (route.request().url().includes('/community/calendar')) return route.fulfill({ json: { timeZone: 'America/Los_Angeles', authenticated: false, events: [
      { id: 1, instanceId: 'retreat', title: 'Prayer Retreat', startsAt: '2026-09-24T17:00:00Z', endsAt: '2026-09-27T01:00:00Z', timeZone: 'America/Los_Angeles' },
      { id: 2, instanceId: 'across-weeks', title: 'Church camp', startsAt: '2026-09-26T17:00:00Z', endsAt: '2026-09-29T01:00:00Z', timeZone: 'America/Los_Angeles' },
    ] } })
    return route.fulfill({ status: 503, json: { error: 'Fixture endpoint unavailable' } })
  })
})

test('calendar opens on demand, spans dates and fits a phone', async ({ page }) => {
  await page.goto('/#/community')
  await expect(page.getByRole('region', { name: 'Church calendar' })).toHaveCount(0)
  await page.getByRole('button', { name: /^Calendar See/ }).click()
  await expect(page).toHaveURL(/community\/calendar/)
  const heading = page.locator('.church-calendar__toolbar h3')
  await expect(heading).toHaveText('September 2026')
  const retreat = page.getByRole('link', { name: 'Prayer Retreat', exact: true })
  await expect(retreat).toHaveCount(1)
  await expect(page.getByRole('link', { name: /Church camp/ })).toHaveCount(2)
  const dateWidth = (await page.locator('.church-calendar__day').first().boundingBox()).width
  expect((await retreat.boundingBox()).width).toBeGreaterThan(dateWidth * 2.8)
  await page.getByRole('button', { name: '2026-09-25, view events, 1 events' }).click()
  await expect(page.getByRole('heading', { name: 'Prayer Retreat →' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/private/tmp/heritage-calendar-phone-20260916.png', fullPage: true })
})

test('English and Russian lyrics hide cue markers and keep paragraph and verse separation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/resources/songs/song-formatting-example')
  await expect(page.getByRole('heading', { name: 'Verse 1', exact: true })).toBeVisible()
  await expect(page.locator('.song-lyrics__section')).toHaveCount(2)
  await expect(page.locator('.song-lyrics__section').first().locator('p')).toHaveCount(2)
  await expect(page.locator('.song-lyrics')).not.toContainText('^1')
  await expect(page.locator('.song-lyrics')).not.toContainText('---')
  await page.getByRole('button', { name: /RU/ }).click()
  await expect(page.getByRole('heading', { name: 'Куплет 2' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/private/tmp/heritage-song-phone-20260916.png', fullPage: true })
})
