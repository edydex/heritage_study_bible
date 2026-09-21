import jsQR from 'jsqr'
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
    status: 'joined',
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
    status: 'joined',
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
    status: 'joined',
    primary: false,
    addedAt: '2026-01-01T00:00:00Z',
  },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ servers, joined }) => {
    localStorage.setItem('heritage-content-servers-v2', JSON.stringify(servers))
    localStorage.setItem('heritage-communities-v1', JSON.stringify(joined))
    sessionStorage.setItem('heritage-community-sessions-v1', JSON.stringify({
      main: { token: 'main-private-token', issuerOrigin: 'https://main.example' },
      earlier: { token: 'earlier-private-token', issuerOrigin: 'https://earlier.example' },
      later: { token: 'later-private-token', issuerOrigin: 'https://later.example' },
    }))
  }, { servers: contentServers, joined: communities })

  // Catalog documents are public; member-only links below still require a session.
  for (const [url, document] of [
    ['https://main.example/song.json', { title: 'Merge Test Hymn', lyrics: 'Shared wording\nSecond line', rightsNotes: 'Main source record', publicPageUrl: 'https://main.example/songs/merge-test-hymn' }],
    ['https://later.example/song.json', { title: 'Merge Test Hymn', lyrics: 'Shared wording, second line!', rightsNotes: 'Later source record' }],
    ['https://earlier.example/song.json', { title: 'Merge Test Hymn', lyrics: 'Different wording', rightsNotes: 'Earlier source record' }],
    ['https://main.example/before.json', { title: 'Before the Throne of God Above', lyrics: 'A distinct Community wording', rightsNotes: 'Main source record' }],
  ]) {
    await page.route(url, async route => {
      expect(route.request().headers().authorization).toBeUndefined()
      if (url.endsWith('/before.json')) await new Promise(resolve => setTimeout(resolve, 1200))
      return route.fulfill({ json: document })
    })
  }
  await page.route('https://main.example/content/songs/77', route => route.fulfill({
    status: route.request().headers().authorization === 'Community main-private-token' ? 200 : 401,
    json: route.request().headers().authorization === 'Community main-private-token'
      ? {
          title: 'All I Have Is Christ',
          description: 'A member-only Community song sheet.',
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
        }
      : { error: 'Sign in required.' },
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

test('a member-only Community song requires the installed Community session and explains its scope', async ({ page }) => {
  const contentUrl = 'https://main.example/content/songs/77'
  await page.goto(`/#/community-song?access=member&server=main-content&url=${encodeURIComponent(contentUrl)}`)

  await expect(page.getByRole('heading', { name: 'All I Have Is Christ' })).toBeVisible()
  await expect(page.getByText('Sample licensed lyric line')).toBeVisible()
  await expect(page.getByText('From Main Church')).toBeVisible()
  await expect(page.getByText('Member-only Community song', { exact: true })).toBeVisible()
  await expect(page.getByText(/Church editors manage which songs/)).toBeVisible()

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
  await expect(page.getByRole('button', { name: 'Share member-only link' })).toBeVisible()
})

test('a member song link does not fetch protected content before Community sign-in', async ({ page }) => {
  await page.goto('/#/')
  await page.evaluate(() => {
    const sessions = JSON.parse(sessionStorage.getItem('heritage-community-sessions-v1') || '{}')
    delete sessions.main
    sessionStorage.setItem('heritage-community-sessions-v1', JSON.stringify(sessions))
  })

  const protectedRequests = []
  page.on('request', request => {
    if (request.url() === 'https://main.example/content/songs/77') protectedRequests.push(request)
  })
  const contentUrl = 'https://main.example/content/songs/77'
  await page.evaluate(route => { window.location.hash = route }, `/community-song?access=member&server=main-content&url=${encodeURIComponent(contentUrl)}`)

  await expect(page.getByRole('heading', { name: 'Community sign-in required' })).toBeVisible()
  await expect(page.getByText(/member-only song from Main Church/)).toBeVisible()
  await expect(page.getByText(/personal notes and progress account is separate/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Community Home' })).toBeVisible()
  expect(protectedRequests).toHaveLength(0)
})

test('a member Authorization header never follows a redirect to another origin', async ({ page }) => {
  const capturedRequests = []
  await page.route('https://main.example/content/songs/redirect-test', route => {
    expect(route.request().headers().authorization).toBe('Community main-private-token')
    return route.fulfill({
      status: 302,
      headers: { Location: 'https://attacker.example/capture-member-token' },
    })
  })
  await page.route('https://attacker.example/capture-member-token', route => {
    capturedRequests.push(route.request())
    return route.fulfill({ status: 500, json: { error: 'Authorization escaped its origin.' } })
  })

  const contentUrl = 'https://main.example/content/songs/redirect-test'
  await page.goto(`/#/community-song?access=member&server=main-content&url=${encodeURIComponent(contentUrl)}`)

  await expect(page.getByText(/Could not load this resource/)).toBeVisible()
  expect(capturedRequests).toHaveLength(0)
})

const memberSongRoute = '/#/community-song?access=member&server=main-content&url=https%3A%2F%2Fmain.example%2Fcontent%2Fsongs%2F77'

test('a saved member song survives an interruption only for the same sign-in', async ({ page }) => {
  await page.goto(memberSongRoute)
  await expect(page.getByText('Sample licensed lyric line')).toBeVisible()
  await page.getByRole('button', { name: 'Save offline', exact: true }).click()
  await expect(page.getByText('Saved this resource for offline use on this device.')).toBeVisible()

  await page.route('https://main.example/content/songs/77', route => route.abort('internetdisconnected'))
  await page.reload()
  await expect(page.getByText('Sample licensed lyric line')).toBeVisible()
  await expect(page.getByText('Loaded the saved offline copy because the server was unavailable.')).toBeVisible()

  await page.addInitScript(() => {
    const sessions = JSON.parse(sessionStorage.getItem('heritage-community-sessions-v1'))
    sessions.main.token = 'another-member-session'
    sessionStorage.setItem('heritage-community-sessions-v1', JSON.stringify(sessions))
  })
  await page.reload()
  await expect(page.getByText(/Could not load this resource/)).toBeVisible()
  await expect(page.getByText('Sample licensed lyric line')).toHaveCount(0)
})

test('a church access denial clears the saved member copy instead of displaying it offline', async ({ page }) => {
  await page.goto(memberSongRoute)
  await expect(page.getByText('Sample licensed lyric line')).toBeVisible()
  await page.getByRole('button', { name: 'Save offline', exact: true }).click()
  await expect(page.getByText('Saved this resource for offline use on this device.')).toBeVisible()

  await page.route('https://main.example/content/songs/77', route => route.fulfill({ status: 404, json: { error: 'Not found.' } }))
  await page.reload()
  await expect(page.getByText(/no longer available to your church account/)).toBeVisible()
  await expect(page.getByText('Sample licensed lyric line')).toHaveCount(0)
  const remainingCopies = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('heritage-member-songs-v1-'))
    return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).length))).reduce((sum, count) => sum + count, 0)
  })
  expect(remainingCopies).toBe(0)
})

test('the copy fallback creates a member link with no session credential', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async value => { window.copiedMemberLink = value },
    } })
  })
  await page.goto(memberSongRoute)
  await expect(page.getByText('Sample licensed lyric line')).toBeVisible()
  await page.getByRole('button', { name: 'Share member-only link' }).click()
  await expect(page.getByText('Link copied', { exact: true })).toBeVisible()
  const copied = await page.evaluate(() => window.copiedMemberLink)
  const query = new URLSearchParams(new URL(copied).hash.split('?')[1])
  expect([...query.keys()].sort()).toEqual(['access', 'server', 'url'])
  expect(query.get('access')).toBe('member')
  expect(query.get('server')).toBe('main-content')
  expect(query.get('url')).toBe('https://main.example/content/songs/77')
  expect(copied).not.toContain('main-private-token')
})

test('a standalone public library is readable without being labelled as member-only', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('heritage-communities-v1', '[]')
    sessionStorage.removeItem('heritage-community-sessions-v1')
    localStorage.setItem('heritage-content-servers-v2', JSON.stringify([{
      enabled: true,
      manifest: { id: 'public-library', name: 'Public Song Library' },
      catalogs: { songs: { items: [{
        id: 'public-demo', title: 'Public Library Rehearsal',
        content: { url: 'https://public.example/content/songs/demo', mediaType: 'application/vnd.heritage.song+json' },
      }] } },
    }]))
  })
  await page.route('https://public.example/content/songs/demo', route => {
    expect(route.request().headers().authorization).toBeUndefined()
    return route.fulfill({ json: { title: 'Public Library Rehearsal', lyrics: 'Synthetic public song words' } })
  })
  await page.goto('/#/resources/songs')
  await page.getByRole('heading', { name: 'Public Library Rehearsal' }).click()
  await expect(page.getByText('Synthetic public song words')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Share member-only link' })).toHaveCount(0)
  await expect(page.getByText(/Member links require/)).toHaveCount(0)
})


test('share song copies its public link and shows a locally generated, readable QR code', async ({ page }) => {
  await page.addInitScript(() => {
    window.__copiedSong = ''
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copiedSong = text } } })
  })
  await page.goto('/#/resources/songs/song-merge-test-hymn')
  await page.getByRole('button', { name: 'Share song', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Share song' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('status')).toHaveText('Link copied')
  const image = dialog.getByRole('img', { name: 'QR code for this song link' })
  await expect(image).toBeVisible()
  const pixels = await image.evaluate(async image => {
    await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
    return { data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data), width: canvas.width, height: canvas.height }
  })
  const copied = await page.evaluate(() => window.__copiedSong)
  expect(copied).toBe('https://main.example/songs/merge-test-hymn')
  expect(jsQR(Uint8ClampedArray.from(pixels.data), pixels.width, pixels.height).data).toBe(copied)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await dialog.evaluate(node => node.getBoundingClientRect().width <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('heritage-share.png') })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('share dialog offers the link without claiming it copied when clipboard permission fails', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied') } } })
    document.execCommand = () => false
  })
  await page.goto('/#/resources/songs/song-merge-test-hymn')
  await page.getByRole('button', { name: 'Share song', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Share song' })
  await expect(dialog.getByRole('status')).not.toContainText('Link copied')
  await expect(dialog.getByLabel('Song link')).toHaveValue('https://main.example/songs/merge-test-hymn')
})
