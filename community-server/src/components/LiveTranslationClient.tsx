'use client'
import { useEffect, useRef, useState } from 'react'

interface ControlLease { token: string; expiresAtUnixMs: number; apiBase: string }
async function requestAccess(): Promise<ControlLease> {
  const response = await fetch('/api/community/translation/access', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Could not open live translation.')
  return body as ControlLease
}

export default function LiveTranslationClient() {
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stopped = false
    let dispose: (() => void) | undefined
    const element = document.createElement('div')
    host.current?.append(element)
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const initialLease = await requestAccess()
        const url = new URL('client/operator.js', initialLease.apiBase).href
        const client = await import(/* webpackIgnore: true */ url) as {
          clientVersion: number
          mount(element: HTMLElement, options: { initialLease: ControlLease; requestAccess: typeof requestAccess }): () => void
        }
        if (stopped) return
        if (client.clientVersion !== 1 || typeof client.mount !== 'function') throw new Error('Update the translation processor to use these controls.')
        dispose = client.mount(element, { initialLease, requestAccess })
        setLoading(false)
      } catch (cause) {
        if (!stopped) { setError(cause instanceof Error ? cause.message : 'Live translation is unavailable.'); setLoading(false) }
      }
    })()
    return () => { stopped = true; dispose?.(); element.remove() }
  }, [attempt])
  return <section style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
    <div ref={host} />
    {loading && <p role="status">Opening live translation…</p>}
    {error && <><h1>Live translation</h1><p role="alert">{error}</p><p><a href="/admin/login?redirect=%2Fadmin%2Flive-translation">Sign in to the church workspace</a></p><button onClick={() => setAttempt(value => value + 1)}>Try again</button></>}
  </section>
}
