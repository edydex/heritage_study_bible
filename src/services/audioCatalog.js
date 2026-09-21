import catalog from '../data/audioCatalog.json'

export const audioBooks = catalog.books
export const audioTracks = audioBooks.flatMap(book => book.editions.flatMap(edition => edition.tracks.map(track => ({
  ...track, textBookId: book.textBookId || book.id, kind: book.kind || 'audiobook', bookTitle: book.title, author: book.author, editionTitle: edition.title, sourceUrl: edition.sourceUrl,
}))))
const tracksById = new Map(audioTracks.map(track => [track.id, track]))
export function getAudioTrack(id) { return tracksById.get(id) || null }
export function getBookAudioTracks(bookId, editionId) {
  return audioTracks.filter(track => track.bookId === bookId && (!editionId || track.editionId === editionId))
}
export function nextAudioTrack(id, direction = 1) {
  const track = getAudioTrack(id)
  if (!track) return null
  const tracks = getBookAudioTracks(track.bookId)
  return tracks[tracks.findIndex(item => item.id === id) + direction] || null
}
export function formatAudioTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  const hours = Math.floor(seconds / 3600)
  return `${hours ? `${hours}:` : ''}${hours ? String(Math.floor(seconds / 60) % 60).padStart(2, '0') : Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
export function formatAudioBytes(bytes) { return `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB` }

// A translation is a library entry; book/track identities stay unchanged for
// existing downloads, Android Auto queues, and listening progress.
export const bibleAudioTranslations = [...audioBooks.filter(book => book.kind === 'bible').reduce((groups, book) => {
  const translation = book.editions[0]?.tracks[0]?.bible?.translation
  if (!translation) return groups
  if (!groups.has(translation)) groups.set(translation, { id: translation, title: `${translation} Audio Bible`, author: book.author, books: [] })
  groups.get(translation).books.push(book)
  return groups
}, new Map()).values()]
