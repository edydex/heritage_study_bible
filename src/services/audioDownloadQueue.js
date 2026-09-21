import { downloadAudio, getDownloadedAudio } from './audioDownloads'

// The queue belongs to the app, not a settings page; navigation does not lose
// progress or start duplicate transfers. Stop finishes the current atomic file.
export function createAudioDownloadQueue({ download = downloadAudio, get = getDownloadedAudio } = {}) {
  let state = { running: false, completed: 0, total: 0, title: '', progress: null, message: '' }, stop = false
  const listeners = new Set()
  const emit = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  return {
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: () => state,
    stop: () => { stop = true; emit({ message: 'Stopping after the current chapter…' }) },
    async start(tracks) {
      if (state.running || !tracks.length) return
      stop = false
      emit({ running: true, completed: 0, total: tracks.length, title: '', progress: null, message: '' })
      try {
        for (const track of tracks) {
          if (stop) break
          emit({ title: track.title, progress: null })
          if (!await get(track.id)) await download(track.id, progress => emit({ progress }))
          emit({ completed: state.completed + 1 })
        }
        emit({ message: stop ? 'Download stopped. Saved chapters are available offline; resume whenever you like.' : 'Audio saved for offline listening.' })
      } catch { emit({ message: 'Download failed. Saved chapters are still available. Try again to download the remaining chapters.' }) }
      finally { emit({ running: false, progress: null }) }
    },
  }
}
export const audioDownloadQueue = createAudioDownloadQueue()
