// Export the complete displayed text and pinned recording identities to a worker.
// This does not change the app catalog or any published verse timing.
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const output = process.argv[2]
if (!output) throw new Error('Pass a staging reference.json path')
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const index = await read('public/data/translations/BSB/index.json')
const catalog = await read('src/data/bibleAudioCatalog.json')
const metadata = await read('scripts/bible-audio/hays-metadata.json')
const rows = []
for (const meta of index.books) {
  const bytes = await readFile(`public/data/translations/BSB/${meta.file}`)
  const book = JSON.parse(bytes), slug = meta.file.replace('.json', '')
  const audio = catalog.books.find(b => b.bibleSlug === slug)
  if (!audio) throw new Error(`Missing recording book ${slug}`)
  for (const chapter of book.chapters) {
    const track = audio.editions[0].tracks.find(t => t.bible.chapter === chapter.number)
    const media = metadata.find(m => m.url === track?.url)
    if (!track || !media || track.bytes !== media.bytes) throw new Error(`Recording mismatch ${slug} ${chapter.number}`)
    rows.push({ track, textSha256: createHash('sha256').update(bytes).digest('hex'),
      audioHeaderSha256: media.headerSha256, audioHeaderBytes: media.headerBytes,
      verses: chapter.verses.map(({ number, text }) => ({ number, text })) })
  }
}
if (rows.length !== 1189 || rows.reduce((n, r) => n + r.verses.length, 0) !== 31102) throw new Error('Incomplete reference')
await writeFile(output, JSON.stringify(rows) + '\n')
console.log(`${rows.length} chapters exported without changing app data`)
