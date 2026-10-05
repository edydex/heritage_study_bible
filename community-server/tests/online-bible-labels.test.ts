import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ONLINE_BIBLES, bibleTranslationOptionLabel } from '../src/lib/bible/OnlineBibleSources'
import OnlineBibleNotice from '../src/components/OnlineBibleNotice'
import { translateWorkspaceText } from '../src/lib/workspaceText'

test('online options have a marker while stored IDs and installed editions remain unchanged', () => {
  for (const edition of ONLINE_BIBLES) {
    const original = JSON.stringify(edition)
    assert.match(bibleTranslationOptionLabel(edition), new RegExp(`^${edition.id}\\* · `))
    assert.equal(JSON.stringify(edition), original)
    assert.doesNotMatch(bibleTranslationOptionLabel({ ...edition, online: false }), /\*/)
  }
})
test('the online note distinguishes fetching from offline presentation and is localized', () => {
  assert.equal(renderToStaticMarkup(createElement(OnlineBibleNotice, { translations: [{online:false}] })), '')
  const output = renderToStaticMarkup(createElement(OnlineBibleNotice, { translations: [...ONLINE_BIBLES] }))
  assert.match(output, /internet connection.*fetch new passages/)
  assert.match(output, /saved service remain available offline/)
  assert.doesNotMatch(output, /permission|licensed|via API/)
  const key = '* Online lookup: an internet connection is required to fetch new passages. Verses already added to a saved service remain available offline.'
  assert.match(translateWorkspaceText(key, 'ru'), /Онлайн-поиск/)
})
