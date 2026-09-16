import { expect, test } from '@playwright/test'

const event = { id: 1, instanceId: '1:2026-09-24T17:00:00Z', title: 'Prayer Retreat', startsAt: '2026-09-24T17:00:00Z', endsAt: '2026-09-27T01:00:00Z', timeZone: 'PST', description: 'Three days of prayer and fellowship.', location: 'Retreat center', url: 'https://example.org/register', date: '2026-09-24' }
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.addInitScript(() => localStorage.setItem('heritage-communities-v1', JSON.stringify([{ manifest: { id: 'event-test', name: 'Event Test Church', apiBaseUrl: 'https://events.example/api' }, status: 'following', primary: true }])))
  await page.route('https://events.example/api/community/calendar?*', route => route.fulfill({ json: { timeZone: 'America/Los_Angeles', events: [event], authenticated: false } }))
  await page.route('https://events.example/api/community/calendar/events/**', route => route.fulfill({ json: { event, authenticated: false } }))
})
test('legacy PST event opens a dedicated page and supports reload, back and phone layout', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/community/calendar?community=event-test')
  await page.getByRole('link', { name: 'Prayer Retreat', exact: true }).click()
  await expect(page).toHaveURL(/calendar\/events\/1\?date=2026-09-24&community=event-test/)
  await expect(page.getByRole('heading', { name: 'Prayer Retreat', exact: true })).toBeVisible()
  await expect(page.getByText(event.description)).toBeVisible()
  await expect(page.getByText('Retreat center', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Registration or event website' })).toHaveAttribute('href', event.url)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Prayer Retreat', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `/private/tmp/heritage-event-details-${test.info().project.name}.png`, fullPage: true })
  await page.getByRole('link', { name: 'Back to calendar' }).click()
  await expect(page.getByRole('region', { name: 'Church calendar' })).toBeVisible()
  expect(errors).toEqual([])
})
test('a protected or removed event shows a useful unavailable page without crashing', async ({ page }) => {
  await page.route('https://events.example/api/community/calendar/events/**', route => route.fulfill({ status: 404, json: { error: 'This event is unavailable or requires church membership.' } }))
  await page.goto('/#/community/calendar/events/1?community=event-test&date=2026-09-24')
  await expect(page.getByRole('alert')).toContainText('Event unavailable')
  await expect(page.getByRole('heading', { name: 'Prayer Retreat' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Back to calendar' })).toBeVisible()
})
