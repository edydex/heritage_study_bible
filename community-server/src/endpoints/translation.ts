import { authorizeTranslation, privateHeaders } from '../lib/translationControl.ts'
import { createHash } from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { SyncShowProtocolError } from '../lib/syncShowProtocol.ts'
import { translationPlanEndpoints } from './translationPlans.ts'

/** Only the server exchanges its permanent key. Browsers receive a renewable ten-minute lease. */
export async function translationAccessResponse(req: PayloadRequest, options: {
  origin?: string
  processorUrl?: string
  controlToken?: string
  fetch?: typeof fetch
} = {}): Promise<Response> {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders })
  try {
    const { origin, identity } = await authorizeTranslation(req, options)
    const key = options.controlToken ?? process.env.TRANSLATION_CONTROL_TOKEN ?? ''
    if (key.length < 32) return respond({ error: 'Live translation needs to be enabled in server setup.' }, 503)
    const processor = new URL(options.processorUrl ?? process.env.TRANSLATION_PROCESSOR_URL ?? 'http://translation-processor:4310')
    if (!['http:', 'https:'].includes(processor.protocol) || processor.username || processor.password || processor.pathname !== '/' || processor.search || processor.hash) throw new Error('Invalid processor origin')
    const response = await (options.fetch ?? fetch)(new URL('/api/control/leases', processor), {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ subject: createHash('sha256').update(identity).digest('hex') }),
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

export const translationEndpoints: Endpoint[] = [{ path: '/community/translation/access', method: 'post', handler: req => translationAccessResponse(req) }, ...translationPlanEndpoints]
