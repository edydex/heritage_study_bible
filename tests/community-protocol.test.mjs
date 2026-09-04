import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCommunityManifestUrl, validateCommunityManifest } from '../src/utils/communityProtocol.js'

test('community URLs use well-known discovery', () => {
  assert.equal(
    normalizeCommunityManifestUrl('https://community.example.church'),
    'https://community.example.church/.well-known/heritage-community.json'
  )
  assert.equal(
    normalizeCommunityManifestUrl('community.example.church'),
    'https://community.example.church/.well-known/heritage-community.json'
  )
  assert.equal(
    normalizeCommunityManifestUrl('localhost:3000'),
    'https://localhost:3000/.well-known/heritage-community.json'
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
      reverifyPath: '/community/auth/reverify',
      logoutPath: '/community/auth/logout',
    },
    sync: {
      schemaVersion: 1,
      recordsPath: '/community/sync/v1/records',
      accountPath: '/community/account',
      protectionPath: '/community/account/protection',
      revokeDevicePath: '/community/account/devices/revoke',
      exportPath: '/community/account/export',
      erasePath: '/community/account/erase',
      privacyModel: 'server-encrypted-records',
    },
  }, 'https://community.example.church/.well-known/heritage-community.json')

  assert.equal(manifest.apiBaseUrl, 'https://community.example.church/api')
  assert.equal(manifest.auth.requestUrl, 'https://community.example.church/api/community/auth/magic-link')
  assert.equal(manifest.auth.sessionUrl, 'https://community.example.church/api/community/auth/session')
  assert.equal(manifest.auth.reverifyUrl, 'https://community.example.church/api/community/auth/reverify')
  assert.equal(manifest.auth.logoutUrl, 'https://community.example.church/api/community/auth/logout')
  assert.deepEqual(manifest.sync, {
    schemaVersion: 1,
    recordsUrl: 'https://community.example.church/api/community/sync/v1/records',
    accountUrl: 'https://community.example.church/api/community/account',
    protectionUrl: 'https://community.example.church/api/community/account/protection',
    revokeDeviceUrl: 'https://community.example.church/api/community/account/devices/revoke',
    exportUrl: 'https://community.example.church/api/community/account/export',
    eraseUrl: 'https://community.example.church/api/community/account/erase',
    privacyModel: 'server-encrypted-records',
  })
  assert.equal(manifest.contentServerUrl, 'https://community.example.church/heritage-content.json')
})

test('community manifests reject auth and sync endpoints on another origin', () => {
  const base = {
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
  }

  assert.throws(() => validateCommunityManifest({
    ...base,
    auth: { ...base.auth, sessionUrl: 'https://attacker.example/session', sessionPath: '' },
  }, 'https://community.example.church/.well-known/heritage-community.json'), /must stay on the Community server/)

  assert.throws(() => validateCommunityManifest({
    ...base,
    sync: {
      schemaVersion: 1,
      recordsUrl: 'https://attacker.example/records',
      accountPath: '/community/account',
      protectionPath: '/community/account/protection',
      revokeDevicePath: '/community/account/devices/revoke',
      exportPath: '/community/account/export',
      erasePath: '/community/account/erase',
    },
  }, 'https://community.example.church/.well-known/heritage-community.json'), /must stay on the Community server/)
})
