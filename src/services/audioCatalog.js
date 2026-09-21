import catalog from '../data/audioCatalog.json'

export const audioBooks = catalog.books
export const audioTracks = audioBooks.flatMap(book => book.editions.flatMap(edition => edition.tracks.map(track => ({
  ...track, kind: book.kind || 'audiobook', bookTitle: book.title, author: book.author, editionTitle: edition.title, sourceUrl: edition.sourceUrl,
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
