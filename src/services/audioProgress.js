import { getBookAudioTracks } from './audioCatalog'

// A book's cursor follows its most recently selected chapter. Chapters before
// that cursor count towards title progress; saved cursors in other books stay put.
export function bookListeningProgress(bookId, progress = {}, editionId) {
  const tracks = getBookAudioTracks(bookId, editionId)
  if (!tracks.length) return null
  const positions = progress.positions || {}
  const played = progress.lastPlayed || {}
  const saved = tracks.filter(track => played[track.id] > 0 || positions[track.id] > 0 || track.id === progress.lastTrackId)
  const recent = saved.slice().sort((a, b) =>
    (played[b.id] || 0) - (played[a.id] || 0)
      || Number(b.id === progress.lastTrackId) - Number(a.id === progress.lastTrackId)
      || tracks.indexOf(b) - tracks.indexOf(a))[0]
  const track = recent || tracks[0]
  const position = Math.max(0, Math.min(Number(positions[track.id]) || 0, track.duration || Infinity))
  const duration = tracks.reduce((sum, item) => sum + (item.duration || 0), 0)
  const elapsed = tracks.slice(0, tracks.indexOf(track)).reduce((sum, item) => sum + (item.duration || 0), 0) + position
  return { track, position, duration, elapsed, remaining: Math.max(0, duration - elapsed),
    percent: duration ? Math.min(100, Math.floor(elapsed / duration * 100)) : 0,
    started: Boolean(recent), updatedAt: played[track.id] || (track.id === progress.lastTrackId ? 1 : 0) }
}

export function listeningTimeLeft(seconds, rate = 1) {
  const minutes = Math.ceil(Math.max(0, seconds) / Math.max(.25, rate) / 60)
  if (!minutes) return 'Finished'
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60}m left`
}
