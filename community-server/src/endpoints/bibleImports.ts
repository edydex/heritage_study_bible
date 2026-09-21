import type { Endpoint, PayloadRequest } from 'payload'
import { BibleImportError, MAX_BIBLE_IMPORT_BYTES, parseBibleImport } from '../../packages/bible-import/index.js'
import { CANONICAL_BIBLE_BOOKS } from '../lib/syncshow/BibleRange'
import { BUILTIN_BIBLES, importedBibleDigest, installedBibleCatalog } from '../lib/bible/InstalledBibles'
import { publicUrl } from '../lib/publicConfig'
import { editorError, json, managerContext } from './serviceDocuments'

async function body(req: PayloadRequest) {
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new BibleImportError('BIBLE_IMPORT_TYPE', 'Choose a Bible JSON file.', 415)
  const reader = req.body?.getReader()
  if (!reader) throw new BibleImportError('BIBLE_IMPORT_BODY', 'Choose a Bible JSON file.')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BIBLE_IMPORT_BYTES * 2 + 4096) { await reader.cancel(); throw new BibleImportError('BIBLE_IMPORT_TOO_LARGE', 'The import request is too large.', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let value
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new BibleImportError('BIBLE_IMPORT_JSON', 'The import request is not valid JSON.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BibleImportError('BIBLE_IMPORT_JSON', 'The import request is not valid JSON.')
  return value as Record<string, unknown>
}
export async function bibleImportResponse(req: PayloadRequest, action: 'list' | 'preview' | 'install', origin = new URL(publicUrl).origin) {
  try {
    // Installing publisher text requires a church manager, not a paired device.
    if (req.headers.get('authorization')?.startsWith('SyncShow ')) throw new BibleImportError('MANAGER_REQUIRED', 'Sign in as a church manager to import Bible translations.', 403)
    if (action !== 'list' && req.headers.get('origin') !== origin) throw new BibleImportError('BIBLE_IMPORT_ORIGIN', 'Open the Bible library on this church website to import a translation.', 403)
    const { communityId } = await managerContext(req, action === 'install' ? 'write' : 'read')
    if (action === 'list') return json(req, { translations: [...BUILTIN_BIBLES, ...await installedBibleCatalog(req, communityId)] })
    const input = await body(req)
    const expected = action === 'preview' ? ['source'] : ['source', 'digest', 'permissionConfirmed', 'permissionReference']
    if (Object.keys(input).sort().join() !== expected.sort().join()) throw new BibleImportError('BIBLE_IMPORT_FIELDS', 'The Bible import request has missing or unsupported fields.')
    const parsed = parseBibleImport(input.source as string, CANONICAL_BIBLE_BOOKS)
    const digest = importedBibleDigest(parsed.source)
    const existing = (await req.payload.find({ collection: 'bible-translations', depth: 0, limit: 1, overrideAccess: true, req,
      where: { and: [{ community: { equals: communityId } }, { translationId: { equals: parsed.summary.id } }] },
    })).docs[0]
    if (action === 'preview') return json(req, { preview: parsed.summary, digest, installed: existing?.digest === digest, conflict: Boolean(existing && existing.digest !== digest) })
    if (input.digest !== digest) throw new BibleImportError('BIBLE_IMPORT_CHANGED', 'The file changed after its preview. Preview it again.', 409)
    if (input.permissionConfirmed !== true || typeof input.permissionReference !== 'string' || !input.permissionReference.trim() || input.permissionReference.length > 1000) throw new BibleImportError('BIBLE_IMPORT_PERMISSION', 'Confirm your permission and record its license or reference.')
    if (existing) {
      if (existing.digest !== digest) throw new BibleImportError('BIBLE_EDITION_CONFLICT', 'This ID belongs to a different installed edition. Use a new ID; existing slides keep their original text.', 409)
      return json(req, { installed: true, id: parsed.summary.id, digest })
    }
    const user = req.user || (await req.payload.auth({ headers: req.headers })).user
    await req.payload.create({ collection: 'bible-translations', overrideAccess: true, req, data: {
      community: communityId, documentSource: parsed.source, permissionConfirmed: true, permissionReference: input.permissionReference.trim(), installedBy: user!.id,
      translationId: parsed.summary.id, name: parsed.summary.name, language: parsed.summary.language, edition: parsed.summary.edition,
      attribution: parsed.summary.attribution, sourceUrl: parsed.summary.sourceUrl, license: parsed.summary.license,
      digest, bookCount: parsed.summary.bookCount, chapterCount: parsed.summary.chapterCount, verseCount: parsed.summary.verseCount,
    } })
    return json(req, { installed: true, id: parsed.summary.id, digest }, { status: 201 })
  } catch (error) {
    if (error instanceof BibleImportError) return json(req, { code: error.code, error: error.message }, { status: error.status })
    if (['COMMUNITY_AUTH_REQUIRED', 'MANAGER_REQUIRED'].includes(String((error as { code?: string })?.code))) return editorError(req, error)
    // Database errors can contain SQL parameters, including the licensed text.
    req.payload.logger.error('Private Bible import failed; request contents omitted.')
    return json(req, { error: 'The Bible library could not complete this request. Try again; an installed edition will not be overwritten.' }, { status: 503 })
  }
}
export const bibleImportEndpoints: Endpoint[] = [
  { path: '/community/bible-translations', method: 'get', handler: req => bibleImportResponse(req, 'list') },
  { path: '/community/bible-translations/preview', method: 'post', handler: req => bibleImportResponse(req, 'preview') },
  { path: '/community/bible-translations', method: 'post', handler: req => bibleImportResponse(req, 'install') },
]
