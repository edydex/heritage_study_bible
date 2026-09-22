import index from '../data/audiobookTextIndex.json'
import { loadCommunityAudioTiming } from './communityAudio'
const requests = new Map()
export function validateAudiobookTiming(data, track) {
  const recording = data?.tracks?.[track.id]
  if (data?.schemaVersion !== 1 || data.bookId !== track.bookId || (data.textBookId || data.bookId) !== (track.textBookId || track.bookId) || recording?.url !== track.url || recording.bytes !== track.bytes || !Array.isArray(recording.spans)) throw new Error('Recording text timings do not match this edition.')
  let previous = 0
  for (const span of recording.spans) {
    const paragraph = data.paragraphs?.[span.paragraph]
    if (!Number.isFinite(span.start) || !Number.isFinite(span.end) || span.start < previous || span.end <= span.start || span.end > track.duration || !Number.isSafeInteger(paragraph?.chapterIndex) || paragraph.chapterIndex < 0 || !Number.isSafeInteger(paragraph.paragraphIndex) || paragraph.paragraphIndex < 0 || typeof paragraph.text !== 'string' || !paragraph.text.trim()) throw new Error('Recording text timings are invalid.')
    previous = span.end
  }
  previous = 0
  for (const span of recording.sentenceSpans || []) {
    const paragraph = data.paragraphs?.[span.paragraph]
    if (!Number.isFinite(span.start) || !Number.isFinite(span.end) || span.start < previous || span.end <= span.start || span.end > track.duration || !paragraph || !Number.isSafeInteger(span.textStart) || !Number.isSafeInteger(span.textEnd) || span.textStart < 0 || span.textEnd <= span.textStart || span.textEnd > paragraph.text.length || !paragraph.text.slice(span.textStart, span.textEnd).trim()) throw new Error('Recording sentence timings are invalid.')
    previous = span.end
  }
  return { ...recording, trackId: track.id, textBookId: data.textBookId || data.bookId, paragraphs: data.paragraphs }
}
export async function loadAudiobookTiming(track) {
  if (track?.community) return loadCommunityAudioTiming(track)
  const entry = track && index[track.bookId]
  if (!entry || track.bible) return null
  if (!requests.has(track.bookId)) {
    const request = fetch(`${import.meta.env.BASE_URL}data/audio/books/${entry.file}`).then(response => {
      if (!response.ok) throw new Error('Text timings could not load.')
      return response.json()
    }).then(data => {
      if (data.textSha256 !== entry.textSha256) throw new Error('Text timing edition mismatch.')
      return data
    }).catch(error => { requests.delete(track.bookId); throw error })
    requests.set(track.bookId, request)
  }
  return validateAudiobookTiming(await requests.get(track.bookId), track)
}
export function audiobookDestination(track, timing, position) {
  if (!track || track.bible || timing?.trackId !== track.id || !Number.isFinite(position) || position < 0 || !timing?.spans?.length) return null
  // Paragraph navigation can use a nearby checked phrase, at most 20 seconds
  // away. It never estimates character positions or stretches across long gaps.
  const distance = span => position < span.start ? span.start - position : Math.max(0, position - span.end)
  const span = timing.spans.reduce((best, span) => distance(span) < distance(best) ? span : best)
  if (distance(span) > 20) return null
  const paragraph = timing.paragraphs[span.paragraph]
  return { path: `${track.community ? `/resources/content/${encodeURIComponent(track.community.contentKey)}` : `/resources/books/${track.textBookId || track.bookId}`}?audioTrack=${encodeURIComponent(track.id)}&at=${Math.round(position)}`, state: {
    chapterIndex: paragraph.chapterIndex,
    audioParagraph: { chapterIndex: paragraph.chapterIndex, paragraphIndex: paragraph.paragraphIndex, text: paragraph.text, trackId: track.id },
  } }
}
export function matchingAudioParagraph(chapters, target) {
  if (!target || !Number.isSafeInteger(target.chapterIndex) || !Number.isSafeInteger(target.paragraphIndex) || target.chapterIndex < 0 || target.paragraphIndex < 0) return null
  const paragraph = chapters?.[target.chapterIndex]?.paragraphs?.[target.paragraphIndex]
  return typeof paragraph === 'string' && paragraph === target.text ? target : null
}

// Live following never jumps into a nearby paragraph during unaligned speech.
export function activeAudiobookParagraph(track, timing, position) {
  if (!track || timing?.trackId !== track.id || !Number.isFinite(position)) return null
  const span = timing.spans.find(span => position >= span.start && position < span.end)
  const paragraph = span && timing.paragraphs[span.paragraph]
  return paragraph ? { ...paragraph, trackId: track.id } : null
}

export function activeAudiobookSentence(track, timing, position) {
  if (!track || timing?.trackId !== track.id || !Number.isFinite(position)) return null
  const spans = timing.sentenceSpans || []
  let lo = 0, hi = spans.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (spans[mid].start <= position) lo = mid + 1; else hi = mid }
  const span = spans[lo - 1]
  if (!span || position >= span.end) return null
  const paragraph = timing.paragraphs[span.paragraph]
  return { ...paragraph, textStart: span.textStart, textEnd: span.textEnd, trackId: track.id }
}
