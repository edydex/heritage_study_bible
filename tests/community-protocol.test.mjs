import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCommunityManifestUrl, validateCommunityManifest } from '../src/utils/communityProtocol.js'

test('community URLs use well-known discovery', () => {
  assert.equal(
    normalizeCommunityManifestUrl('https://community.example.church'),
    'https://community.example.church/.well-known/heritage-community.json'
  )
})

test('community manifests resolve API, auth, and content endpoints', () => {
  const manifest = validateCommunityManifest({
    schemaVersion: 1,
    kind: 'heritage-community',
    id: 'example-church',
    name: 'Example Church',
    apiBaseUrl: '/api',
    contentServerUrl: '/heritage-content.json',
    auth: {
      method: 'email-magic-link',
      requestPath: '/community/auth/magic-link',
      sessionPath: '/community/auth/session',
    },
  }, 'https://community.example.church/.well-known/heritage-community.json')

  assert.equal(manifest.apiBaseUrl, 'https://community.example.church/api')
  assert.equal(manifest.auth.requestUrl, 'https://community.example.church/api/community/auth/magic-link')
  assert.equal(manifest.contentServerUrl, 'https://community.example.church/heritage-content.json')
})
