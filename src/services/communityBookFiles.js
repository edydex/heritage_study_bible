import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
export const nativeCommunityBooks = () => Capacitor.isNativePlatform?.() === true
const pathFor = (name, hash) => {
  const scope = name.slice(-64)
  if (!/^[a-f0-9]{64}$/.test(scope) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid downloaded book file.')
  return `heritage-community-books/${scope}/${hash}.mp3`
}
export async function readCommunityAudioFile(name, chapter) {
  const path = pathFor(name, chapter.audioSha256)
  try {
    const stat = await Filesystem.stat({ path, directory: Directory.Data })
    if (stat.size !== chapter.audioSize) return null
    const { data } = await Filesystem.readFile({ path, directory: Directory.Data })
    const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0))
    return new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } })
  } catch { return null }
}
export async function writeCommunityAudioFile(name, chapter, blob) {
  const path = pathFor(name, chapter.audioSha256)
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  await Filesystem.writeFile({ path: `${path}.part`, directory: Directory.Data, data, recursive: true })
  await Filesystem.rename({ from: `${path}.part`, to: path, directory: Directory.Data, toDirectory: Directory.Data })
}
export async function removeCommunityAudioFiles(name) {
  const scope = name.slice(-64)
  if (!/^[a-f0-9]{64}$/.test(scope)) return
  try { await Filesystem.rmdir({ path: `heritage-community-books/${scope}`, directory: Directory.Data, recursive: true }) }
  catch (error) { if (error.code !== 'OS-PLUG-FILE-0008') throw error }
}
