// Import the historical public-domain editions actually read by LibriVox.
// Usage: node scripts/import-audiobook-editions.mjs /path/to/downloaded-html
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { JSDOM } from 'jsdom'
const folder = process.argv[2]
if (!folder) throw new Error('Pass a folder containing polycarp-lake.html and tertullian-dodgson.html.')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const clean = html => new JSDOM(html).window.document.body.textContent.replace(/\s+/g, ' ').trim()
const sources = [
  { id: 'martyrdom-of-polycarp-lake', input: 'polycarp-lake.html', title: 'The Martyrdom of Polycarp', translator: 'Kirsopp Lake', year: 1912, url: 'https://www.earlychristianwritings.com/text/martyrdompolycarp-lake.html', chapters: 24 },
  { id: 'tertullian-apology-dodgson', input: 'tertullian-dodgson.html', title: "Tertullian’s Apology", translator: 'Charles Dodgson', year: 1842, url: 'https://www.tertullian.org/lfc/LFC10-06_apologeticum.htm', chapters: 50 },
]
for (const source of sources) {
  const bytes = readFileSync(`${folder}/${source.input}`)
  const html = bytes.toString('utf8')
  const blocks = [source.title, `English translation by ${source.translator} (${source.year}). Public-domain text. The source edition and its scholarly notes are linked from this book’s source button.`]
  let count = 0
  if (source.id.includes('polycarp')) {
    // Each chapter's main text ends at its first rule; notes follow that rule.
    for (const match of html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi)) {
      const heading = clean(match[1])
      if (!/^CHAPTER \d+\b/.test(heading)) continue
      const body = match[2].split(/<hr\b/i)[0]
      const doc = new JSDOM(body).window.document
      doc.querySelectorAll('cite, sup, script, style').forEach(node => node.remove())
      const paragraphs = [...doc.querySelectorAll('p')].map(node => node.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)
      if (!paragraphs.length) throw new Error(`Missing text: ${heading}`)
      blocks.push(heading.replace('CHAPTER', 'Chapter'), ...paragraphs)
      count++
    }
  } else {
    const doc = new JSDOM(html).window.document
    let active = false
    for (const node of doc.querySelectorAll('p')) {
      const chapter = node.querySelector('.chapterno')
      if (chapter) {
        const number = Number(chapter.querySelector('a')?.name?.slice(1))
        if (number !== count + 1) throw new Error('Chapter sequence changed.')
        blocks.push(`Chapter ${number}`)
        chapter.remove(); count++; active = true
      }
      if (node.classList.contains('editorial')) break
      if (!active) continue
      node.querySelectorAll('sup, .pb').forEach(element => element.remove())
      const text = node.textContent.replace(/\s+/g, ' ').trim()
      if (text) blocks.push(text)
    }
  }
  if (count !== source.chapters) throw new Error(`Expected ${source.chapters} chapters, found ${count}: ${source.id}`)
  const output = blocks.join('\n\n') + '\n'
  writeFileSync(`public/data/books/${source.id}.txt`, output)
  source.sourceSha256 = hash(bytes)
  source.textSha256 = hash(output)
  delete source.input
  console.log(`${source.id}: ${count} chapters, ${output.length} characters`)
}
writeFileSync('public/data/books/audio-editions-sources.json', JSON.stringify({ schemaVersion: 1, sources, normalization: 'Main text only; historical chapter headings retained, chapter numbers normalized for reader navigation. Scholarly notes, page markers and site navigation omitted; wording and source paragraph boundaries preserved. No AI translation.' }, null, 2) + '\n')
