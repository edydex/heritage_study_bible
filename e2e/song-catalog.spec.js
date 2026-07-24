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
    manifest: { id: 'main', name: 'Main Church' },
    contentPreview: { manifest: { id: 'main-content' } },
    primary: true,
    addedAt: '2026-02-01T00:00:00Z',
  },
  {
    manifest: { id: 'later', name: 'Later Church' },
    contentPreview: { manifest: { id: 'later-content' } },
    primary: false,
    addedAt: '2026-03-01T00:00:00Z',
  },
  {
    manifest: { id: 'earlier', name: 'Earlier Church' },
    contentPreview: { manifest: { id: 'earlier-content' } },
    primary: false,
    addedAt: '2026-01-01T00:00:00Z',
  },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ servers, joined }) => {
    localStorage.setItem('heritage-content-servers-v2', JSON.stringify(servers))
    localStorage.setItem('heritage-communities-v1', JSON.stringify(joined))
  }, { servers: contentServers, joined: communities })

  await page.route('https://main.example/song.json', route => route.fulfill({
    json: { title: 'Merge Test Hymn', lyrics: 'Shared wording\nSecond line', rightsNotes: 'Main source record' },
  }))
  await page.route('https://later.example/song.json', route => route.fulfill({
    json: { title: 'Merge Test Hymn', lyrics: 'Shared wording, second line!', rightsNotes: 'Later source record' },
  }))
  await page.route('https://earlier.example/song.json', route => route.fulfill({
    json: { title: 'Merge Test Hymn', lyrics: 'Different wording', rightsNotes: 'Earlier source record' },
  }))
  await page.route('https://main.example/before.json', async route => {
    await new Promise(resolve => setTimeout(resolve, 1200))
    await route.fulfill({
      json: { title: 'Before the Throne of God Above', lyrics: 'A distinct Community wording', rightsNotes: 'Main source record' },
    })
  })
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

test('Before the Throne includes its public-domain English source and a distinct Heritage Russian draft', async ({ page }) => {
  await page.goto('/#/resources/songs/before-the-throne')

  await expect(page.getByRole('status')).toContainText('Showing available words now')
  await expect(page.getByText('Original 1863 English words: public domain. The Vikki Cook tune and modern lyrical alterations are not included.')).toBeVisible()
  await expect(page.getByRole('status')).toBeHidden()
  await page.getByRole('button', { name: /^RU/ }).click()
  await expect(page.getByRole('heading', { name: 'Пред Божьим троном в небесах' })).toBeVisible()
  await expect(page.getByText(/new Heritage translation drafted directly/)).toBeVisible()
})
