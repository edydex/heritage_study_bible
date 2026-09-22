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

it('keeps a spoken Bible reference together when a sentence splitter sees an abbreviation', () => {
  const text = 'Read this (Лук. 9:1). Continue reading.'
  const citationStart = text.indexOf('Лук.'), citationEnd = text.indexOf(').')
  const track = { id: 'chapter', bookId: 'remote-book', community: { chapterIndex: 0, chapterId: 'one', audioSha256: 'hash' } }
  const document = { readAlong: { language: 'ru', chapters: [{ id: 'one', audioSha256: 'hash', paragraphs: [{ id: 'p', text }], words: [
    { paragraphId: 'p', sourceStart: 0, sourceEnd: 9, start: 1, end: 2 },
    { paragraphId: 'p', sourceStart: citationStart, sourceEnd: citationEnd, start: 2, end: 4 },
    { paragraphId: 'p', sourceStart: text.indexOf('Continue'), sourceEnd: text.length, start: 5, end: 7 },
  ] }] } }
  const timing = communityAudioTiming(document, track)
  expect(timing.sentenceSpans).toHaveLength(2)
  expect(text.slice(timing.sentenceSpans[0].textStart, timing.sentenceSpans[0].textEnd)).toBe('Read this (Лук. 9:1).')
  expect(activeAudiobookSentence(track, timing, 3).textStart).toBe(0)
})


it('follows spoken order when a citation is read before its printed quotation', () => {
  const text = 'First sentence. Second sentence. Citation.'
  const track = { id: 'chapter', bookId: 'book', community: { chapterIndex: 0, chapterId: 'one', audioSha256: 'hash' } }
  const document = {readAlong:{language:'en',chapters:[{id:'one',audioSha256:'hash',paragraphs:[{id:'p',text}],words:[
    {paragraphId:'p',sourceStart:33,sourceEnd:42,start:1,end:3},
    {paragraphId:'p',sourceStart:0,sourceEnd:15,start:5,end:8},
    {paragraphId:'p',sourceStart:16,sourceEnd:32,start:9,end:12},
  ]}]}}
  const timing = communityAudioTiming(document, track)
  expect(timing.sentenceSpans.map(s=>s.start)).toEqual([1,5,9])
  expect(activeAudiobookSentence(track,timing,2).textStart).toBe(33)
  expect(activeAudiobookSentence(track,timing,6).textStart).toBe(0)
  expect(activeAudiobookSentence(track,timing,10).textStart).toBe(16)
})

it('merges overlapping sentence mappings without losing the earlier spoken words', () => {
  const text = 'First sentence. Second sentence. Citation.'
  const track = {id:'chapter',bookId:'book',community:{chapterIndex:0,chapterId:'one',audioSha256:'hash'}}
  const document = {readAlong:{language:'en',chapters:[{id:'one',audioSha256:'hash',paragraphs:[{id:'p',text}],words:[
    {paragraphId:'p',sourceStart:16,sourceEnd:42,start:1,end:3},
    {paragraphId:'p',sourceStart:0,sourceEnd:15,start:5,end:8},
    {paragraphId:'p',sourceStart:16,sourceEnd:32,start:9,end:12},
  ]}]}}
  const timing = communityAudioTiming(document, track)
  expect(timing.sentenceSpans).toEqual([{paragraph:'0:0',start:1,end:12,textStart:0,textEnd:text.length}])
  expect(activeAudiobookSentence(track,timing,2)).not.toBeNull()
  expect(activeAudiobookSentence(track,timing,6)).not.toBeNull()
})
