import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VerseText from './VerseText'
import ParallelBibleChapter from './ParallelBibleChapter'
import alignment from '../../public/data/original-languages/romans-bsb-links.json'
vi.mock('../data/originalLanguages', async importOriginal => ({
  ...await importOriginal(), loadRomansWordLinks: () => Promise.resolve(alignment),
}))

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
  it('identifies counterparts with Shift+Enter and keeps word lookup available when pairing is off', async () => {
    const { container } = render(<ParallelBibleChapter {...props} />)
    await waitFor(() => expect(container.querySelector('[data-word-link="1:1:0"]')).toBeTruthy())
    fireEvent.keyDown(container.querySelector('[data-word-link="1:1:0"]'), { key: 'Enter', shiftKey: true })
    expect(screen.getByText('Παῦλος ↔ Paul')).toBeInTheDocument()
    expect(container.querySelectorAll('.bible-word-link-active')).toHaveLength(4) // desktop and mobile source/target
    fireEvent.click(screen.getByLabelText('Word links'))
    expect(container.querySelector('[data-word-link]')).toBeTruthy()
    expect(container.querySelector('[data-word-pattern]')).toBeNull()
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
