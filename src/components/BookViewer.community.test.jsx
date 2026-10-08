import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({
  book: { id: 'remote--church--books--1', title: 'Prayer book', author: 'Test Author', year: 2026 },
  tracks: [{ id: 'cb-first', bookId: 'remote--church--books--1', title: 'Introduction' }, { id: 'cb-second', bookId: 'remote--church--books--1', title: 'Chapter two' }],
  state: { trackId: 'cb-first', position: 2, status: 'paused' },
  player: { play: vi.fn(), pause: vi.fn(), seek: vi.fn(), watchPositions: vi.fn() },
}))
vi.mock('./audio/AudioProvider', () => ({ useHeritageAudio: () => ({ player: fixture.player, state: fixture.state, settings: { followBooks: true } }), AudioPlayerControls: () => null }))
vi.mock('../services/audioCatalog', () => ({ getAudioTrack: id => fixture.tracks.find(track => track.id === id), getBookAudioTracks: () => fixture.tracks, audioBooks: [], formatAudioTime: String, formatAudioBytes: String }))
vi.mock('../data/translations', () => ({ DEFAULT_TRANSLATION: 'BSB', loadTranslation: async () => null }))
vi.mock('../services/audiobookText', async original => ({ ...await original(), loadAudiobookTiming: async track => ({
  trackId: track.id, textBookId: fixture.book.id, paragraphs: { p: { chapterIndex: track.id === 'cb-second' ? 1 : 0, paragraphIndex: 0, text: track.id === 'cb-second' ? 'Next chapter text.' : 'First sentence. Second sentence.' } },
  spans: [{ paragraph: 'p', start: 1, end: 6 }], sentenceSpans: track.id === 'cb-second' ? [{ paragraph: 'p', start: 1, end: 3, textStart: 0, textEnd: 18 }] : [{ paragraph: 'p', start: 1, end: 3, textStart: 0, textEnd: 15 }, { paragraph: 'p', start: 4, end: 6, textStart: 16, textEnd: 32 }],
}) }))
import { BookReader } from './BookViewer'
it('uses the regular reader, sentence highlighting, chapter navigation and global player', async () => {
  const { container } = render(<MemoryRouter><BookReader resourceBook={fixture.book} resourceChapters={[{ title: 'Introduction', paragraphs: ['First sentence. Second sentence.'] }, { title: 'Chapter two', paragraphs: ['Next chapter text.'] }]} downloadControls={<button>Download book & audio</button>} /></MemoryRouter>)
  await waitFor(() => expect(container.querySelector('[data-audio-sentence="true"]')).toHaveTextContent('First sentence.'))
  expect(screen.getByRole('button', { name: 'Download book & audio' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Play from: Second sentence.' }))
  await waitFor(() => expect(fixture.player.seek).toHaveBeenCalledWith(4))
  expect(container.querySelectorAll('.reader-sentence-row')).toHaveLength(2)
  expect(screen.queryByLabelText('Verse scroll mode')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }))
  expect(screen.getByLabelText('Verse scroll mode')).toBeChecked()
  fireEvent.click(screen.getByLabelText('Verse scroll mode'))
  expect(container.querySelectorAll('.reader-sentence-row')).toHaveLength(0)
  fireEvent.click(screen.getByLabelText('Verse scroll mode'))
  expect(container.querySelectorAll('.reader-sentence-row')).toHaveLength(2)
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Next chapter', exact: true }))
  expect(await screen.findByText('Next chapter text.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Play book audio', exact: true }))
  expect(fixture.player.play).toHaveBeenCalledWith('cb-second')
})

it('selects the recording by exact printed chapter timing rather than track number', async () => {
  const originalId = fixture.book.id
  fixture.book.id = 'martyrdom-of-polycarp-lake'
  fixture.player.play.mockClear(); fixture.player.seek.mockClear()
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => 'Source text' })
  try {
    render(<MemoryRouter initialEntries={['/resources/books/martyrdom-of-polycarp-lake']}><Routes><Route path="/resources/books/:itemId" element={<BookReader resourceChapters={[{ title: 'Introduction', paragraphs: ['First sentence. Second sentence.'] }, { title: 'Chapter two', paragraphs: ['Next chapter text.'] }]} />} /></Routes></MemoryRouter>)
    await screen.findByRole('button', { name: 'Play from: First sentence.' })
    fireEvent.click(screen.getByRole('button', { name: 'Next chapter', exact: true }))
    const sentence = await screen.findByRole('button', { name: 'Play from: Next chapter text.' })
    fireEvent.click(sentence)
    await waitFor(() => expect(fixture.player.play).toHaveBeenCalledWith('cb-second'))
    expect(fixture.player.seek).toHaveBeenCalledWith(1)
  } finally { fixture.book.id = originalId; fetch.mockRestore() }
})
