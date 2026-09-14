'use client'
import type { ServiceTranslationPlan, TranslationSettings } from '../lib/serviceTranslationPlan'
import { useEffect, useRef, useState } from 'react'
import { TranslationAccessError, translationAccessProblem, workspaceSignInHref } from '../lib/workspaceNavigation'

interface ControlLease { token: string; expiresAtUnixMs: number; apiBase: string }
async function requestAccess(): Promise<ControlLease> {
  const response = await fetch('/api/community/translation/access', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new TranslationAccessError(response.status, body.error || 'Could not open live translation.')
  return body as ControlLease
}

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
        const url = new URL('client/operator.js', initialLease.apiBase).href
        const client = await import(/* webpackIgnore: true */ url) as {
          clientVersion: number
          servicePlanVersion: number
          mount(element: HTMLElement, options: { initialLease: ControlLease; requestAccess: typeof requestAccess; loadServicePlans: typeof loadServicePlans; saveServicePlan: typeof saveServicePlan; preferredServiceId?: string }): () => void
        }
        if (stopped) return
        if (client.clientVersion !== 1 || client.servicePlanVersion !== 1 || typeof client.mount !== 'function') throw new Error('Update the translation processor to use these controls.')
        const preferred = new URL(window.location.href).searchParams.get('service')
        const preferredServiceId = preferred && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(preferred) ? preferred : undefined
        dispose = client.mount(element, { initialLease, requestAccess, loadServicePlans, saveServicePlan, preferredServiceId })
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
