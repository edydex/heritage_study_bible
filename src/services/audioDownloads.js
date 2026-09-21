import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { Preferences } from '@capacitor/preferences'
import { audioTracks, getAudioTrack } from './audioCatalog'

const INDEX_KEY = 'heritage-audio-downloads-v2'
const LEGACY_KEY = 'heritage-audio-downloads'
const AUDIO_DIR = 'heritage-audio'
export const AUDIO_DOWNLOADS_CHANGED = 'heritage:audio-downloads-changed'
export function canUseNativeAudioDownloads() { return Capacitor.isNativePlatform?.() === true }
const safePath = path => typeof path === 'string' && /^heritage-audio\/[a-zA-Z0-9.-]+$/.test(path)

// Serialize mutations, including index read/modify/write. A failed transfer or
// index write must never replace a working offline recording.
export function createAudioDownloadStore({ filesystem = Filesystem, transfer = FileTransfer, preferences = Preferences,
  native = canUseNativeAudioDownloads, convertFileSrc = uri => Capacitor.convertFileSrc(uri),
  notify = () => window.dispatchEvent(new Event(AUDIO_DOWNLOADS_CHANGED)), uuid = () => crypto.randomUUID(),
} = {}) {
  let queue = Promise.resolve()
  const inFlight = new Map()
  const activePaths = new Set()
  function serialized(operation) {
    const result = queue.then(operation)
    queue = result.catch(() => {})
    return result
  }
  async function readIndex() {
    const { value } = await preferences.get({ key: INDEX_KEY })
    if (value) {
      const index = JSON.parse(value)
      if (!index || typeof index !== 'object' || Array.isArray(index)) throw new Error('Audio storage index could not be read.')
      return index
    }
    // Adopt existing single-track downloads only when the recording matches.
    // Unmatched legacy downloads remain visible/removable in Internal Storage.
    const legacy = await preferences.get({ key: LEGACY_KEY })
    const records = legacy.value ? JSON.parse(legacy.value) : {}
    const index = {}
    for (const [id, record] of Object.entries(records)) {
      if (!safePath(record?.path)) continue
      const track = audioTracks.find(item => item.url === record.url || new URL(item.url).pathname.split('/').pop() === String(record.url).split('/').pop())
      const trackId = track?.id || `legacy:${id}`
      index[trackId] = { ...record, trackId, bookId: track?.bookId || id, label: track?.title || record.label, bookTitle: track?.bookTitle || record.label }
    }
    return index
  }
  async function writeIndex(index) { await preferences.set({ key: INDEX_KEY, value: JSON.stringify(index) }) }
  async function list() {
    if (!native()) return []
    const records = Object.values(await readIndex()).filter(record => safePath(record.path))
    const known = new Set(records.map(record => record.path))
    let files
    try { files = (await filesystem.readdir({ path: AUDIO_DIR, directory: Directory.Data })).files }
    catch (error) { if (error.code === 'OS-PLUG-FILE-0008') return records; throw error }
    for (const file of files) {
      const path = `${AUDIO_DIR}/${file.name}`
      if (file.type !== 'file' || !safePath(path) || known.has(path) || activePaths.has(path)) continue
      if (!/\.mp3(?:\.part)?$/.test(file.name)) continue
      records.push({ trackId: `orphan:${file.name}`, path, bytes: file.size,
        bookId: 'unfinished-downloads', bookTitle: 'Unfinished or older downloads', label: file.name.endsWith('.part') ? 'Interrupted download' : 'Unused audio copy' })
    }
    return records
  }
  async function get(id) {
    if (!native()) return null
    const record = (await readIndex())[id]
    if (!record || !safePath(record.path)) return null
    // Preferences can outlive a file. Stream instead of handing the player a
    // broken file URL, without silently deleting the saved record.
    try {
      const stat = await filesystem.stat({ path: record.path, directory: Directory.Data })
      if (!(stat.size > 0)) return null
      const { uri } = await filesystem.getUri({ path: record.path, directory: Directory.Data })
      return { ...record, uri, webPath: convertFileSrc(uri) }
    } catch { return null }
  }
  function download(id, onProgress = () => {}) {
    if (inFlight.has(id)) return inFlight.get(id)
    const operation = serialized(async () => {
      if (!native()) throw new Error('Offline audio downloads are available in the Android app.')
      const track = getAudioTrack(id)
      if (!track || !/^https:\/\//.test(track.url)) throw new Error('This recording is not in the audio library.')
      const index = await readIndex(), old = index[id]
      const path = `${AUDIO_DIR}/${uuid()}.mp3`, partial = `${path}.part`
      activePaths.add(path); activePaths.add(partial)
      let listener, committed = false
      try {
        await filesystem.mkdir({ path: AUDIO_DIR, directory: Directory.Data, recursive: true }).catch(() => {})
        const { uri } = await filesystem.getUri({ path: partial, directory: Directory.Data })
        listener = await transfer.addListener('progress', event => {
          if (event.url === track.url) onProgress({ bytes: event.bytes, total: event.contentLength || track.bytes })
        })
        await transfer.downloadFile({ url: track.url, path: uri, progress: true })
        const stat = await filesystem.stat({ path: partial, directory: Directory.Data })
        if (!(stat.size > 0) || (track.bytes && stat.size !== track.bytes)) throw new Error('The download was incomplete. Your saved audio has been kept.')
        const header = await filesystem.readFile({ path: partial, directory: Directory.Data, offset: 0, length: 16 })
        const bytes = atob(header.data)
        if (!(bytes.startsWith('ID3') || (bytes.charCodeAt(0) === 255 && (bytes.charCodeAt(1) & 224) === 224))) {
          throw new Error('The server did not return an MP3 recording. Your saved audio has been kept.')
        }
        await filesystem.rename({ from: partial, to: path, directory: Directory.Data, toDirectory: Directory.Data })
        const record = { trackId: id, bookId: track.bookId, editionId: track.editionId, label: track.title,
          bookTitle: track.bookTitle, url: track.url, path, bytes: stat.size, downloadedAt: new Date().toISOString() }
        await writeIndex({ ...index, [id]: record })
        committed = true
        if (old && safePath(old.path) && old.path !== path) await filesystem.deleteFile({ path: old.path, directory: Directory.Data }).catch(() => {})
        notify()
        return record
      } finally {
        await listener?.remove().catch(() => {})
        if (!committed) {
          await filesystem.deleteFile({ path: partial, directory: Directory.Data }).catch(() => {})
          await filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => {})
        }
        activePaths.delete(path); activePaths.delete(partial)
      }
    })
    inFlight.set(id, operation)
    operation.finally(() => inFlight.delete(id)).catch(() => {})
    return operation
  }
  function remove(id) {
    return serialized(async () => {
      if (!native()) return false
      const index = await readIndex(), record = index[id]
      if (id.startsWith('orphan:')) {
        const path = `${AUDIO_DIR}/${id.slice(7)}`
        if (!safePath(path) || !/\.mp3(?:\.part)?$/.test(path) || activePaths.has(path)
          || Object.values(index).some(item => item.path === path)) return false
        await filesystem.deleteFile({ path, directory: Directory.Data })
        notify()
        return true
      }
      if (!record || !safePath(record.path)) return false
      // Do not claim space was freed when the filesystem rejected deletion.
      try { await filesystem.deleteFile({ path: record.path, directory: Directory.Data }) }
      catch (error) { if (error.code !== 'OS-PLUG-FILE-0008') throw error }
      delete index[id]
      await writeIndex(index)
      notify()
      return true
    })
  }
  return { list, get, download, remove }
}
const store = createAudioDownloadStore()
export const listDownloadedAudio = store.list
export const getDownloadedAudio = store.get
export const downloadAudio = store.download
export const deleteDownloadedAudio = store.remove
