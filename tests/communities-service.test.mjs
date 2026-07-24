import test from 'node:test'
import assert from 'node:assert/strict'

function createStorage() {
  const values = new Map()
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
  }
}

test('a valid community sign-in survives an unavailable optional content catalog', async () => {
  const previous = {
    localStorage: globalThis.localStorage,
    window: globalThis.window,
    CustomEvent: globalThis.CustomEvent,
    fetch: globalThis.fetch,
  }
  const storage = createStorage()
  globalThis.localStorage = storage
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail }
  }
  globalThis.window = {
    dispatchEvent() {},
    setTimeout,
    clearTimeout,
  }
  globalThis.fetch = async url => {
    const value = String(url)
    if (value.endsWith('/.well-known/heritage-community.json')) {
      return Response.json({
        schemaVersion: 1,
        kind: 'heritage-community',
        id: 'test-church',
        name: 'Test Church',
        apiBaseUrl: '/api',
        contentServerUrl: '/heritage-content.json',
        auth: {
          method: 'email-magic-link',
          requestPath: '/community/auth/magic-link',
          sessionPath: '/community/auth/session',
        },
      })
    }
    if (value.endsWith('/api/community/auth/session')) {
      return Response.json({
        token: 'session-token',
        expiresAt: '2030-01-01T00:00:00.000Z',
        member: { id: 'reader-1', email: 'reader@example.com', displayName: 'Reader' },
      })
    }
    if (value.endsWith('/heritage-content.json')) {
      return Response.json({ error: 'Catalog temporarily unavailable.' }, { status: 503 })
    }
    return Response.json({ error: `Unexpected URL ${value}` }, { status: 404 })
  }

  try {
    const { completeCommunitySignIn, getCommunitySessions } = await import('../src/services/communities.js')
    const record = await completeCommunitySignIn('https://community.example', 'one-time-token')
    assert.equal(record.status, 'joined')
    assert.equal(record.member.id, 'reader-1')
    assert.match(record.contentWarning, /catalog could not be refreshed/i)
    assert.equal(getCommunitySessions()['test-church'].token, 'session-token')
  } finally {
    globalThis.localStorage = previous.localStorage
    globalThis.window = previous.window
    globalThis.CustomEvent = previous.CustomEvent
    globalThis.fetch = previous.fetch
  }
})

test('community sign-in explains an unreachable new server in plain language', async () => {
  const previous = {
    localStorage: globalThis.localStorage,
    window: globalThis.window,
    CustomEvent: globalThis.CustomEvent,
    fetch: globalThis.fetch,
  }
  globalThis.localStorage = createStorage()
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail }
  }
  globalThis.window = {
    dispatchEvent() {},
    setTimeout,
    clearTimeout,
  }
  globalThis.fetch = async () => {
    throw new TypeError('NetworkError when attempting to fetch resource.')
  }

  try {
    const { completeCommunitySignIn } = await import('../src/services/communities.js')
    await assert.rejects(
      completeCommunitySignIn('https://new-community.example', 'one-time-token'),
      error => {
        assert.match(error.message, /Could not reach new-community\.example/)
        assert.match(error.message, /wait a minute, reopen Heritage/i)
        assert.doesNotMatch(error.message, /NetworkError/)
        return true
      },
    )
  } finally {
    globalThis.localStorage = previous.localStorage
    globalThis.window = previous.window
    globalThis.CustomEvent = previous.CustomEvent
    globalThis.fetch = previous.fetch
  }
})

test('checking a Community uses a simple GET without forcing a CORS preflight', async () => {
  const previous = {
    localStorage: globalThis.localStorage,
    window: globalThis.window,
    CustomEvent: globalThis.CustomEvent,
    fetch: globalThis.fetch,
  }
  const requests = []
  globalThis.localStorage = createStorage()
  globalThis.CustomEvent = class CustomEvent {}
  globalThis.window = { dispatchEvent() {}, setTimeout, clearTimeout }
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options })
    if (String(url).endsWith('/.well-known/heritage-community.json')) {
      return Response.json({
        schemaVersion: 1,
        kind: 'heritage-community',
        id: 'test-church',
        name: 'Test Church',
        apiBaseUrl: '/api',
        contentServerUrl: '/heritage-content.json',
        auth: {
          method: 'email-magic-link',
          requestPath: '/community/auth/magic-link',
          sessionPath: '/community/auth/session',
        },
      })
    }
    if (String(url).endsWith('/heritage-content.json')) {
      return Response.json({
        schemaVersion: 2,
        kind: 'heritage-content-server',
        id: 'test-church',
        name: 'Test Church',
        catalogs: { songs: '/catalogs/songs' },
      })
    }
    if (String(url).endsWith('/catalogs/songs')) {
      return Response.json({ schemaVersion: 2, contentType: 'songs', items: [] })
    }
    return Response.json({ error: 'Unexpected URL' }, { status: 404 })
  }

  try {
    const { inspectCommunity } = await import('../src/services/communities.js')
    await inspectCommunity('test-church.example')
    const discovery = requests.find(request => request.url.includes('/.well-known/'))
    assert.ok(discovery)
    assert.equal(discovery.options.method, undefined)
    assert.deepEqual(discovery.options.headers, {})
  } finally {
    globalThis.localStorage = previous.localStorage
    globalThis.window = previous.window
    globalThis.CustomEvent = previous.CustomEvent
    globalThis.fetch = previous.fetch
  }
})

test('member sign-in refreshes the hidden song catalog without leaking its token cross-origin', async () => {
  const previous = {
    localStorage: globalThis.localStorage,
    window: globalThis.window,
    CustomEvent: globalThis.CustomEvent,
    fetch: globalThis.fetch,
  }
  const requests = []
  globalThis.localStorage = createStorage()
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail }
  }
  globalThis.window = { dispatchEvent() {}, setTimeout, clearTimeout }
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url)
    requests.push({ url: value, authorization: options.headers?.Authorization || '' })
    if (value.endsWith('/.well-known/heritage-community.json')) {
      return Response.json({
        schemaVersion: 1,
        kind: 'heritage-community',
        id: 'test-church',
        name: 'Test Church',
        apiBaseUrl: '/api',
        contentServerUrl: '/heritage-content.json',
        auth: {
          method: 'email-magic-link',
          requestPath: '/community/auth/magic-link',
          sessionPath: '/community/auth/session',
        },
      })
    }
    if (value.endsWith('/api/community/auth/session')) {
      return Response.json({
        token: 'member-secret',
        expiresAt: '2030-01-01T00:00:00.000Z',
        member: { id: 'reader-1', email: 'reader@example.com', displayName: 'Reader' },
      })
    }
    if (value.endsWith('/heritage-content.json')) {
      return Response.json({
        schemaVersion: 2,
        kind: 'heritage-content-server',
        id: 'test-church',
        name: 'Test Church',
        catalogs: {
          songs: '/catalogs/songs',
          books: 'https://static.example/catalogs/books',
        },
      })
    }
    if (value.endsWith('/catalogs/songs')) {
      return Response.json({
        schemaVersion: 2,
        contentType: 'songs',
        items: [{
          id: 'song-1',
          title: 'Member Song',
          content: {
            url: '/content/songs/song-1',
            mediaType: 'application/vnd.heritage.song+json',
          },
        }],
      })
    }
    if (value === 'https://static.example/catalogs/books') {
      return Response.json({ schemaVersion: 2, contentType: 'books', items: [] })
    }
    return Response.json({ error: `Unexpected URL ${value}` }, { status: 404 })
  }

  try {
    const { completeCommunitySignIn } = await import('../src/services/communities.js')
    const record = await completeCommunitySignIn('https://community.example', 'one-time-token')
    assert.equal(record.status, 'joined')
    assert.equal(record.contentPreview.counts.songs, 1)

    const songCatalogRequest = requests.find(request => request.url.endsWith('/catalogs/songs'))
    const crossOriginRequest = requests.find(request => request.url === 'https://static.example/catalogs/books')
    assert.equal(songCatalogRequest.authorization, 'Community member-secret')
    assert.equal(crossOriginRequest.authorization, '')

    const subscriptions = JSON.parse(globalThis.localStorage.getItem('heritage-content-servers-v2'))
    assert.equal(subscriptions[0].catalogs.songs.items[0].title, 'Member Song')
  } finally {
    globalThis.localStorage = previous.localStorage
    globalThis.window = previous.window
    globalThis.CustomEvent = previous.CustomEvent
    globalThis.fetch = previous.fetch
  }
})
