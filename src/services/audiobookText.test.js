import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { audiobookDestination, matchingAudioParagraph, validateAudiobookTiming } from './audiobookText'
import { audioTracks } from './audioCatalog'
import { parseBookChapters } from '../utils/bookChapters'
import { RESOURCE_CATEGORIES } from '../data/resources'
import index from '../data/audiobookTextIndex.json'
const track = { id: 'track', bookId: 'book', url: 'https://example.test/audio.mp3', bytes: 100, duration: 200 }
const paragraph = { chapterIndex: 2, paragraphIndex: 1, text: 'The exact bundled paragraph.' }
const fixture = () => ({ schemaVersion: 1, bookId: 'book', paragraphs: { '2:1': paragraph }, tracks: { track: { url: track.url, bytes: 100, spans: [{ start: 50, end: 60, paragraph: '2:1' }] } } })
describe('audiobook paragraph navigation', () => {
  it('offers only bounded nearby destinations and never assigns narrator intros or long gaps', () => {
    const timing = validateAudiobookTiming(fixture(), track)
    expect(audiobookDestination(track, timing, 0)).toBeNull()
    expect(audiobookDestination(track, timing, 100)).toBeNull()
    expect(audiobookDestination(track, timing, NaN)).toBeNull()
    expect(audiobookDestination(track, timing, 55)).toMatchObject({ path: '/resources/books/book?audioTrack=track&at=55', state: { chapterIndex: 2, audioParagraph: paragraph } })
    expect(audiobookDestination(track, timing, 75)).not.toBeNull()
  })
  it('rejects edition mismatches, missing destinations, overlaps and out-of-file times', () => {
    const wrong = fixture(); wrong.tracks.track.url += '?different'
    expect(() => validateAudiobookTiming(wrong, track)).toThrow()
    const missing = fixture(); missing.paragraphs = {}
    expect(() => validateAudiobookTiming(missing, track)).toThrow()
    const overlap = fixture(); overlap.tracks.track.spans.push({ start: 59, end: 65, paragraph: '2:1' })
    expect(() => validateAudiobookTiming(overlap, track)).toThrow()
    const invalid = fixture(); invalid.tracks.track.spans[0].end = 300
    expect(() => validateAudiobookTiming(invalid, track)).toThrow()
    const negative = fixture(); negative.tracks.track.spans[0].start = -0.5
    expect(() => validateAudiobookTiming(negative, track)).toThrow()
  })
  it('checks the currently rendered paragraph before using a saved location', () => {
    const chapters = [{ paragraphs: ['Current text'] }]
    expect(matchingAudioParagraph(chapters, { chapterIndex: 0, paragraphIndex: 0, text: 'Current text' })).not.toBeNull()
    expect(matchingAudioParagraph(chapters, { chapterIndex: 0, paragraphIndex: 0, text: 'Older text' })).toBeNull()
    expect(matchingAudioParagraph(chapters, { chapterIndex: -1, paragraphIndex: 0, text: 'Current text' })).toBeNull()
  })
  it('uses the recording edition and rejects timings for another text edition', () => {
    const editionTrack = { ...track, textBookId: 'book-audio-edition' }
    expect(() => validateAudiobookTiming(fixture(), editionTrack)).toThrow()
    const data = { ...fixture(), textBookId: 'book-audio-edition' }
    expect(() => validateAudiobookTiming(data, track)).toThrow()
    const timing = validateAudiobookTiming(data, editionTrack)
    expect(audiobookDestination(editionTrack, timing, 55)?.path).toBe('/resources/books/book-audio-edition?audioTrack=track&at=55')
  })
  it('the complete Institutes text includes every chapter in all four books', () => {
    const chapters = parseBookChapters(readFileSync('public/data/books/institutes-allen-complete.txt', 'utf8'))
    const counts = {}
    for (const chapter of chapters) {
      const book = chapter.title.match(/^BOOK (I|II|III|IV)\./)?.[1]
      if (book) counts[book] = (counts[book] || 0) + 1
    }
    expect(counts).toEqual({ I: 18, II: 17, III: 25, IV: 20 })
  })
  it('all bundled destinations match the actual reader parser and the exact catalog recording', () => {
    const books = RESOURCE_CATEGORIES.find(category => category.id === 'books').items
    for (const [bookId, entry] of Object.entries(index)) {
      const data = JSON.parse(readFileSync(`public/data/audio/books/${entry.file}`, 'utf8'))
      const expectedIds = audioTracks.filter(track => track.bookId === bookId).map(track => track.id).sort()
      expect(Object.keys(data.tracks).sort()).toEqual(expectedIds)
      expect(entry.tracks).toBe(expectedIds.length)
      const textBookId = audioTracks.find(track => track.bookId === bookId).textBookId
      const bytes = readFileSync(`public/${books.find(book => book.id === textBookId).textPath}`)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.textSha256)
      const chapters = parseBookChapters(bytes.toString('utf8'))
      for (const [id, timing] of Object.entries(data.tracks)) {
        const track = audioTracks.find(track => track.id === id)
        const validated = validateAudiobookTiming(data, track)
        expect(validated.spans.length).toBe(timing.spans.length)
        for (const span of validated.spans) expect(matchingAudioParagraph(chapters, data.paragraphs[span.paragraph])).not.toBeNull()
      }
    }
  })
})

it('live following leaves unmatched narration blank instead of jumping to a nearby paragraph', async () => {
  const { activeAudiobookParagraph } = await import('./audiobookText')
  const track = { id: 'one' }
  const timing = { trackId: 'one', spans: [{ start: 10, end: 20, paragraph: 0 }], paragraphs: [{ chapterIndex: 1, paragraphIndex: 2, text: 'Exact text' }] }
  expect(activeAudiobookParagraph(track, timing, 15)).toMatchObject({ chapterIndex: 1, paragraphIndex: 2 })
  expect(activeAudiobookParagraph(track, timing, 9)).toBeNull()
  expect(activeAudiobookParagraph(track, timing, 20)).toBeNull()
  expect(activeAudiobookParagraph({ id: 'other' }, timing, 15)).toBeNull()
})

it('every bundled LibriVox book now has its matching internal reading text and installed timings', () => {
  const books = RESOURCE_CATEGORIES.find(category => category.id === 'books').items
  const bookIds = [...new Set(audioTracks.filter(track => track.id.startsWith('lv-')).map(track => track.bookId))]
  for (const id of bookIds) {
    const textId = audioTracks.find(track => track.bookId === id).textBookId
    expect(books.find(book => book.id === textId)?.textPath).toBeTruthy()
    expect(index[id]?.tracks).toBeGreaterThan(0)
  }
})

it('Maximus uses the complete historical recording excerpt with stable audio identity', () => {
  const book = RESOURCE_CATEGORIES.find(category => category.id === 'books').items.find(book => book.id === 'maximus-cosmic-mystery')
  const manifest = JSON.parse(readFileSync('public/data/books/maximus-disputation-source.json', 'utf8'))
  const bytes = readFileSync(`public/${book.textPath}`)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.textSha256)
  expect(book.author).toBe('Charles Joseph Hefele')
  expect(book.editionLabel).toContain('William R. Clark, 1896')
  const chapters = parseBookChapters(bytes.toString('utf8'))
  expect(chapters).toHaveLength(1)
  expect(chapters[0].paragraphs).toHaveLength(103)
  expect(chapters[0].paragraphs[0]).toMatch(/^In the meantime the Abbot Maximus/)
  expect(chapters[0].paragraphs.at(-1)).toMatch(/united himself again with the Church\.$/)
  expect(bytes.toString('utf8')).toContain('ἄλλο καὶ ἄλλο')
  expect(bytes.toString('utf8')).not.toMatch(/Mansi,|SEC\. 304|HISTORY OF THE COUNCILS/)
  const tracks = audioTracks.filter(track => track.bookId === book.id)
  expect(tracks).toHaveLength(1)
  expect(tracks[0]).toMatchObject({ id: 'lv-b61af91e3bbc5c0154f8cc06', bytes: 19296652, textBookId: book.id })
  expect(tracks[0].url).toBe('https://archive.org/download/earlychurchcollection5_2502_librivox/ecc05_09_disputation_maximus_64kb.mp3')
})
