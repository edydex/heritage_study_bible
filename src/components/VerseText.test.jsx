import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VerseText from './VerseText'
import { captureBibleTextSelection } from '../utils/textSelection'

describe('VerseText', () => {
  it('renders exact-word highlights using visible-text offsets', () => {
    const { container } = render(
      <p>
        <VerseText
          text="¶For <b>God</b> so loved || the world."
          highlights={[{ startOffset: 4, endOffset: 16, color: 'pink' }]}
        />
      </p>
    )

    expect([...container.querySelectorAll('mark')].map(mark => mark.textContent).join('')).toBe('God so loved')
    expect(container.querySelector('mark')).toHaveAttribute('data-highlight-color', 'pink')
    expect(container.textContent).toContain('For God so loved')
    expect(container.textContent).toContain('the world.')
  })

  it('renders a temporary selection preview over a saved highlight', () => {
    const { container } = render(
      <p>
        <VerseText
          text="For God so loved the world."
          highlights={[
            { startOffset: 4, endOffset: 16, color: 'pink' },
            { startOffset: 4, endOffset: 16, selectionPreview: true },
          ]}
        />
      </p>
    )

    expect(container.querySelector('[data-selection-preview="true"]')).toHaveTextContent('God so loved')
    expect(container.querySelector('[data-highlight-color]')).not.toBeInTheDocument()
  })
})

it('keeps textual brackets out of selected text and preserves word-link offsets', () => {
  const { container } = render(
    <p data-verse-content data-book="Matthew" data-chapter="6" data-verse="13" data-translation="SYNO-W">
      <VerseText
        text="избавь нас. Ибо Твое есть Царство."
        additions={[[12, 34]]}
        highlights={[{ startOffset: 8, endOffset: 15, color: 'pink' }]}
        wordLinks={[{ id: 'target', label: 'Царство', startOffset: 26, endOffset: 33, paired: false }]}
      />
    </p>
  )
  const verse = container.querySelector('[data-verse-content]')
  expect(verse.querySelector('[data-textual-addition="start"] [aria-hidden]')).toHaveTextContent('[[')
  expect(verse.querySelector('[data-textual-addition="end"] [aria-hidden]')).toHaveTextContent(']]')
  expect(verse.querySelector('[data-word-link]')).toHaveTextContent('Царство')
  const range = document.createRange()
  range.selectNodeContents(verse)
  const selection = { isCollapsed: false, rangeCount: 1, getRangeAt: () => range }
  expect(captureBibleTextSelection(selection, container).segments[0].selectedText).toBe('избавь нас. Ибо Твое есть Царство.')
})
