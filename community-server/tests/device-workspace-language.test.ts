import assert from 'node:assert/strict'
import test from 'node:test'
import { applyDeviceWorkspaceLanguage } from '../src/lib/deviceWorkspaceLanguage.ts'

test('a validated device list and its cached copy select Russian in a standalone native view', () => {
  let changes = 0
  const environment = { documentElement: { lang: 'en' }, dispatchLanguageChange: () => { changes++ } }
  const response = { schemaVersion: 1, items: [], workspaceLanguage: 'ru', workspaceLanguageSource: 'device' }
  assert.equal(applyDeviceWorkspaceLanguage(response, environment), true)
  assert.equal(environment.documentElement.lang, 'ru')
  assert.equal(changes, 1)
  assert.equal(applyDeviceWorkspaceLanguage(JSON.parse(JSON.stringify(response)), environment), true)
  assert.equal(changes, 1, 'A cached list retains the locale without spurious changes')
  assert.equal(applyDeviceWorkspaceLanguage({ ...response, workspaceLanguage: 'en' }, environment), true)
  assert.equal(environment.documentElement.lang, 'en')
  assert.equal(changes, 2)
})

test('browser account responses and unsupported device metadata cannot override Payload language', () => {
  const environment = { documentElement: { lang: 'ru' }, dispatchLanguageChange: () => { throw new Error('Must not dispatch') } }
  for (const response of [
    { workspaceLanguage: 'en', workspaceLanguageSource: 'account' },
    { workspaceLanguage: 'en' },
    { workspaceLanguage: 'fr', workspaceLanguageSource: 'device' },
    { workspaceLanguage: 'ru-RU', workspaceLanguageSource: 'device' },
    null, [], 'ru',
  ]) {
    assert.equal(applyDeviceWorkspaceLanguage(response, environment), false)
    assert.equal(environment.documentElement.lang, 'ru')
  }
  assert.equal(applyDeviceWorkspaceLanguage({ workspaceLanguage: 'ru', workspaceLanguageSource: 'device' }, null), false)
})
