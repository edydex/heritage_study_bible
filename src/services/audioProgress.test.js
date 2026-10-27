import { describe, expect, it, vi } from 'vitest'
import { bookListeningProgress, listeningTimeLeft } from './audioProgress'

vi.mock('./audioCatalog', () => {
  const books = {
    first: [
      { id: 'first-1', editionId: 'volume-1', duration: 120 },
      { id: 'first-2', editionId: 'volume-1', duration: 180 },
      { id: 'first-3', editionId: 'volume-2', duration: 300 },
    ],
    other: [{ id: 'other-1', editionId: 'other-volume', duration: 240 }],
  }
  return { getBookAudioTracks: (bookId, editionId) => (books[bookId] || []).filter(track => !editionId || track.editionId === editionId) }
})

describe('book listening cursors', () => {
  it('offers the first chapter and full duration for an unstarted title', () => {
    expect(bookListeningProgress('missing')).toBeNull()
    expect(bookListeningProgress('first')).toMatchObject({ track: { id: 'first-1' }, position: 0, duration: 600, elapsed: 0, remaining: 600, percent: 0, started: false, updatedAt: 0 })
  })

  it('uses the most recently played chapter, including a deliberate return to an earlier chapter', () => {
    const progress = { positions: { 'first-1': 30, 'first-2': 150, 'first-3': 280 }, lastPlayed: { 'first-1': 3000, 'first-2': 1000, 'first-3': 2000 }, lastTrackId: 'first-1' }
    expect(bookListeningProgress('first', progress)).toMatchObject({ track: { id: 'first-1' }, position: 30, elapsed: 30, remaining: 570, percent: 5, updatedAt: 3000, started: true })
  })

  it('keeps independent resumable places when another title is active', () => {
    const progress = { positions: { 'first-2': 90, 'other-1': 80 }, lastPlayed: { 'first-2': 1000, 'other-1': 2000 }, lastTrackId: 'other-1' }
    expect(bookListeningProgress('first', progress)).toMatchObject({ track: { id: 'first-2' }, position: 90, elapsed: 210, remaining: 390, percent: 35, updatedAt: 1000 })
    expect(bookListeningProgress('other', progress)).toMatchObject({ track: { id: 'other-1' }, position: 80, elapsed: 80, updatedAt: 2000 })
  })

  it('restores legacy data without timestamps using the current track, then the last saved chapter for other books', () => {
    const progress = { positions: { 'first-1': 40, 'first-2': 150, 'first-3': 260, 'other-1': 90 }, lastTrackId: 'first-1' }
    expect(bookListeningProgress('first', progress)).toMatchObject({ track: { id: 'first-1' }, position: 40, updatedAt: 1, started: true })
    expect(bookListeningProgress('other', progress)).toMatchObject({ track: { id: 'other-1' }, position: 90, updatedAt: 0, started: true })
    expect(bookListeningProgress('first', { ...progress, lastTrackId: 'other-1' })).toMatchObject({ track: { id: 'first-3' }, position: 260 })
  })

  it('retains a selected chapter at its beginning and resolves equal timestamps with the active track', () => {
    const progress = { positions: { 'first-1': 0, 'first-2': 0 }, lastPlayed: { 'first-1': 1000, 'first-2': 1000 }, lastTrackId: 'first-1' }
    expect(bookListeningProgress('first', progress)).toMatchObject({ track: { id: 'first-1' }, position: 0, started: true })
    expect(bookListeningProgress('first', { lastTrackId: 'first-2' })).toMatchObject({ track: { id: 'first-2' }, elapsed: 120, started: true })
  })

  it('clamps saved positions and identifies a completed book only at its final chapter', () => {
    expect(bookListeningProgress('first', { positions: { 'first-3': 900 } })).toMatchObject({ position: 300, elapsed: 600, remaining: 0, percent: 100 })
    expect(bookListeningProgress('first', { positions: { 'first-1': 120 } })).toMatchObject({ elapsed: 120, remaining: 480, percent: 20 })
    expect(bookListeningProgress('first', { positions: { 'first-2': -20 }, lastTrackId: 'first-2' })).toMatchObject({ position: 0, elapsed: 120 })
  })

  it('limits volume progress to its own tracks without losing the full-book cursor', () => {
    const progress = { positions: { 'first-2': 90, 'first-3': 150 }, lastPlayed: { 'first-2': 1000, 'first-3': 2000 } }
    expect(bookListeningProgress('first', progress, 'volume-1')).toMatchObject({ track: { id: 'first-2' }, duration: 300, elapsed: 210, percent: 70 })
    expect(bookListeningProgress('first', progress)).toMatchObject({ track: { id: 'first-3' }, duration: 600, elapsed: 450, percent: 75 })
  })
})

describe('remaining listening time', () => {
  it('rounds up unfinished minutes and adjusts remaining time for playback speed', () => {
    expect(listeningTimeLeft(0)).toBe('Finished')
    expect(listeningTimeLeft(-10)).toBe('Finished')
    expect(listeningTimeLeft(1)).toBe('1m left')
    expect(listeningTimeLeft(3601)).toBe('1h 1m left')
    expect(listeningTimeLeft(5400, 1.5)).toBe('1h 0m left')
  })
})
