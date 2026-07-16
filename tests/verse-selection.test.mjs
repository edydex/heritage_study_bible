import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatVersesForCopy,
  toggleVerseInSelection,
  writeTextToClipboard,
} from '../src/utils/verseSelection.js'

test('selection mode toggles verses without mutating the previous selection', () => {
  const first = { book: 'Jeremiah', chapter: 20, verse: 13, text: 'Sing to the LORD.' }
  const second = { book: 'Jeremiah', chapter: 20, verse: 14, text: 'Cursed be the day.' }
  const initial = [first]

  const withSecond = toggleVerseInSelection(initial, second)
  assert.deepEqual(initial, [first])
  assert.deepEqual(withSecond, [first, second])

  const withoutFirst = toggleVerseInSelection(withSecond, first)
  assert.deepEqual(withoutFirst, [second])
})

test('copy output groups contiguous selections and preserves separate ranges', () => {
  const output = formatVersesForCopy({
    verses: [
      { book: 'Jeremiah', chapter: 20, verse: 15, text: 'Verse fifteen.' },
      { book: 'Jeremiah', chapter: 20, verse: 13, text: 'Verse thirteen.' },
      { book: 'Jeremiah', chapter: 20, verse: 14, text: 'Verse fourteen.' },
      { book: 'Jeremiah', chapter: 20, verse: 18, text: 'Verse eighteen.' },
    ],
    fallbackBookName: 'Jeremiah',
    primaryTranslationId: 'BSB',
    primaryBibleData: null,
  })

  assert.match(output, /^Jeremiah 20:13-15 \(BSB\)/)
  assert.match(output, /\(13\) Verse thirteen\.\n\(14\) Verse fourteen\.\n\(15\) Verse fifteen\./)
  assert.match(output, /Jeremiah 20:18 \(BSB\) - \(18\) Verse eighteen\./)
})

test('clipboard copy falls back when the modern API is denied', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const calls = []
  const textarea = {
    value: '',
    style: {},
    setAttribute: () => {},
    focus: () => calls.push('focus'),
    select: () => calls.push('select'),
    setSelectionRange: (start, end) => calls.push(['range', start, end]),
    remove: () => calls.push('remove'),
  }

  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText: async () => { throw new Error('denied') } } },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { appendChild: node => calls.push(['append', node]) },
        createElement: () => textarea,
        execCommand: command => {
          calls.push(['command', command])
          return true
        },
      },
    })

    await writeTextToClipboard('Jeremiah 20:13-14')
    assert.equal(textarea.value, 'Jeremiah 20:13-14')
    assert.ok(calls.some(entry => Array.isArray(entry) && entry[0] === 'command' && entry[1] === 'copy'))
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
    else delete globalThis.navigator
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else delete globalThis.document
  }
})
