import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { translateWorkspaceText, russianWorkspaceText } from '../src/lib/workspaceText'

test('editor UI catalog covers Russian save, history, song, passage and onboarding controls', () => {
  for (const key of ['Version history', 'Save service', 'Save sermon slides', 'Restore as new version',
    'New sermon', 'Primary language for this slide', 'Show second language beneath title',
    'Show next-slide hints for this sermon', 'Bible translation', 'Add whole sermon', 'Slide settings']) {
    assert.ok(russianWorkspaceText[key], key)
    assert.notEqual(translateWorkspaceText(key, 'ru'), key)
    assert.equal(translateWorkspaceText(key, 'en'), key)
  }
})

test('localized labels interpolate source titles literally without translating or interpreting them', () => {
  const title = 'English {number} <John 1:1–12>'
  assert.equal(translateWorkspaceText('Preview slide {number}: {title}', 'ru', { number: 8, title }), `Просмотр слайда 8: ${title}`)
  assert.equal(translateWorkspaceText('Unknown church source text', 'ru'), 'Unknown church source text')
  assert.equal(translateWorkspaceText('{count} slides', 'ru', { count: 25 }), 'Слайдов: 25')
  assert.equal(translateWorkspaceText('Version {version}', 'ru', { version: 4 }), 'Версия 4')
})
