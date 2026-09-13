import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const fixture = JSON.parse(readFileSync(
  new URL('../tests/fixtures/community-sermon-publication-conformance-v1.json', import.meta.url),
  'utf8',
))
const catalog = JSON.parse(fixture.catalogSource)
const publicId = catalog.items[0].id
const catalogUrl = 'https://church.example/publications/sermons/catalog.json'
const detailUrl = new URL(catalog.items[0].content.url, catalogUrl).href
const strictContentServer = {
  manifestUrl: 'https://church.example/heritage-content.json',
  enabled: true,
  lastCheckedAt: '2026-07-29T20:15:30.000Z',
  manifest: {
    schemaVersion: 2,
    kind: 'heritage-content-server',
    id: 'example-church',
    name: 'Example Church',
    publications: {
      sermons: {
        schemaVersion: 1,
        kind: 'heritage-public-sermon-publication',
        catalog: {
          url: '/publications/sermons/catalog.json',
          mediaType: 'application/json',
        },
        detailMediaType: 'application/vnd.heritage.sermon+json',
        passageIndex: {
          url: '/indexes/sermon-passages',
          mediaType: 'application/json',
        },
      },
    },
  },
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(server => {
    localStorage.setItem('heritage-content-servers-v2', JSON.stringify([server]))
  }, strictContentServer)

  await page.route(catalogUrl, route => {
    expect(route.request().headers().authorization).toBeUndefined()
    return route.fulfill({
      status: 200,
      body: fixture.catalogSource,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  })
  await page.route(detailUrl, route => {
    expect(route.request().headers().authorization).toBeUndefined()
    return route.fulfill({
      status: 200,
      body: fixture.detailSource,
      headers: {
        'Content-Type': 'application/vnd.heritage.sermon+json; charset=utf-8',
      },
    })
  })
})

test('verified archive card opens an exact stable detail route with click-to-load audio', async ({ page }) => {
  let detailRequests = 0
  page.on('request', request => {
    if (request.url() === detailUrl) detailRequests += 1
  })

  await page.goto('/#/resources/sermons')

  await expect(page.getByRole('heading', { name: 'Published Sermons' })).toBeVisible()
  await expect(page.getByRole('heading', {
    name: 'The Prayer That Transforms the Church',
  })).toBeVisible()
  await expect(page.getByText('Молитва, преображающая Церковь')).toBeVisible()
  await expect(page.getByText(/Paul Lvutin · From Pain to Unity/)).toBeVisible()
  await expect(page.getByText('Ephesians 3:14–21')).toBeVisible()
  await expect(page.getByText('Example Church').first()).toBeVisible()
  expect(detailRequests).toBe(0)

  await page.getByRole('button', {
    name: 'Open The Prayer That Transforms the Church from Example Church',
  }).click()
  await expect(page).toHaveURL(new RegExp(
    `#/resources/sermons/example-church/${publicId}$`,
  ))
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('The reviewed English sermon body.')).toBeVisible()
  const player = page.getByLabel('Play Sermon audio (EN)')
  await expect(player).toHaveAttribute('preload', 'none')
  await expect(player).not.toHaveAttribute('autoplay')
  await expect.poll(() => detailRequests).toBe(1)

  await page.getByRole('button', { name: 'Close sermon viewer' }).click()
  await expect(page).toHaveURL(/#\/resources\/sermons$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto(`/#/resources/sermons/example-church/${publicId}`)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Play Sermon audio (EN)')).toHaveAttribute('preload', 'none')
})

test('Bible passage navigation distinguishes the main reading from mentioned verses', async ({ page }) => {
  await page.goto('/#/ephesians/3')
  await expect(page.locator('#verse-3-18')).toBeVisible({ timeout: 20000 })
  await page.locator('#verse-3-18 [data-verse-content]').click()
  await expect(page.getByRole('heading', { name: 'On this passage', exact: true })).toBeVisible()
  const openSermon = page.getByRole('button', { name: /The Prayer That Transforms the Church Paul Lvutin/ })
  await expect(openSermon).toBeVisible()
  await openSermon.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('The reviewed English sermon body.')).toBeVisible()
  await page.getByRole('button', { name: 'Close sermon viewer' }).click()
  await expect(page).toHaveURL(/#\/ephesians\/3$/)
  await expect(page.locator('#verse-3-18')).toBeVisible()

  await page.goto('/#/ephesians/5')
  await expect(page.locator('#verse-5-2')).toBeVisible()
  await page.locator('#verse-5-2 [data-verse-content]').click()
  await expect(page.getByRole('heading', { name: 'On this passage', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Appears in 1 sermon', exact: true }).click()
  await expect(openSermon).toBeVisible()
})

test('the sermon archive and detail fit a narrow phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/resources/sermons')
  await page.getByRole('button', { name: 'Open The Prayer That Transforms the Church from Example Church' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('The reviewed English sermon body.')).toBeVisible()
  const width = await page.getByRole('dialog').evaluate(node => ({ width: node.getBoundingClientRect().width, scrollWidth: node.scrollWidth }))
  expect(width.width).toBeLessThanOrEqual(390)
  expect(width.scrollWidth).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Close sermon viewer' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
