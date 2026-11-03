import { act, render, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VerseText from './VerseText'
import ParallelBibleChapter from './ParallelBibleChapter'
import alignment from '../../public/data/original-languages/romans-bsb-links.json'
vi.mock('../data/originalLanguages', async importOriginal => ({
  ...await importOriginal(), loadGreekWordLinks: () => Promise.resolve(alignment),
}))
vi.mock('../data/translations', async importOriginal => ({
  ...await importOriginal(), loadTranslation: id => Promise.resolve({ books: [{ name: 'Romans', chapters: [{ number: 1, verses: [{ number: 1, text: id === 'ORIGINAL' ? first.sourceText : first.targetText }] }] }] }),
}))
vi.mock('./WordStudyDialog', () => ({ default: ({ word, onClose }) => <div role="dialog" aria-label={`Word study: ${word.word}`} onClick={event => { if (event.target === event.currentTarget) onClose() }}><button onClick={onClose}>Close word study</button></div> }))

it('keeps annotation offsets and text intact when links split saved highlights', () => {
  const select = vi.fn(), parentClick = vi.fn()
  const { container } = render(<p onClick={parentClick}><VerseText text="Paul, a servant of Christ Jesus," highlights={[{ startOffset: 3, endOffset: 14, color: 'pink' }]}
    wordLinks={[{ id: 'test', pattern: 1, startOffset: 6, endOffset: 15, label: 'δοῦλος ↔ a servant' }]} onWordLink={select} /></p>)
  expect(container.textContent).toBe('Paul, a servant of Christ Jesus,')
  expect([...container.querySelectorAll('mark')].map(mark => mark.textContent).join('')).toBe('l, a servan')
  fireEvent.click(container.querySelector('[data-word-link]'))
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'test' }))
  expect(parentClick).not.toHaveBeenCalled()
})

const first = alignment.verses['1:1']
const props = {
  bookName: 'Romans', primaryChapter: { number: 1, verses: [{ number: 1, text: first.targetText }] },
  secondaryChapter: { number: 1, verses: [{ number: 1, text: first.sourceText }] },
  primaryTranslationId: 'BSB', secondaryTranslationId: 'ORIGINAL',
  hasCommentary: () => false, isBookmarked: () => false, onVerseClick: vi.fn(), onBookmarkToggle: vi.fn(),
}

describe('parallel word links', () => {
  it('shows both counterparts on tap, with a separate study action and persistent selection', async () => {
    const { container } = render(<ParallelBibleChapter {...props} />)
    await waitFor(() => expect(container.querySelector('[data-word-link="1:1:0"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-translation="ORIGINAL"] [data-word-link="1:1:0"]'))
    expect(screen.getByText('Παῦλος ↔ Paul')).toBeInTheDocument()
    expect(container.querySelectorAll('.bible-word-link-active')).toHaveLength(4) // desktop and mobile source/target
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Study word' }))
    expect(screen.getByRole('dialog', { name: 'Word study: Παῦλος' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close word study' }))
    expect(container.querySelectorAll('.bible-word-link-active')).toHaveLength(4)
    fireEvent.click(screen.getByLabelText('Word links'))
    expect(container.querySelector('[data-word-link]')).toBeTruthy()
    expect(container.querySelector('[data-word-pattern]')).toBeNull()
  })
  it('holds through slight touch drift and retains the completed study after native cancellation', async () => {
    const { container } = render(<ParallelBibleChapter {...props} />)
    await waitFor(() => expect(container.querySelector('[data-word-link="1:1:0"]')).toBeTruthy())
    const word = container.querySelector('[data-translation="ORIGINAL"] [data-word-link="1:1:0"]')
    vi.useFakeTimers()
    try {
      fireEvent.pointerDown(word, { button: 0, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 30, clientY: 40 })
      fireEvent.pointerMove(word, { pointerId: 7, pointerType: 'touch', clientX: 34, clientY: 43 })
      await act(() => vi.advanceTimersByTimeAsync(650))
      fireEvent.pointerCancel(word, { pointerId: 7, pointerType: 'touch' })
      expect(screen.getByRole('dialog', { name: 'Word study: Παῦλος' })).toBeInTheDocument()
      expect(container.querySelectorAll('.bible-word-link-active')).toHaveLength(4)
      // The original hold's compatibility click can target the newly opened
      // backdrop. It must not dismiss the dialog before a fresh interaction.
      fireEvent.click(screen.getByRole('dialog'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      const close = screen.getByRole('button', { name: 'Close word study' })
      fireEvent.pointerDown(close, { button: 0, pointerId: 9, pointerType: 'touch', isPrimary: true })
      fireEvent.click(close)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      fireEvent.keyDown(word, { key: 'Enter', shiftKey: true })
      expect(screen.getByRole('dialog', { name: 'Word study: Παῦλος' })).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
  it('cancels word study for scrolling and does not turn the release into a word tap', async () => {
    const { container } = render(<ParallelBibleChapter {...props} />)
    await waitFor(() => expect(container.querySelector('[data-word-link="1:1:0"]')).toBeTruthy())
    const word = container.querySelector('[data-translation="ORIGINAL"] [data-word-link="1:1:0"]')
    vi.useFakeTimers()
    try {
      fireEvent.pointerDown(word, { button: 0, pointerId: 8, pointerType: 'touch', isPrimary: true, clientX: 30, clientY: 40 })
      fireEvent.pointerMove(word, { pointerId: 8, pointerType: 'touch', clientX: 30, clientY: 75 })
      await act(() => vi.advanceTimersByTimeAsync(650))
      fireEvent.pointerUp(word, { pointerId: 8, pointerType: 'touch' })
      fireEvent.click(word)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Selected word match' })).not.toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
  it('shares checked Greek source anchors between two translated columns', async () => {
    const { container } = render(<ParallelBibleChapter {...props} secondaryTranslationId="BSB" secondaryChapter={props.primaryChapter} />)
    await waitFor(() => expect(container.querySelector('[data-word-pattern]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-word-pattern]'))
    expect(container.querySelectorAll('.bible-word-link-active')).toHaveLength(4)
    expect(screen.getByRole('region', { name: 'Selected word match' })).toContainHTML('Study word')
  })
  it('pauses interactive word links during verse selection', async () => {
    const { container } = render(<ParallelBibleChapter {...props} selectionMode />)
    await waitFor(() => expect(screen.queryByText('Loading word links…')).not.toBeInTheDocument())
    expect(container.querySelector('[data-word-link]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Select Romans 1:1' }))
    expect(props.onVerseClick).toHaveBeenCalledWith(1, 1, first.targetText)
  })
})


it('keeps the primary text but refuses an unverified original-language verse mapping', () => {
  const { container } = render(<ParallelBibleChapter {...props} primaryTranslationId="UKRK" />)
  expect(screen.getByRole('status')).toHaveTextContent('checked mapping for UKRK is not installed')
  expect(container.querySelector('[data-translation="UKRK"]').textContent).toContain(first.targetText)
  expect(container.querySelector('[data-translation="ORIGINAL"][data-verse-content]')).toBeNull()
})
