'use client'
import type { ServiceTranslationPlan, TranslationSettings } from '../lib/serviceTranslationPlan'
import { useEffect, useRef, useState } from 'react'
import { TranslationAccessError, translationAccessProblem, workspaceSignInHref } from '../lib/workspaceNavigation'

interface SlideBridge { version: number; onCommand: unknown; report: unknown; getInput: unknown; saveInput: unknown }
declare global { interface Window { syncShowTranslation?: SlideBridge } }

interface ControlLease { token: string; expiresAtUnixMs: number; apiBase: string }
async function requestAccess(purpose?: 'archive-review'): Promise<ControlLease> {
  const response = await fetch('/api/community/translation/access', { method: 'POST', credentials: 'same-origin', cache: 'no-store', ...(purpose ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ purpose }) } : {}) })
  const body = await response.json()
  if (!response.ok) throw new TranslationAccessError(response.status, body.error || 'Could not open live translation.')
  return body as ControlLease
}

const requestArchiveAccess = () => requestAccess('archive-review')
async function museRequest(method = 'GET', apiKey?: string) {
  const response = await fetch('/api/community/translation/settings/muse', { method, credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, ...(apiKey !== undefined ? { body: JSON.stringify({ apiKey }) } : {}) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Could not update Muse settings.')
  return body as { configured: boolean; source: string; verifiedAt: string | null }
}
const museSettings = { read: () => museRequest(), save: (apiKey: string) => museRequest('PUT', apiKey), remove: () => museRequest('DELETE') }

async function loadServicePlans(serviceId?: string): Promise<{ schemaVersion: 1; services: ServiceTranslationPlan[] }> {
  const response = await fetch(`/api/community/translation/plans${serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : ''}`, { credentials: 'same-origin', cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Could not load prepared services.')
  if (body.schemaVersion !== 1 || !Array.isArray(body.services)) throw new Error('Update Community to load translation settings.')
  return body
}
async function saveServicePlan(input: { serviceId: string; serviceRevision: string; baseRevision: number; settings: TranslationSettings }): Promise<{ schemaVersion: 1; service: ServiceTranslationPlan }> {
  const response = await fetch('/api/community/translation/plans', { method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Could not save translation settings.')
  if (body.schemaVersion !== 1 || !body.service) throw new Error('Update Community to save translation settings.')
  return body
}

export default function LiveTranslationClient() {
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<ReturnType<typeof translationAccessProblem>>()
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stopped = false
    let dispose: (() => void) | undefined
    const element = document.createElement('div')
    host.current?.append(element)
    setLoading(true)
    setError(undefined)
    void (async () => {
      try {
        const initialLease = await requestAccess()
        // This stable entry filename changes with processor deployments. Do not let a
        // browser/CDN reuse an older cue engine when opening a new control session.
        const entry = new URL('client/operator.js', initialLease.apiBase)
        entry.searchParams.set('load', String(Date.now()))
        const url = entry.href
        const client = await import(/* webpackIgnore: true */ url) as {
          clientVersion: number
          servicePlanVersion: number
          archiveReviewVersion?: number
          museSettingsVersion?: number
          slideAutomationVersion?: number
          mount(element: HTMLElement, options: { initialLease: ControlLease; requestAccess: typeof requestAccess; requestArchiveAccess?: typeof requestArchiveAccess; loadServicePlans: typeof loadServicePlans; saveServicePlan: typeof saveServicePlan; preferredServiceId?: string; museSettings?: typeof museSettings; slideAutomation?: SlideBridge }): () => void
        }
        if (stopped) return
        if (client.clientVersion !== 1 || client.servicePlanVersion !== 1 || typeof client.mount !== 'function') throw new Error('Update the translation processor to use these controls.')
        const bridge = window.syncShowTranslation
        if (bridge && client.slideAutomationVersion !== 1) throw new Error('Update the translation processor to use slide cues.')
        const preferred = new URL(window.location.href).searchParams.get('service')
        const preferredServiceId = preferred && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(preferred) ? preferred : undefined
        dispose = client.mount(element, { initialLease, requestAccess, ...(client.archiveReviewVersion === 1 ? { requestArchiveAccess } : {}), ...(client.museSettingsVersion === 1 ? { museSettings } : {}), loadServicePlans, saveServicePlan, preferredServiceId, ...(bridge?.version === 1 ? { slideAutomation: bridge } : {}) })
        setLoading(false)
      } catch (cause) {
        if (!stopped) {
          const problem = translationAccessProblem(cause)
          setError(problem)
          setLoading(false)
          if (problem.signInRequired) window.location.replace(workspaceSignInHref('/admin/live-translation', {
            service: new URL(window.location.href).searchParams.getAll('service'),
          }))
        }
      }
    })()
    return () => { stopped = true; dispose?.(); element.remove() }
  }, [attempt])
  return <section style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
    <div ref={host} />
    {loading && <p role="status">Opening live translation…</p>}
    {error && <><h1>Live translation</h1><p role="alert">{error.message}</p>
      {error.signInRequired
        ? <p><a href={workspaceSignInHref('/admin/live-translation', { service: new URL(window.location.href).searchParams.getAll('service') })}>Sign in to the church workspace</a></p>
        : <p><a href="/admin">Back to the church workspace</a></p>}
      <button onClick={() => setAttempt(value => value + 1)}>Try again</button></>}
  </section>
}
