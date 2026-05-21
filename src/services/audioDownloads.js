import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'

const INDEX_KEY = 'heritage-audio-downloads'
const AUDIO_DIR = 'heritage-audio'

export function canUseNativeAudioDownloads() {
  return Capacitor.isNativePlatform?.() === true
}

function safeFileName(value) {
  return String(value || 'audio').toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'audio'
}

async function readIndex() {
  try {
    const { value } = await Preferences.get({ key: INDEX_KEY })
    return value ? JSON.parse(value) : {}
  } catch {
    return {}
  }
}

async function writeIndex(index) {
  await Preferences.set({ key: INDEX_KEY, value: JSON.stringify(index) })
}

export async function getDownloadedAudio(resourceId) {
  if (!canUseNativeAudioDownloads()) return null
  const index = await readIndex()
  return index[resourceId] || null
}

export async function downloadAudio(resourceId, audioUrl, label = 'audio') {
  if (!canUseNativeAudioDownloads()) throw new Error('Audio downloads are only available in the Android app.')
  if (!audioUrl) throw new Error('No downloadable audio URL is available for this resource.')

  const extensionMatch = String(new URL(audioUrl).pathname).match(/\.([a-z0-9]{2,5})$/i)
  const extension = extensionMatch?.[1] || 'mp3'
  const path = `${AUDIO_DIR}/${safeFileName(resourceId)}-${safeFileName(label)}.${extension}`

  await Filesystem.downloadFile({
    url: audioUrl,
    path,
    directory: Directory.Data,
    recursive: true,
  })

  const uriResult = await Filesystem.getUri({ path, directory: Directory.Data })
  const record = {
    resourceId,
    label,
    url: audioUrl,
    path,
    uri: uriResult.uri,
    webPath: Capacitor.convertFileSrc?.(uriResult.uri) || uriResult.uri,
    downloadedAt: new Date().toISOString(),
  }
  const index = await readIndex()
  index[resourceId] = record
  await writeIndex(index)
  return record
}

export async function deleteDownloadedAudio(resourceId) {
  if (!canUseNativeAudioDownloads()) return false
  const index = await readIndex()
  const record = index[resourceId]
  if (!record) return false
  try {
    await Filesystem.deleteFile({ path: record.path, directory: Directory.Data })
  } catch {}
  delete index[resourceId]
  await writeIndex(index)
  return true
}
