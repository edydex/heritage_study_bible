import { describe, expect, it } from 'vitest'
import { captureBibleTextSelection, combineBibleTextSelections, resolveTextAnchor, textSelectionMatchesAnnotation } from './textSelection'

describe('Bible text selection anchors', () => {
  it('captures translation-specific offsets across verses while ignoring markers', () => {
    document.body.innerHTML = `
      <main id="reader">
        <p data-verse-content data-book="John" data-chapter="3" data-verse="16" data-translation="BSB"><span data-selection-ignore>¶</span>For God so loved the world.</p>
        <p data-verse-content data-book="John" data-chapter="3" data-verse="17" data-translation="BSB">For God did not send His Son.</p>
      </main>
    `
    const firstText = document.querySelector('[data-verse="16"]').lastChild
    const secondText = document.querySelector('[data-verse="17"]').firstChild
    const range = document.createRange()
    range.setStart(firstText, 4)
    range.setEnd(secondText, 7)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const captured = captureBibleTextSelection(selection, document.querySelector('#reader'))

    expect(captured.translationId).toBe('BSB')
    expect(captured.reference).toBe('John 3:16-17')
    expect(captured.segments).toHaveLength(2)
    expect(captured.segments[0]).toMatchObject({ startOffset: 4, selectedText: 'God so loved the world.' })
    expect(captured.segments[1]).toMatchObject({ endOffset: 7, selectedText: 'For God' })
    expect(textSelectionMatchesAnnotation(captured, captured)).toBe(true)
  })

  it('reanchors an excerpt when a translation revision shifts its offsets', () => {
    const resolved = resolveTextAnchor({
      startOffset: 4,
      endOffset: 16,
      selectedText: 'God so loved',
      prefix: 'For ',
      suffix: ' the world.',
    }, '¶Truly, For <b>God so loved</b> the world.')

    expect(resolved).toMatchObject({
      startOffset: 11,
      endOffset: 23,
      selectedText: 'God so loved',
      reanchored: true,
    })
  })

  it('combines separate native selections into one multi-snippet annotation', () => {
    const first = {
      reference: 'John 3:16',
      translationId: 'BSB',
      selectedText: 'God so loved',
      segments: [{
        book: 'John', chapter: 3, verse: 16, translationId: 'BSB',
        startOffset: 4, endOffset: 16, selectedText: 'God so loved', verseText: 'For God so loved the world.',
      }],
    }
    const second = {
      reference: 'John 3:18',
      translationId: 'BSB',
      selectedText: 'is not condemned',
      segments: [{
        book: 'John', chapter: 3, verse: 18, translationId: 'BSB',
        startOffset: 20, endOffset: 36, selectedText: 'is not condemned', verseText: 'Whoever believes in Him is not condemned.',
      }],
    }

    const combined = combineBibleTextSelections([first, second])

    expect(combined.snippetCount).toBe(2)
    expect(combined.reference).toBe('John 3:16, 18')
    expect(combined.selectedText).toBe('God so loved\n…\nis not condemned')
    expect(combined.segments).toHaveLength(2)
  })
})
