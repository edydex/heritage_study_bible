import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
  trackId: track.id, paragraphs: { p: { chapterIndex: 0, paragraphIndex: 0, text: 'First sentence. Second sentence.' } },
  spans: [{ paragraph: 'p', start: 1, end: 6 }], sentenceSpans: [{ paragraph: 'p', start: 1, end: 3, textStart: 0, textEnd: 15 }, { paragraph: 'p', start: 4, end: 6, textStart: 16, textEnd: 32 }],
}) }))
import { BookReader } from './BookViewer'
it('uses the regular reader, sentence highlighting, chapter navigation and global player', async () => {
  const { container } = render(<MemoryRouter><BookReader resourceBook={fixture.book} resourceChapters={[{ title: 'Introduction', paragraphs: ['First sentence. Second sentence.'] }, { title: 'Chapter two', paragraphs: ['Next chapter text.'] }]} downloadControls={<button>Download book & audio</button>} /></MemoryRouter>)
  await waitFor(() => expect(container.querySelector('[data-audio-sentence="true"]')).toHaveTextContent('First sentence.'))
  expect(screen.getByRole('button', { name: 'Download book & audio' })).toBeInTheDocument()
  fireEvent.click(container.querySelector('#book-paragraph-0'))
  expect(fixture.player.seek).toHaveBeenCalledWith(1)
  fireEvent.click(screen.getByRole('button', { name: 'Next chapter', exact: true }))
  expect(await screen.findByText('Next chapter text.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Play book audio', exact: true }))
  expect(fixture.player.play).toHaveBeenCalledWith('cb-second')
})
