// Regenerate from the publisher's metadata; optional AUDIO_METADATA_DIR reuses saved responses.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { RESOURCE_CATEGORIES } from '../src/data/resources.js'

const books = []
const bibleAudio = JSON.parse(await readFile('src/data/bibleAudioCatalog.json', 'utf8'))
for (const book of RESOURCE_CATEGORIES.find(category => category.id === 'books').items) {
  const editions = []
  for (const recording of book.librivoxVolumes || [book.librivox].filter(Boolean)) {
    const archiveId = recording.archiveId || recording.audioUrl?.match(/\/items\/([^/]+)/)?.[1]
    if (!archiveId) throw new Error(`Missing archive identifier: ${book.id}`)
    const metadataUrl = `https://archive.org/metadata/${archiveId}`
    const response = process.env.AUDIO_METADATA_DIR
      ? await readFile(`${process.env.AUDIO_METADATA_DIR}/${archiveId}.json`, 'utf8')
      : await (async () => {
        const result = await fetch(metadataUrl, { signal: AbortSignal.timeout(45000) })
        if (!result.ok) throw new Error(`${archiveId}: HTTP ${result.status}`)
        return result.text()
      })()
    const metadata = JSON.parse(response)
    let files = metadata.files.filter(file => file.format === '64Kbps MP3' && file.name.endsWith('.mp3'))
    if (recording.audioUrl) files = files.filter(file => recording.audioUrl.endsWith(`/${file.name}`))
    // The source collection contains other authors too. Only the requested work belongs here.
    if (book.id === 'maximus-cosmic-mystery') files = files.filter(file => Number(file.track) === 9 && /maximus/i.test(file.title))
    files.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
    if (!files.length) throw new Error(`No audio tracks: ${book.id}`)
    editions.push({
      id: archiveId, title: recording.title, sourceUrl: recording.url, metadataUrl,
      metadataSha256: createHash('sha256').update(response).digest('hex'),
      licenseUrl: metadata.metadata?.licenseurl || 'https://librivox.org/pages/public-domain/',
      tracks: files.map((file, index) => ({
        id: `lv-${createHash('sha256').update(`${book.id}\n${archiveId}\n${file.name}`).digest('hex').slice(0, 24)}`,
        bookId: book.id, editionId: archiveId, title: file.title || `Track ${index + 1}`,
        url: `https://archive.org/download/${archiveId}/${encodeURIComponent(file.name)}`,
        bytes: Number(file.size),
        duration: String(file.length).split(':').reduce((seconds, part) => seconds * 60 + Number(part), 0),
      })),
    })
  }
  if (editions.length) books.push({ id: book.id, title: book.title, author: book.author, editions })
}
await writeFile('src/data/audioCatalog.json', `${JSON.stringify({ schemaVersion: 1, books: [...books, ...bibleAudio.books] }, null, 2)}\n`)
console.log(`${books.length} books; ${books.flatMap(book => book.editions.flatMap(edition => edition.tracks)).length} tracks`)
