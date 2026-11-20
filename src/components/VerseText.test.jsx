import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VerseText from './VerseText'
import { OccurrenceText } from './WordStudyDialog'
import { bracketTextualAdditions, textualAdditionRanges } from '../data/textualAdditions'
import ukrainianMatthew from '../../public/data/translations/UKRK/matthew.json'
import ukrainianActs from '../../public/data/translations/UKRK/acts.json'
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
        translationId="SYNO-W"
        additions={[[12, 34]]}
        highlights={[{ startOffset: 8, endOffset: 15, color: 'pink' }]}
        wordLinks={[{ id: 'target', label: 'Царство', startOffset: 26, endOffset: 33, paired: false }]}
      />
    </p>
  )
  const verse = container.querySelector('[data-verse-content]')
  expect(verse.querySelector('[data-textual-addition="start"] [aria-hidden]')).toHaveTextContent('[[')
  expect(verse.querySelector('[data-textual-addition="start"]')).toHaveAttribute('lang', 'ru')
  expect(verse.querySelector('[data-textual-addition="end"] [aria-hidden]')).toHaveTextContent(']]')
  expect(verse.querySelector('[data-word-link]')).toHaveTextContent('Царство')
  const range = document.createRange()
  range.selectNodeContents(verse)
  const selection = { isCollapsed: false, rangeCount: 1, getRangeAt: () => range }
  expect(captureBibleTextSelection(selection, container).segments[0].selectedText).toBe('избавь нас. Ибо Твое есть Царство.')
})

it('renders verified Ukrainian variants across reader and study without moving word offsets', () => {
  const text = ukrainianMatthew.chapters.find(chapter => chapter.number === 19).verses.find(verse => verse.number === 9).text
  const addition = 'і хто з розвідкою оженить ся, робить перелюб.'
  const start = text.indexOf(addition)
  const ranges = textualAdditionRanges('UKRK', 'Matthew', 19, 9, text)
  expect(ranges).toEqual([[start, text.length]])
  expect(textualAdditionRanges('UKRK', 'Matthew', 19, 9, ` ${text}`)).toEqual([])
  expect(bracketTextualAdditions('UKRK', 'Matthew', 19, 9, text)).toBe(`${text.slice(0, start)}[[${addition}]]`)

  const word = 'жінкою'
  const startOffset = text.indexOf(word)
  const endOffset = startOffset + word.length
  const { container } = render(<>
    <p data-verse-content data-book="Matthew" data-chapter="19" data-verse="9" data-translation="UKRK">
      <VerseText text={text} translationId="UKRK" additions={ranges} wordLinks={[{ id: 'target', label: word, startOffset, endOffset }]} />
    </p>
    <div data-test-context><OccurrenceText text={text} translationId="UKRK" additions={ranges} ranges={[[startOffset, endOffset]]} /></div>
  </>)
  const verse = container.querySelector('[data-verse-content]')
  const context = container.querySelector('[data-test-context]')
  expect(verse.querySelector('[data-word-link]')).toHaveTextContent(word)
  expect(context.querySelector('mark')).toHaveTextContent(word)
  for (const node of [verse, context]) {
    expect(node.querySelector('[data-textual-addition="start"]')).toHaveAttribute('lang', 'uk')
    expect(node.querySelector('[data-textual-addition="end"] [aria-hidden]')).toHaveTextContent(']]')
  }
  const range = document.createRange()
  range.selectNodeContents(verse)
  const selection = { isCollapsed: false, rangeCount: 1, getRangeAt: () => range }
  expect(captureBibleTextSelection(selection, container).segments[0].selectedText).toBe(text)
})

it('marks a complete Ukrainian addition and leaves a verse-number difference unmarked', () => {
  const text = ukrainianMatthew.chapters.find(chapter => chapter.number === 17).verses.find(verse => verse.number === 21).text
  expect(bracketTextualAdditions('UKRK', 'Matthew', 17, 21, text)).toBe(`[[${text}]]`)
  const dismissal = ukrainianActs.chapters.find(chapter => chapter.number === 19).verses.find(verse => verse.number === 41).text
  expect(bracketTextualAdditions('UKRK', 'Acts', 19, 41, dismissal)).toBe(dismissal)
})
