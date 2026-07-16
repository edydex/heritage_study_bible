import test from 'node:test'
import assert from 'node:assert/strict'
import { parseUsfmVerseLayout } from '../scripts/lib/usfmLayout.mjs'
import { getVerseLayout, splitParagraphText } from '../src/utils/verseLayout.js'

test('USFM blank line immediately before a verse becomes a source-backed break', () => {
  const usfm = String.raw`\c 20
\q1
\v 13 Sing to the LORD!
\b
\q1
\v 14 Cursed be the day I was born!`
  const layout = parseUsfmVerseLayout(usfm, 'Jeremiah')

  assert.equal(layout['Jeremiah.20.13'].breakBefore, undefined)
  assert.equal(layout['Jeremiah.20.14'].breakBefore, true)
  assert.equal(layout['Jeremiah.20.14'].poetry, true)
  assert.equal(getVerseLayout(layout, 'Jeremiah', 20, 14)?.breakBefore, true)
})

test('a blank line consumed by content inside a verse is not assigned to the next verse', () => {
  const usfm = String.raw`\c 1
\v 7 The LORD told me:
\b
\q1 Do not say that you are a child.
\q1
\v 8 Do not be afraid.`
  const layout = parseUsfmVerseLayout(usfm, 'Jeremiah')

  assert.equal(layout['Jeremiah.1.8']?.breakBefore, undefined)
})

test('native pilcrows are separated from selectable verse text', () => {
  assert.deepEqual(splitParagraphText('¶ In the beginning'), {
    startsParagraph: true,
    segments: ['In the beginning'],
  })
  assert.deepEqual(splitParagraphText('Amen. ¶ Written from Rome.'), {
    startsParagraph: false,
    segments: ['Amen.', 'Written from Rome.'],
  })
})
