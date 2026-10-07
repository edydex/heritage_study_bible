import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import RecordedSentenceText from './RecordedSentenceText'
it('renders exact text, activates the requested sentence and supports keyboard seeking', () => {
  const seek = vi.fn()
  const { container } = render(<p><RecordedSentenceText text="One. Two." verseMode spans={[{ start: 1, end: 3, textStart: 0, textEnd: 4 }, { start: 7, end: 9, textStart: 5, textEnd: 9 }]} activeStart={5} onSeek={seek} /></p>)
  expect(container.textContent).toBe('One. Two.')
  expect(container.querySelector('[data-audio-sentence="true"]')).toHaveTextContent('Two.')
  fireEvent.click(screen.getByRole('button', { name: 'Play from: Two.' }))
  fireEvent.keyDown(screen.getByRole('button', { name: 'Play from: One.' }), { key: 'Enter' })
  expect(seek.mock.calls).toEqual([[7], [1]])
})
it('keeps untimed sentences selectable without manufacturing audio positions', () => {
  const { container } = render(<p><RecordedSentenceText text="One. Two." verseMode onSeek={vi.fn()} /></p>)
  expect(container.textContent).toBe('One. Two.')
  expect(container.querySelectorAll('.reader-sentence-row')).toHaveLength(2)
  expect(screen.queryByRole('button')).toBeNull()
})
it('puts unmatched sentences in separate rows alongside verified recording spans', () => {
  const { container } = render(<p><RecordedSentenceText text="One. Two. Three." verseMode spans={[{ start: 5, end: 7, textStart: 5, textEnd: 9 }]} onSeek={vi.fn()} /></p>)
  expect(container.textContent).toBe('One. Two. Three.')
  expect(container.querySelectorAll('.reader-sentence-row')).toHaveLength(3)
  expect(screen.getAllByRole('button')).toHaveLength(1)
})
