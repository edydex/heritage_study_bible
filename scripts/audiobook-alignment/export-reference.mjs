// Use the reader's own parser so recorded paragraph destinations cannot drift.
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { RESOURCE_CATEGORIES } from '../../src/data/resources.js'
import { parseBookChapters } from '../../src/utils/bookChapters.js'
const output = process.argv[2]
if (!output) throw new Error('Pass the path for the reference JSON (outside the repository).')
const books = []
for (const book of RESOURCE_CATEGORIES.find(category => category.id === 'books').items) {
  if (!book.textPath) continue
  const bytes = await readFile(`public/${book.textPath}`)
  books.push({ id: book.id, textPath: book.textPath, textSha256: createHash('sha256').update(bytes).digest('hex'), sourceUrl: book.textUrl,
    chapters: parseBookChapters(bytes.toString('utf8')) })
}
await writeFile(output, JSON.stringify(books))
console.log(`Exported ${books.length} book references.`)
