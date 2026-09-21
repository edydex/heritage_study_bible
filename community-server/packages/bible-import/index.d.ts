export const MAX_BIBLE_IMPORT_BYTES: number
export class BibleImportError extends Error { code: string; status: number; constructor(code: string, message: string, status?: number) }
export type BibleImportMetadata = { id: string; name: string; language: string; edition: string; attribution: string; sourceUrl: string; license: string }
export type BibleImportDocument = { schemaVersion: number; kind: string; translation: BibleImportMetadata; books: { id: string; chapters: { number: number; verses: { number: number; text: string }[] }[] }[] }
export type BibleImportSummary = BibleImportMetadata & { bookCount: number; chapterCount: number; verseCount: number; sample: { bookId: string; chapter: number; verses: { number: number; text: string }[] } }
export function parseBibleImport(source: string, canonicalBooks: readonly { id: string; name: string; chapters: number }[]): { document: BibleImportDocument; source: string; summary: BibleImportSummary }
export function importedBiblePassage(document: BibleImportDocument, range: { bookId: string; start: { chapter: number; verse: number | null }; end: { chapter: number; verse: number | null } }, reference: string): { reference: string; translationId: string; attribution: string; verses: { number: number; text: string }[] }
