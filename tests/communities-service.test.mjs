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
