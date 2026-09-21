import { createHash } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { parseBibleImport } from '../../packages/bible-import/index.js'
import { CANONICAL_BIBLE_BOOKS } from '../lib/syncshow/BibleRange'

// Only the scoped import endpoints write this collection. The complete licensed
// text is never exposed by Payload's public REST/GraphQL collection routes.
export const BibleTranslations: CollectionConfig = {
  slug: 'bible-translations',
  admin: { hidden: true },
  lockDocuments: false,
  indexes: [{ fields: ['community', 'translationId'], unique: true }],
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  hooks: { beforeValidate: [({ data, operation }) => {
    if (operation !== 'create') throw new Error('Installed Bible editions are immutable. Import a new edition with a new ID.')
    const parsed = parseBibleImport(String(data?.documentSource || ''), CANONICAL_BIBLE_BOOKS)
    if (!data?.permissionConfirmed || !String(data?.permissionReference || '').trim()) throw new Error('Record your permission to use this translation.')
    return { ...data, translationId: parsed.summary.id, name: parsed.summary.name, language: parsed.summary.language,
      edition: parsed.summary.edition, attribution: parsed.summary.attribution, sourceUrl: parsed.summary.sourceUrl,
      license: parsed.summary.license, bookCount: parsed.summary.bookCount, chapterCount: parsed.summary.chapterCount,
      verseCount: parsed.summary.verseCount, documentSource: parsed.source,
      digest: createHash('sha256').update(parsed.source).digest('hex') }
  }] },
  fields: [
    { name: 'community', type: 'relationship', relationTo: 'communities', required: true },
    ...['translationId', 'name', 'language', 'edition', 'attribution', 'sourceUrl', 'license', 'digest'].map(name => ({ name, type: 'text' as const, required: true })),
    ...['bookCount', 'chapterCount', 'verseCount'].map(name => ({ name, type: 'number' as const, required: true })),
    { name: 'documentSource', type: 'textarea', required: true, hidden: true },
    { name: 'permissionConfirmed', type: 'checkbox', required: true },
    { name: 'permissionReference', type: 'text', required: true, maxLength: 1000, hidden: true },
    { name: 'installedBy', type: 'relationship', relationTo: 'users', required: true },
  ],
}
