import { authorizeTranslation, privateHeaders } from '../lib/translationControl.ts'
import { createHash } from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { SyncShowProtocolError } from '../lib/syncShowProtocol.ts'
import { translationPlanEndpoints } from './translationPlans.ts'
import { translationProviderSettingsEndpoints } from './translationProviderSettings.ts'

async function accessPurpose(req: PayloadRequest): Promise<'live' | 'archive-review'> {
  if (!req.body) return 'live'
  if (Number(req.headers.get('content-length')) > 512) throw new SyncShowProtocolError('REQUEST', 'Access request is too large.', 413)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 512) { await reader.cancel(); throw new SyncShowProtocolError('REQUEST', 'Access request is too large.', 413) }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  if (size === 0) return 'live'
  if (req.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new SyncShowProtocolError('REQUEST', 'Send the access purpose as JSON.', 415)
  let value: unknown
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new SyncShowProtocolError('REQUEST', 'Invalid access request.', 400) }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => key !== 'purpose')) throw new SyncShowProtocolError('REQUEST', 'Invalid access purpose.', 400)
  const purpose = (value as { purpose?: unknown }).purpose ?? 'live'
  if (purpose !== 'live' && purpose !== 'archive-review') throw new SyncShowProtocolError('REQUEST', 'Invalid access purpose.', 400)
  return purpose
}

/** Only the server exchanges its permanent key. Browsers receive a renewable ten-minute lease. */
export async function translationAccessResponse(req: PayloadRequest, options: {
  origin?: string
  processorUrl?: string
  controlToken?: string
  fetch?: typeof fetch
} = {}): Promise<Response> {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders })
  try {
    const purpose = await accessPurpose(req)
    const { origin, identity } = await authorizeTranslation(req, { ...options, archiveReview: purpose === 'archive-review' })
    const key = options.controlToken ?? process.env.TRANSLATION_CONTROL_TOKEN ?? ''
    if (key.length < 32) return respond({ error: 'Live translation needs to be enabled in server setup.' }, 503)
    const processor = new URL(options.processorUrl ?? process.env.TRANSLATION_PROCESSOR_URL ?? 'http://translation-processor:4310')
    if (!['http:', 'https:'].includes(processor.protocol) || processor.username || processor.password || processor.pathname !== '/' || processor.search || processor.hash) throw new Error('Invalid processor origin')
    const response = await (options.fetch ?? fetch)(new URL('/api/control/leases', processor), {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ subject: createHash('sha256').update(identity).digest('hex'), ...(purpose === 'archive-review' ? { scope: 'archive-read' } : {}) }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return respond({ error: 'The translation processor is unavailable. Check server setup.' }, 503)
    const lease = await response.json() as { token?: unknown; expiresAtUnixMs?: unknown }
    if (typeof lease.token !== 'string' || !lease.token.startsWith('mlg1.') || lease.token.length > 2048 || typeof lease.expiresAtUnixMs !== 'number' || lease.expiresAtUnixMs <= Date.now() || lease.expiresAtUnixMs > Date.now() + 610000) throw new Error('Invalid control lease')
    return respond({ token: lease.token, expiresAtUnixMs: lease.expiresAtUnixMs, apiBase: `${origin}/translation/` })
  } catch (error) {
    if (error instanceof SyncShowProtocolError) return respond({ error: error.message }, error.status)
    return respond({ error: 'Live translation is temporarily unavailable.' }, 503)
  }
}

export const translationEndpoints: Endpoint[] = [{ path: '/community/translation/access', method: 'post', handler: req => translationAccessResponse(req) }, ...translationPlanEndpoints, ...translationProviderSettingsEndpoints]
