import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

const HOSTED_CONTENT_ORIGIN = 'https://heritage.faith'
const MANIFEST_URL = `${import.meta.env.BASE_URL}data/content-manifest.json`
const CACHE_DIR = 'heritage-content-cache'

export async function loadContentManifest() {
  const response = await fetch(MANIFEST_URL, { cache: 'no-cache' })
  if (!response.ok) throw new Error('Content manifest not available')
  return response.json()
}

export async function cacheManifestFiles(onProgress = null) {
  const manifest = await loadContentManifest()
  const files = Array.isArray(manifest.files) ? manifest.files : []
  const native = Capacitor.isNativePlatform?.() === true

  if (!native && 'caches' in window) {
    const cache = await caches.open('heritage-content-v1')
    for (let index = 0; index < files.length; index += 1) {
      await cache.add(`${import.meta.env.BASE_URL}${files[index]}`)
      onProgress?.({ completed: index + 1, total: files.length, file: files[index] })
    }
    return { manifest, completed: files.length }
  }

  if (native) {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      await Filesystem.downloadFile({
        url: `${HOSTED_CONTENT_ORIGIN}/${file.replace(/^\/+/, '')}`,
        path: `${CACHE_DIR}/${file}`,
        directory: Directory.Data,
        recursive: true,
      })
      onProgress?.({ completed: index + 1, total: files.length, file })
    }
    return { manifest, completed: files.length }
  }

  return { manifest, completed: 0 }
}
