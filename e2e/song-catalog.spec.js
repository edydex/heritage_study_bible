import { expect, test } from '@playwright/test'

const contentServers = [
  {
    enabled: true,
    manifest: { id: 'main-content', name: 'Main Church' },
    catalogs: {
      songs: {
        items: [{
          id: 'main-song',
          title: 'Merge Test Hymn',
          russianTitle: 'Проверка объединения',
          description: 'Main version',
          content: { url: 'https://main.example/song.json', mediaType: 'application/vnd.heritage.song+json' },
        }, {
          id: 'before-song',
          title: 'Before the Throne of God Above',
          russianTitle: 'На небесах Ходатай мой',
          description: 'Community version',
          content: { url: 'https://main.example/before.json', mediaType: 'application/vnd.heritage.song+json' },
        }],
      },
    },
  },
  {
    enabled: true,
    manifest: { id: 'earlier-content', name: 'Earlier Church' },
    catalogs: {
      songs: {
        items: [{
          id: 'earlier-song',
          title: 'Merge Test Hymn',
          description: 'Earlier secondary version',
          content: { url: 'https://earlier.example/song.json', mediaType: 'application/vnd.heritage.song+json' },
        }],
      },
    },
  },
  {
    enabled: true,
    manifest: { id: 'later-content', name: 'Later Church' },
    catalogs: {
      songs: {
        items: [{
          id: 'later-song',
          title: 'Merge Test Hymn',
          description: 'Later secondary version',
          content: { url: 'https://later.example/song.json', mediaType: 'application/vnd.heritage.song+json' },
        }],
      },
    },
  },
]

const communities = [
  {
    manifest: {
      id: 'main',
      name: 'Main Church',
      apiBaseUrl: 'https://main.example/api',
      contentServerUrl: 'https://main.example/heritage-content.json',
    },
    contentPreview: { manifest: { id: 'main-content' } },
    primary: true,
    addedAt: '2026-02-01T00:00:00Z',
  },
  {
    manifest: {
      id: 'later',
      name: 'Later Church',
      apiBaseUrl: 'https://later.example/api',
      contentServerUrl: 'https://later.example/heritage-content.json',
    },
    contentPreview: { manifest: { id: 'later-content' } },
    primary: false,
    addedAt: '2026-03-01T00:00:00Z',
  },
  {
    manifest: {
      id: 'earlier',
      name: 'Earlier Church',
      apiBaseUrl: 'https://earlier.example/api',
      contentServerUrl: 'https://earlier.example/heritage-content.json',
    },
    contentPreview: { manifest: { id: 'earlier-content' } },
    primary: false,
    addedAt: '2026-01-01T00:00:00Z',
  },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ servers, joined }) => {
    localStorage.setItem('heritage-content-servers-v2', JSON.stringify(servers))
    localStorage.setItem('heritage-communities-v1', JSON.stringify(joined))
    localStorage.setItem('heritage-community-sessions-v1', JSON.stringify({
      main: { token: 'main-private-token' },
      earlier: { token: 'earlier-private-token' },
      later: { token: 'later-private-token' },
    }))
  }, { servers: contentServers, joined: communities })

  await page.route('https://main.example/song.json', route => route.fulfill({
    status: route.request().headers().authorization === 'Community main-private-token' ? 200 : 401,
    json: route.request().headers().authorization === 'Community main-private-token'
      ? { title: 'Merge Test Hymn', lyrics: 'Shared wording\nSecond line', rightsNotes: 'Main source record' }
      : { error: 'Sign in required' },
  }))
  await page.route('https://later.example/song.json', route => route.fulfill({
    status: route.request().headers().authorization === 'Community later-private-token' ? 200 : 401,
    json: route.request().headers().authorization === 'Community later-private-token'
      ? { title: 'Merge Test Hymn', lyrics: 'Shared wording, second line!', rightsNotes: 'Later source record' }
      : { error: 'Sign in required' },
  }))
  await page.route('https://earlier.example/song.json', route => route.fulfill({
    status: route.request().headers().authorization === 'Community earlier-private-token' ? 200 : 401,
    json: route.request().headers().authorization === 'Community earlier-private-token'
      ? { title: 'Merge Test Hymn', lyrics: 'Different wording', rightsNotes: 'Earlier source record' }
      : { error: 'Sign in required' },
  }))
  await page.route('https://main.example/before.json', async route => {
    await new Promise(resolve => setTimeout(resolve, 1200))
    await route.fulfill({
      status: route.request().headers().authorization === 'Community main-private-token' ? 200 : 401,
      json: route.request().headers().authorization === 'Community main-private-token'
        ? { title: 'Before the Throne of God Above', lyrics: 'A distinct Community wording', rightsNotes: 'Main source record' }
      : { error: 'Sign in required' },
    })
  })
  await page.route('https://main.example/content/songs/77', route => route.fulfill({
    status: route.request().headers().authorization ? 400 : 200,
    json: route.request().headers().authorization
      ? { error: 'An unlisted share link must not need or receive a member token.' }
      : {
          title: 'All I Have Is Christ',
          description: 'A phone-friendly Community song sheet.',
          lyrics: 'Sample licensed lyric line',
          rightsStatus: 'licensed',
          ccliNumber: '5174122',
          license: 'CCLI Church Copyright License',
          copyright: 'Sovereign Grace Music',
          rightsNotes: 'Used by Main Church for congregational singing.',
          sourceUrl: 'https://sovereigngracemusic.com/music/songs/all-i-have-is-christ/',
          permissionUrl: 'https://sovereigngracemusic.com/about/permissions/',
          communityRightsContact: {
            communityName: 'Main Church',
            communityUrl: 'https://main.example/',
            ccliLicenseNumber: '7654321',
            email: 'rights@main.example',
          },
        },
  }))
})

test('one catalog card opens exact-duplicate sources together and different words as a choice', async ({ page }) => {
  await page.goto('/#/resources/songs')

  await expect(page.getByRole('heading', { name: 'Merge Test Hymn' })).toHaveCount(1)
  await expect(page.getByText('Main Church + 2')).toBeVisible()
  await page.getByRole('heading', { name: 'Merge Test Hymn' }).click()

  await expect(page.getByText('These sources have different English words')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Main Church, Later Church' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Earlier Church' })).toBeVisible()
  await expect(page.getByText('Same wording in Main Church, Later Church. Showing the Main Church copy.')).toBeVisible()

  await page.getByRole('button', { name: 'Earlier Church' }).click()
  await expect(page.getByText('Different wording', { exact: true })).toBeVisible()
})

test('Before the Throne includes only its public-domain English source in Heritage', async ({ page }) => {
  await page.goto('/#/resources/songs/before-the-throne')

  await expect(page.getByRole('status')).toContainText('Showing available words now')
  await page.getByText('License, source, and sharing explanation').click()
  await expect(page.getByText('Original 1863 English words: public domain. The Vikki Cook tune and modern lyrical alterations are not included.')).toBeVisible()
  await expect(page.getByText(/^Before the throne of God above/)).toBeVisible()
  await expect(page.getByRole('status')).toBeHidden()
  await expect(page.getByRole('button', { name: 'RU' })).toBeDisabled()
  await expect(page.getByText(/Word of Truth Bible Church service-deck/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Text/source record' })).toHaveAttribute(
    'href',
    'https://hymnary.org/text/before_the_throne_of_god_above_i_have_a_',
  )
})

test('a hymn without a sourced Russian edition does not expose invented Russian words', async ({ page }) => {
  await page.goto('/#/resources/songs/be-thou-my-vision')

  await expect(page.getByRole('button', { name: 'RU' })).toBeDisabled()
  await expect(page.getByText('Будь мне виденьем, Господь сердца мой')).toHaveCount(0)
})

test('an unlisted Community song opens without membership and explains its license at the bottom', async ({ page }) => {
  const contentUrl = 'https://main.example/content/songs/77'
  await page.goto(`/#/community-song?url=${encodeURIComponent(contentUrl)}`)

  await expect(page.getByRole('heading', { name: 'All I Have Is Christ' })).toBeVisible()
  await expect(page.getByText('Sample licensed lyric line')).toBeVisible()
  await expect(page.getByText('From Main Church')).toBeVisible()

  const disclosure = page.getByText('License, source, and sharing explanation')
  await expect(disclosure).toBeVisible()
  await disclosure.click()
  await expect(page.getByText(/services and home groups/)).toBeVisible()
  await expect(page.getByText('Church CCLI License #: 7654321')).toBeVisible()
  await expect(page.getByText(/small-group, home-group, and Bible-study worship/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'CCLI license description' })).toHaveAttribute(
    'href',
    'https://ccli.com/us/en/church-copyright-license-summary',
  )
  await expect(page.getByRole('link', { name: 'Sovereign Grace permissions' })).toHaveAttribute(
    'href',
    'https://sovereigngracemusic.com/about/permissions/',
  )
  await expect(page.getByRole('link', { name: 'Request an attribution correction or takedown review' })).toHaveAttribute(
    'href',
    /mailto:rights@main\.example/,
  )
  await expect(page.getByRole('button', { name: 'Share unlisted song link' })).toBeVisible()
})
