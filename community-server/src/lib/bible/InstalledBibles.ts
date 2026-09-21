import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { BibleImportError, importedBiblePassage, parseBibleImport } from '../../../packages/bible-import/index.js'
import { CANONICAL_BIBLE_BOOKS, formatBibleRange, type CanonicalBibleRange } from '../syncshow/BibleRange'

export const BUILTIN_BIBLES = [
  { id: 'BSB', name: 'Berean Standard Bible', language: 'en', edition: 'Heritage reader edition', builtin: true },
  { id: 'SYNO-W', name: 'Russian Synodal Bible', language: 'ru', edition: 'Heritage reader edition', builtin: true },
]
export const importedBibleDigest = (source: string) => createHash('sha256').update(source).digest('hex')
export async function installedBibleCatalog(req: PayloadRequest, communityId: number) {
  const result = await req.payload.find({ collection: 'bible-translations', overrideAccess: true, depth: 0, pagination: false,
    req, where: { community: { equals: communityId } }, sort: 'name',
    select: { translationId: true, name: true, language: true, edition: true, attribution: true, sourceUrl: true, license: true, digest: true, bookCount: true, chapterCount: true, verseCount: true },
  })
  return result.docs.map(row => ({ id: row.translationId, name: row.name, language: row.language, edition: row.edition,
    attribution: row.attribution, sourceUrl: row.sourceUrl, license: row.license, digest: row.digest,
    bookCount: row.bookCount, chapterCount: row.chapterCount, verseCount: row.verseCount, builtin: false }))
}
export async function installedBiblePassage(req: PayloadRequest, communityId: number, translationId: string, range: CanonicalBibleRange) {
  const row = (await req.payload.find({ collection: 'bible-translations', overrideAccess: true, showHiddenFields: true,
    req, depth: 0, limit: 1, where: { and: [{ community: { equals: communityId } }, { translationId: { equals: translationId } }] },
  })).docs[0]
  if (!row) throw new BibleImportError('BIBLE_NOT_INSTALLED', 'That Bible edition is not installed for this church.', 404)
  const parsed = parseBibleImport(row.documentSource, CANONICAL_BIBLE_BOOKS)
  if (row.translationId !== parsed.summary.id || importedBibleDigest(parsed.source) !== row.digest) throw new BibleImportError('BIBLE_INTEGRITY', 'The installed Bible failed its integrity check. Import a verified edition before using it.', 503)
  return { passage: importedBiblePassage(parsed.document, range, formatBibleRange(range)), sourceUrl: parsed.summary.sourceUrl }
}
