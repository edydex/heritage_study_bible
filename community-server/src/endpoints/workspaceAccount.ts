import type { Endpoint, PayloadRequest } from 'payload'

/** A cookie workspace user may change only their language, even without generic user-update permission. */
export async function workspaceAccountLanguageResponse(req: PayloadRequest) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!req.user || (req.user as { _strategy?: string })._strategy !== 'local-jwt') return respond({ error: 'Sign in to the church workspace.' }, 401)
  const origin = req.headers.get('origin')
  const expectedOrigin = new URL(req.payload.config.serverURL || req.url || 'http://localhost:3000').origin
  if (!origin || origin !== expectedOrigin) return respond({ error: 'Use the church workspace to change your language.' }, 403)
  let data: unknown
  try { data = await req.json?.() } catch { return respond({ error: 'Choose English or Russian.' }, 400) }
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || Object.keys(data).some(key => key !== 'language')
    || !('language' in data) || (data.language !== 'en' && data.language !== 'ru')) {
    return respond({ error: 'Choose English or Russian.' }, 400)
  }
  await req.payload.update({ collection: 'users', id: req.user.id, req, overrideAccess: true,
    data: { preferredLanguage: data.language } })
  return respond({ language: data.language })
}

export const workspaceAccountEndpoints: Endpoint[] = [{
  path: '/workspace/account/language', method: 'post', handler: workspaceAccountLanguageResponse,
}]
