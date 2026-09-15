// Separate from Bible downloads and personal sync. Only anonymous song responses
// belong here; browser/Android updates must not clear this database.
function storedSong(key, document) {
  return new Promise(resolve => {
    let database, transaction, finished = false
    const finish = value => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      database?.close()
      resolve(value ?? null)
    }
    const timeout = setTimeout(() => {
      transaction?.abort()
      finish(null)
    }, 500)
    try {
      const opening = indexedDB.open('heritage-saved-songs-v1', 1)
      opening.onupgradeneeded = () => opening.result.createObjectStore('songs')
      opening.onerror = () => finish(null)
      opening.onblocked = () => finish(null)
      opening.onsuccess = () => {
        database = opening.result
        if (finished) { database.close(); return }
        transaction = database.transaction('songs', document ? 'readwrite' : 'readonly')
        const store = transaction.objectStore('songs')
        const request = document ? store.put(document, key) : store.get(key)
        transaction.oncomplete = () => finish(document || request.result)
        transaction.onerror = transaction.onabort = () => finish(null)
      }
    } catch { finish(null) }
  })
}

const keyFor = reference => JSON.stringify([reference.item?.sourceServerId, reference.item?.content?.url])
export const readSavedSong = reference => storedSong(keyFor(reference))
export const saveSong = (reference, document) => storedSong(keyFor(reference), document)
