import type { Endpoint, PayloadRequest } from 'payload'
import { authorizeTranslation, privateHeaders } from '../lib/translationControl.ts'
import { SyncShowProtocolError } from '../lib/syncShowProtocol.ts'

type Options = { origin?: string; processorUrl?: string; controlToken?: string; fetch?: typeof fetch }
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders })
async function tokenBody(req: PayloadRequest) {
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new SyncShowProtocolError('REQUEST', 'Send the token as JSON.', 415)
  const reader = req.body?.getReader()
  if (!reader) throw new SyncShowProtocolError('REQUEST', 'A token is required.', 400)
  let bytes = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 8192) { await reader.cancel(); throw new SyncShowProtocolError('REQUEST', 'Token request is too large.', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let body: unknown
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new SyncShowProtocolError('REQUEST', 'Invalid token request.', 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).join() !== 'apiKey') throw new SyncShowProtocolError('REQUEST', 'Invalid token request.', 400)
  const apiKey = (body as { apiKey: unknown }).apiKey
  if (typeof apiKey !== 'string' || !/^\S{16,4096}$/u.test(apiKey.trim())) throw new SyncShowProtocolError('REQUEST', 'Paste a valid API token.', 400)
  return { apiKey: apiKey.trim() }
}

/** The permanent processor credential and provider token never appear in a browser response or a control lease. */
export async function translationProviderSettingsResponse(req: PayloadRequest, options: Options = {}) {
  try {
    if ((req.headers.get('authorization') || '').startsWith('SyncShow ')) throw new SyncShowProtocolError('ACCESS', 'Use a church manager account to configure provider credentials.', 403)
    await authorizeTranslation(req, options, req.method !== 'GET')
    const key = options.controlToken ?? process.env.TRANSLATION_CONTROL_TOKEN ?? ''
    if (key.length < 32) return respond({ error: 'Enable translation in server setup first.' }, 503)
    const processor = new URL(options.processorUrl ?? process.env.TRANSLATION_PROCESSOR_URL ?? 'http://translation-processor:4310')
    if (!['http:', 'https:'].includes(processor.protocol) || processor.username || processor.password || processor.pathname !== '/' || processor.search || processor.hash) throw new Error('Processor configuration')
    const body = req.method === 'PUT' ? await tokenBody(req) : undefined
    const result = await (options.fetch ?? fetch)(new URL('/api/settings/muse', processor), {
      method: req.method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(40000),
    })
    // Never relay arbitrary provider responses; they can contain upstream request data.
    if (!result.ok) return respond({ error: result.status === 409 ? 'Stop the current session, then check your Muse token and API access and try again.' : 'The translation processor could not update Muse settings.' }, result.status === 409 ? 409 : 503)
    const value = await result.json() as Record<string, unknown>
    if (typeof value.configured !== 'boolean' || !['saved', 'environment', 'none'].includes(String(value.source))) throw new Error('Invalid settings response')
    return respond({ configured: value.configured, source: value.source, verifiedAt: typeof value.verifiedAt === 'string' && Number.isFinite(Date.parse(value.verifiedAt)) ? value.verifiedAt : null })
  } catch (error) {
    if (error instanceof SyncShowProtocolError) return respond({ error: error.message }, error.status)
    return respond({ error: 'Muse settings are temporarily unavailable.' }, 503)
  }
}
export const translationProviderSettingsEndpoints: Endpoint[] = (['get', 'put', 'delete'] as const).map(method => ({ path: '/community/translation/settings/muse', method, handler: req => translationProviderSettingsResponse(req) }))
