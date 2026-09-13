import { sql } from 'drizzle-orm'
import type { Endpoint, PayloadRequest } from 'payload'
import { authorizeTranslation, privateHeaders } from '../lib/translationControl.ts'
import { findServiceDocument } from './syncShow.ts'
import { withSyncTransaction } from '../lib/syncDatabase.ts'
import { SyncShowProtocolError } from '../lib/syncShowProtocol.ts'
import { parseTranslationPlanWrite, serviceTranslationPlan, serviceIdPattern } from '../lib/serviceTranslationPlan.ts'

const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders })
function fail(message: string, status: number): never { throw new SyncShowProtocolError('TRANSLATION_PLAN', message, status) }
async function readWrite(req: PayloadRequest) {
  if (req.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') fail('Send translation settings as JSON.', 415)
  if (Number(req.headers.get('content-length')) > 16384) fail('Translation settings are too large.', 413)
  const reader = req.body?.getReader()
  if (!reader) fail('Translation settings are required.', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 16384) { await reader.cancel(); fail('Translation settings are too large.', 413) }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  let value: unknown
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { fail('Invalid translation settings JSON.', 400) }
  return parseTranslationPlanWrite(value)
}
async function requireNotes(ids: string[], options: { processorUrl?: string; controlToken?: string; fetch?: typeof fetch }) {
  if (!ids.length) return
  const key = options.controlToken ?? process.env.TRANSLATION_CONTROL_TOKEN ?? ''
  if (key.length < 32) fail('Enable translation in server setup before selecting sermon notes.', 503)
  const processor = new URL(options.processorUrl ?? process.env.TRANSLATION_PROCESSOR_URL ?? 'http://translation-processor:4310')
  if (!['http:', 'https:'].includes(processor.protocol) || processor.username || processor.password || processor.pathname !== '/' || processor.search || processor.hash) fail('Check translation server setup.', 503)
  const result = await (options.fetch ?? fetch)(new URL('/api/context-documents', processor), {
    headers: { authorization: `Bearer ${key}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
  })
  if (!result.ok) fail('Sermon notes could not be checked. Try again.', 503)
  const documents = await result.json() as Array<{ id?: string }>
  if (!Array.isArray(documents) || ids.some(id => !documents.some(document => document.id === id))) fail('Some sermon notes are no longer available. Select them again.', 409)
}
export async function translationPlansResponse(req: PayloadRequest, options: { origin?: string; processorUrl?: string; controlToken?: string; fetch?: typeof fetch } = {}) {
  try {
    const write = req.method === 'PUT'
    const { communityId } = await authorizeTranslation(req, options, write)
    if (!write) {
      const query = new URL(req.url || '/', options.origin || 'http://localhost').searchParams
      const id = query.get('serviceId')
      if ([...query.keys()].some(key => key !== 'serviceId') || query.getAll('serviceId').length > 1 || (id !== null && !serviceIdPattern.test(id))) fail('Invalid service selection.', 400)
      const docs = id ? [await findServiceDocument(req, communityId, id)].filter(Boolean) : (await req.payload.find({
        collection: 'service-documents', depth: 0, limit: 100, sort: '-serviceDate', overrideAccess: true, showHiddenFields: true, req,
        select: { syncId: true, title: true, serviceDate: true, revision: true, status: true, translationPlan: true },
        where: { and: [{ community: { equals: communityId } }, { status: { in: ['planning', 'ready'] } }] },
      })).docs
      const services = docs.filter(doc => doc && ['planning', 'ready'].includes(String(doc.status)))
        .map(doc => serviceTranslationPlan(doc as unknown as Record<string, unknown>, communityId))
      return respond({ schemaVersion: 1, services })
    }
    const input = await readWrite(req)
    // Verify service ownership/existence before contacting the processor.
    const initial = await findServiceDocument(req, communityId, input.serviceId)
    if (!initial) fail('This service is no longer available.', 404)
    await requireNotes(input.settings.contextDocumentIds, options)
    const saved = await withSyncTransaction(req, async () => {
      const adapter = req.payload.db as unknown as { sessions: Record<string, { db: { execute: (query: unknown) => Promise<unknown> } }> }
      const db = adapter.sessions[String(req.transactionID)]?.db
      if (!db) fail('Translation settings cannot be saved right now.', 503)
      // Shared with canonical service writes; row lock also covers direct Payload updates.
      await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`service-document:${communityId}:${input.serviceId}`}));`)
      await db.execute(sql`SELECT "id" FROM "service_documents" WHERE "id" = ${Number(initial.id)} FOR UPDATE;`)
      const current = await findServiceDocument(req, communityId, input.serviceId)
      if (!current || !['planning', 'ready'].includes(String(current.status))) fail('This service is no longer available for preparation.', 409)
      const plan = serviceTranslationPlan(current, communityId)
      if (plan.serviceRevision !== input.serviceRevision || plan.revision !== input.baseRevision) fail('This service or its translation settings changed. Reload the service, review, and save again.', 409)
      const translationPlan = { schemaVersion: 1, revision: input.baseRevision + 1, serviceRevision: input.serviceRevision, settings: input.settings }
      await req.payload.update({ collection: 'service-documents', id: Number(current.id), data: { translationPlan }, overrideAccess: true, req })
      return serviceTranslationPlan({ ...current, translationPlan }, communityId)
    })
    return respond({ schemaVersion: 1, service: saved })
  } catch (error) {
    if (error instanceof SyncShowProtocolError) return respond({ error: error.message }, error.status)
    return respond({ error: 'Translation settings are temporarily unavailable. Try again.' }, 503)
  }
}
export const translationPlanEndpoints: Endpoint[] = ['get', 'put'].map(method => ({
  path: '/community/translation/plans', method: method as 'get' | 'put', handler: req => translationPlansResponse(req),
}))
