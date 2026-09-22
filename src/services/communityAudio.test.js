import { expect, it } from 'vitest'
import { communityAudioTiming, sentenceRanges } from './communityAudio'
import { activeAudiobookSentence, audiobookDestination } from './audiobookText'
it('uses exact sentence offsets and word timestamps for Russian narration', () => {
  const text = 'Первая фраза. Вторая фраза!'
  const track = { id: 'chapter', bookId: 'remote-book', community: { chapterIndex: 0, chapterId: 'one', audioSha256: 'hash', contentKey: 'remote-book' } }
  const document = { readAlong: { language: 'ru', chapters: [{ id: 'one', audioSha256: 'hash', paragraphs: [{ id: 'p1', text }], words: [
    { paragraphId: 'p1', sourceStart: 0, sourceEnd: 6, start: 1, end: 2 }, { paragraphId: 'p1', sourceStart: 7, sourceEnd: 12, start: 2, end: 3 },
    { paragraphId: 'p1', sourceStart: 14, sourceEnd: 20, start: 4, end: 5 }, { paragraphId: 'p1', sourceStart: 21, sourceEnd: 26, start: 5, end: 6 },
  ] }] } }
  const timing = communityAudioTiming(document, track)
  expect(timing.sentenceSpans).toHaveLength(2)
  const first = activeAudiobookSentence(track, timing, 2.5)
  expect(text.slice(first.textStart, first.textEnd)).toBe('Первая фраза.')
  const second = activeAudiobookSentence(track, timing, 4.1)
  expect(text.slice(second.textStart, second.textEnd).trim()).toBe('Вторая фраза!')
  expect(audiobookDestination(track, timing, 4.1).path).toContain('/resources/content/remote-book?')
  expect(sentenceRanges('One sentence. Another sentence.', 'en')).toHaveLength(2)
})
