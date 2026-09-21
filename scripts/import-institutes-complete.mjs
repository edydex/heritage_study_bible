// Complete John Allen's historical translation without changing existing IDs/text.
// Usage: node scripts/import-institutes-complete.mjs /work/institutes-volume-2.txt
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseBookChapters } from '../src/utils/bookChapters.js'
if (!process.argv[2]) throw new Error('Pass the downloaded Gutenberg 64392 plain-text file.')
const first = readFileSync('public/data/books/institutes.txt')
const second = readFileSync(process.argv[2])
const hash = value => createHash('sha256').update(value).digest('hex')
const normalize = value => value.toString('utf8').replace(/\r\n/g, '\n')
const one = normalize(first)
const two = normalize(second)
const startOne = one.search(/^BOOK I\./m)
const endOne = one.search(/^FOOTNOTES\s*$/m)
const startTwo = two.search(/^ +BOOK III\.\s*$/m)
const endTwo = two.indexOf('END OF THE INSTITUTES.')
if ([startOne, endOne, startTwo, endTwo].some(index => index < 0)) throw new Error('Source boundaries changed.')
// Remove note sections, not numbered sections of Calvin's main text.
const partTwo = two.slice(startTwo, endTwo).replace(/^Footnote \d+:[\s\S]*?(?=^ +(?:CHAPTER|BOOK) [IVXLCDM]+\.|(?![\s\S]))/gm, '')
const text = one.slice(startOne, endOne).replace(/\(\d+\)/g, '').trim() + '\n\n' + partTwo.replace(/\[\d+\]/g, '').trim()
const blocks = text.split(/\n{2,}/).map(block => block.replace(/\s+/g, ' ').trim()).filter(Boolean)
const output = 'Institutes of the Christian Religion — Books I–IV\n\nJohn Calvin. English translation by John Allen, sixth American edition. Main text from both historical volumes; scholarly notes and front matter are available at the source links.\n\n' + blocks.join('\n\n') + '\n'
const chapters = parseBookChapters(output)
const actual = chapters.filter(chapter => / - Chapter | - CHAPTER /.test(chapter.title))
if (actual.length !== 80) throw new Error(`Expected all 80 chapters, found ${actual.length}.`)
if (/Footnote \d+:|END OF THE PROJECT GUTENBERG/.test(output)) throw new Error('Unexpected non-body text.')
writeFileSync('public/data/books/institutes-allen-complete.txt', output)
writeFileSync('public/data/books/institutes-allen-sources.json', JSON.stringify({
  schemaVersion: 1, translator: 'John Allen (1771–1839)', edition: 'Sixth American edition, both volumes',
  sources: [
    { url: 'https://www.gutenberg.org/ebooks/45001', sourceSha256: hash(first) },
    { url: 'https://www.gutenberg.org/ebooks/64392', sourceSha256: hash(second) },
  ], textSha256: hash(output), chapters: actual.length,
  normalization: 'Main text from Books I–IV. Footnotes, their numeric markers, front matter and publisher boilerplate omitted. Main text wording and paragraph boundaries preserved; line wraps normalized. No AI translation. Original volume-one resource is unchanged.',
}, null, 2) + '\n')
console.log(`${actual.length} chapters; ${output.length} characters`)
