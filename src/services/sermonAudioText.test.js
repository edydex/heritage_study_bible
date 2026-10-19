import { expect, it } from 'vitest'
import { matchingSermonSentences, parseCaptionCues } from './sermonAudioText'
const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nFirst sentence.\n\n2\n00:00:10.000 --> 00:00:12.000\nSecond sentence.'
it('seeks to recorded sentence positions while preserving source offsets and gaps', () => {
  const cues = parseCaptionCues(vtt)
  expect(matchingSermonSentences('First sentence.\n\nSecond sentence.', cues)).toEqual([
    { start: 1, end: 3, textStart: 0, textEnd: 15 }, { start: 10, end: 12, textStart: 17, textEnd: 33 },
  ])
  expect(parseCaptionCues(vtt.replaceAll('.', ','))).toHaveLength(2)
})
it('rejects changed text, overlapping or invalid timestamps and durations beyond the recording', () => {
  const cues = parseCaptionCues(vtt)
  expect(matchingSermonSentences('Different sermon.', cues)).toEqual([])
  expect(matchingSermonSentences('First sentence. Second sentence.', cues, 'en', 5)).toEqual([])
  expect(parseCaptionCues(vtt.replace('00:00:10.000', '00:00:02.000'))).toEqual([])
  expect(parseCaptionCues(vtt.replace('00:00:10.000', 'invalid'))).toEqual([])
})
it('merges sentences sharing one caption rather than inventing a second seek point', () => {
  expect(matchingSermonSentences('One. Two.', [{ text: 'One. Two.', start: 5, end: 10 }])).toEqual([{ start: 5, end: 10, textStart: 0, textEnd: 9 }])
})
