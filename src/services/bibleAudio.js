import { audioTracks } from './audioCatalog'
const chapters = new Map(audioTracks.filter(track => track.bible).map(track => [`${track.bible.translation}:${track.bible.book}:${track.bible.chapter}`, track]))
export const normalizeSpokenText = text => (String(text).toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || []).join(' ')
export function getBibleAudioTrack(book, chapter, translation = 'BSB') { return chapters.get(`${translation}:${book}:${chapter}`) || null }
const pending = new Map()
export async function loadBibleAudioTiming(track) {
  if (!track?.bible) return null
  const slug = track.bible.slug
  if (!pending.has(slug)) {
    const request = fetch(`${import.meta.env.BASE_URL}data/audio/bsb-hays/${slug}.json`).then(response => {
      if (!response.ok) throw new Error('Verse timings could not load.')
      return response.json()
    }).then(data => {
      if (data.schemaVersion !== 1 || data.translation !== 'BSB' || data.book !== track.bible.book) throw new Error('Timing edition mismatch.')
      return data
    }).catch(error => { pending.delete(slug); throw error })
    pending.set(slug, request)
  }
  const data = await pending.get(slug)
  const chapter = data.chapters?.[track.bible.chapter]
  if (!chapter || !Array.isArray(chapter.verses)) throw new Error('Chapter timing is unavailable.')
  let previous = -1
  for (const span of chapter.verses) {
    if (!Number.isSafeInteger(span.verse) || span.verse < 1 || !Number.isFinite(span.start) || !Number.isFinite(span.end) || span.start < previous || span.end <= span.start || span.end > track.duration || typeof span.text !== 'string') throw new Error('Chapter timing is invalid.')
    previous = span.end
  }
  return chapter
}
export function activeAudioVerse(timing, position) {
  if (!Number.isFinite(position)) return null
  return timing?.verses.find(span => position >= span.start && position < span.end) || null
}
export function matchingAudioVerse(timing, position, chapter) {
  if (!Number.isFinite(position) || position < 0) return null
  const span = activeAudioVerse(timing, position)
  const verses = chapter?.verses || []
  const matches = span => span && verses.some(verse => verse.number === span.verse && normalizeSpokenText(verse.text) === span.text)
  if (span) return matches(span) ? span.verse : null
  // The reading marker should advance during the breath between verses, not
  // disappear. This is a display position only: seeking still requires an
  // accepted timestamp. A missing timing can show the next written verse, but
  // we do not invent durations to advance through several unaligned verses.
  const previous = timing?.verses.findLast(span => span.end <= position)
  if (!matches(previous)) return null // Includes the narrator's introduction.
  const previousIndex = verses.findIndex(verse => verse.number === previous.verse)
  const next = verses.slice(previousIndex + 1).find(verse => normalizeSpokenText(verse.text))
  return next?.number ?? previous.verse
}
export function bibleAudioDestination(track, timing, position) {
  if (!track?.bible) return null
  const verse = activeAudioVerse(timing, position)?.verse
  return { path: `/${track.bible.slug}/${track.bible.chapter}`, state: { audioTranslation: track.bible.translation,
    ...(verse ? { scrollToVerse: { book: track.bible.book, chapter: track.bible.chapter, verse }, audioNavigation: true } : {}) } }
}
