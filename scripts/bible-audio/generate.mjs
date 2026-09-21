// Deterministic BSB audio catalog/timing import. Inputs are public pinned data,
// never a transcription model or an alteration of the displayed Bible text.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const source = process.env.BSB_ALIGNMENT_DIR
if (!source) throw new Error('Set BSB_ALIGNMENT_DIR to the pinned bsb-align checkout documented in docs/BIBLE-AUDIO.md.')
const revision = 'bdb859afc427b215b78e12ee4a7798c32b7b91e0'
if (execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision) throw new Error('Unexpected alignment revision')
const sha = value => createHash('sha256').update(value).digest('hex')
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const codes = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ')
const index = await read('public/data/translations/BSB/index.json')
const metadata = await read('scripts/bible-audio/hays-metadata.json')
const books = [], audit = { source: 'https://github.com/BSB-publishing/bsb-align', revision, metadataSha256: sha(JSON.stringify(metadata)), counts: {}, books: [] }
const normalized = text => (String(text).toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || []).join(' ')
await mkdir('public/data/audio/bsb-hays', { recursive: true })
for (const [i, meta] of index.books.entries()) {
  const book = await read(`public/data/translations/BSB/${meta.file}`), code = codes[i], slug = meta.file.replace('.json', '')
  const editionId = 'bsb-hays', bookId = `bible-bsb-${slug}`
  const timing = { schemaVersion: 1, translation: 'BSB', book: book.name, chapters: {} }, tracks = [], hashes = []
  for (const chapter of book.chapters) {
    const file = metadata.find(row => Number(row.file.split('_')[1]) === i + 1 && Number(row.file.split('_')[3]) === chapter.number)
    if (!file || !Number.isSafeInteger(file.bytes) || file.bytes < 1000 || !(file.duration > 1)) throw new Error(`Missing audio metadata ${code} ${chapter.number}`)
    const bytes = await readFile(`${source}/output/${code}/${code}_${String(chapter.number).padStart(3, '0')}_words.json`)
    hashes.push(sha(bytes))
    const aligned = JSON.parse(bytes).verses, spans = [], rejected = {}
    for (const verse of chapter.verses) {
      const words = aligned[String(verse.number)] || []
      let reason = !words.length ? 'missing' : normalized(verse.text) !== normalized(words.map(w => w.text).join(' ')) ? 'textMismatch' : null
      if (!reason && words.some(w => !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < 0 || w.end <= w.start || w.end > file.duration)) reason = 'invalidSpan'
      if (!reason && words.some((w, j) => j && words[j - 1].end > w.start + 0.02)) reason = 'wordOverlap'
      if (!reason && (words.reduce((sum, w) => sum + (w.score || 0), 0) / words.length < 0.65 || words[0].score < 0.3 || words.at(-1).score < 0.3)) reason = 'lowConfidence'
      if (reason) rejected[verse.number] = reason
      else spans.push({ verse: verse.number, start: words[0].start, end: words.at(-1).end, text: normalized(verse.text) })
    }
    // Exclude both sides of an overlap; do not stretch a valid verse through a
    // rejected/truncated passage or a narrator pause.
    const conflicts = new Set()
    for (let j = 1; j < spans.length; j++) if (spans[j - 1].end > spans[j].start) { conflicts.add(spans[j - 1].verse); conflicts.add(spans[j].verse) }
    for (const verse of conflicts) rejected[verse] = 'verseOverlap'
    const accepted = spans.filter(span => !conflicts.has(span.verse))
    for (const reason of Object.values(rejected)) audit.counts[reason] = (audit.counts[reason] || 0) + 1
    audit.counts.accepted = (audit.counts.accepted || 0) + accepted.length
    timing.chapters[chapter.number] = { verses: accepted, totalVerses: chapter.verses.length }
    tracks.push({ id: `bsb-hays-${String(i + 1).padStart(2, '0')}-${String(chapter.number).padStart(3, '0')}`, bookId, editionId,
      title: `${book.name} ${chapter.number}`, url: file.url, bytes: file.bytes, duration: file.duration,
      bible: { translation: 'BSB', book: book.name, slug, chapter: chapter.number, timedVerses: accepted.length, totalVerses: chapter.verses.length } })
  }
  await writeFile(`public/data/audio/bsb-hays/${slug}.json`, JSON.stringify(timing) + '\n')
  audit.books.push({ book: book.name, alignmentFilesSha256: sha(hashes.join('\n')), displayedTextSha256: sha(await readFile(`public/data/translations/BSB/${meta.file}`)) })
  books.push({ id: bookId, kind: 'bible', title: book.name, author: 'Berean Standard Bible · Barry Hays', bibleSlug: slug,
    editions: [{ id: 'bsb-hays', title: 'Berean Standard Bible · Barry Hays', sourceUrl: 'https://biblehub.com/audio/', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', tracks }] })
}
await writeFile('src/data/bibleAudioCatalog.json', JSON.stringify({ schemaVersion: 1, books }, null, 2) + '\n')
const existing = await read('src/data/audioCatalog.json')
await writeFile('src/data/audioCatalog.json', JSON.stringify({ ...existing, books: [...existing.books.filter(book => book.kind !== 'bible'), ...books] }, null, 2) + '\n')
await writeFile('scripts/bible-audio/timing-audit.json', JSON.stringify(audit, null, 2) + '\n')
console.log(JSON.stringify(audit.counts), books.length, 'books')
