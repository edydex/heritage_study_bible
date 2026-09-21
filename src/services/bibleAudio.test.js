import { describe, expect, it } from 'vitest'
import { activeAudioVerse, bibleAudioDestination, getBibleAudioTrack, matchingAudioVerse, normalizeSpokenText } from './bibleAudio'
import { audioBooks, audioTracks, nextAudioTrack } from './audioCatalog'
import { readFileSync } from 'node:fs'

describe('Bible audio edition and timing boundaries', () => {
  it('has every canonical chapter in a separate Bible library and never substitutes another translation', () => {
    const books = audioBooks.filter(book => book.kind === 'bible')
    expect(books).toHaveLength(66)
    expect(audioTracks.filter(track => track.bible)).toHaveLength(1189)
    expect(new Set(audioTracks.map(track => track.id)).size).toBe(audioTracks.length)
    expect(getBibleAudioTrack('Romans', 1, 'SYNO')).toBeNull()
    expect(getBibleAudioTrack('Romans', 17)).toBeNull()
    expect(nextAudioTrack('bsb-hays-45-016')).toBeNull()
    expect(nextAudioTrack('bsb-hays-45-001').id).toBe('bsb-hays-45-002')
  })
  it('all imported spans match the displayed complete verse and stay inside the exact recording', () => {
    for (const book of audioBooks.filter(book => book.kind === 'bible')) {
      const text = JSON.parse(readFileSync(`public/data/translations/BSB/${book.bibleSlug}.json`, 'utf8'))
      const timing = JSON.parse(readFileSync(`public/data/audio/bsb-hays/${book.bibleSlug}.json`, 'utf8'))
      for (const chapter of text.chapters) {
        const track = getBibleAudioTrack(text.name, chapter.number)
        const data = timing.chapters[chapter.number]
        expect(data.verses).toHaveLength(track.bible.timedVerses)
        let lastEnd = 0
        for (const span of data.verses) {
          expect(span.start).toBeGreaterThanOrEqual(lastEnd)
          expect(span.end).toBeGreaterThan(span.start)
          expect(span.end).toBeLessThanOrEqual(track.duration)
          expect(span.text).toBe(normalizeSpokenText(chapter.verses.find(verse => verse.number === span.verse).text))
          lastEnd = span.end
        }
      }
    }
  })
  it('keeps accepted timestamp lookup strict and rejects a changed verse text', () => {
    const timing = { verses: [{ verse: 1, start: 4, end: 10, text: 'in the beginning' }, { verse: 3, start: 20, end: 26, text: 'and god said' }] }
    expect(activeAudioVerse(timing, 0)).toBeNull()
    expect(activeAudioVerse(timing, 10)).toBeNull()
    expect(activeAudioVerse(timing, 15)).toBeNull()
    expect(activeAudioVerse(timing, NaN)).toBeNull()
    expect(matchingAudioVerse(timing, 5, { verses: [{ number: 1, text: 'IN the beginning.' }] })).toBe(1)
    expect(matchingAudioVerse(timing, 5, { verses: [{ number: 1, text: 'In the beginning of time' }] })).toBeNull()
    const track = getBibleAudioTrack('Romans', 1)
    expect(bibleAudioDestination(track, timing, 15).state.scrollToVerse).toBeUndefined()
    expect(bibleAudioDestination(track, timing, 5)).toMatchObject({ path: '/romans/1', state: { audioTranslation: 'BSB', audioNavigation: true, scrollToVerse: { verse: 1 } } })
  })
  it('keeps the complete-text replacement across all books, including reported Romans 8 gaps', () => {
    const audit = JSON.parse(readFileSync('scripts/bible-audio/full-text-audit.json', 'utf8'))
    expect(audit.chapters).toHaveLength(1189)
    expect(audit.counts).toMatchObject({ total: 31102, accepted: 29630, 'no-spoken-text': 16 })
    expect(audioTracks.filter(track => track.bible).reduce((sum, track) => sum + track.bible.timedVerses, 0)).toBe(audit.counts.accepted)
    const romans = JSON.parse(readFileSync('public/data/audio/bsb-hays/romans.json', 'utf8')).chapters[8]
    expect(romans.verses).toHaveLength(38)
    for (const verse of [2, 3, 6, 7, 8]) {
      const span = romans.verses.find(row => row.verse === verse)
      expect(activeAudioVerse(romans, (span.start + span.end) / 2)).toMatchObject({ verse })
    }
    expect(romans.verses.some(row => row.verse === 9)).toBe(false)
    const matthew = JSON.parse(readFileSync('public/data/audio/bsb-hays/matthew.json', 'utf8')).chapters[17]
    expect(matthew.verses.some(row => row.verse === 21)).toBe(false)
    expect(matthew.verses.some(row => row.verse === 22)).toBe(true)
  })
})

it('advances the reading marker as soon as the previous verse ends, including missing timings', () => {
  const timing = { verses: [{ verse: 1, start: 4, end: 10, text: 'the first verse' }, { verse: 3, start: 20, end: 26, text: 'the third verse' }] }
  const chapter = { verses: [{ number: 1, text: 'The first verse.' }, { number: 2, text: 'The second verse.' }, { number: 3, text: 'The third verse.' }] }
  expect(matchingAudioVerse(timing, 3.99, chapter)).toBeNull()
  expect(matchingAudioVerse(timing, 9.99, chapter)).toBe(1)
  for (const at of [10, 10.01, 15, 19.99]) expect(matchingAudioVerse(timing, at, chapter)).toBe(2)
  expect(matchingAudioVerse(timing, 20, chapter)).toBe(3)
  expect(matchingAudioVerse(timing, 26, chapter)).toBe(3)
  expect(matchingAudioVerse(timing, NaN, chapter)).toBeNull()
  expect(matchingAudioVerse(timing, -1, chapter)).toBeNull()
  expect(matchingAudioVerse(timing, 12, { verses: [{ number: 1, text: 'Changed edition' }, chapter.verses[1]] })).toBeNull()
  // Display continuity does not manufacture an accepted seek target.
  expect(activeAudioVerse(timing, 15)).toBeNull()
  expect(timing.verses.some(span => span.verse === 2)).toBe(false)
})

it('the Romans 8 reading marker has no blank gaps and can follow untimed verse 9', () => {
  const timing = JSON.parse(readFileSync('public/data/audio/bsb-hays/romans.json', 'utf8')).chapters[8]
  const chapter = JSON.parse(readFileSync('public/data/translations/BSB/romans.json', 'utf8')).chapters.find(chapter => chapter.number === 8)
  for (const [index, current] of timing.verses.entries()) {
    const next = timing.verses[index + 1]
    if (!next) continue
    expect(matchingAudioVerse(timing, current.end, chapter)).toBe(current.verse + 1)
    expect(matchingAudioVerse(timing, (current.end + next.start) / 2, chapter)).toBe(current.verse + 1)
    expect(matchingAudioVerse(timing, next.start, chapter)).toBe(next.verse)
  }
  const eight = timing.verses.find(span => span.verse === 8)
  expect(matchingAudioVerse(timing, eight.end + 0.01, chapter)).toBe(9)
})

it('does not invent progress through multiple untimed verses or highlight blank verse entries', () => {
  const timing = { verses: [{ verse: 1, start: 2, end: 5, text: 'first verse' }, { verse: 5, start: 30, end: 40, text: 'last verse' }] }
  const chapter = { verses: [{ number: 1, text: 'First verse' }, { number: 2, text: '' }, { number: 3, text: 'Third verse' }, { number: 4, text: 'Fourth verse' }, { number: 5, text: 'Last verse' }] }
  expect(matchingAudioVerse(timing, 5, chapter)).toBe(3)
  expect(matchingAudioVerse(timing, 29, chapter)).toBe(3)
  expect(matchingAudioVerse(timing, 30, chapter)).toBe(5)
})
