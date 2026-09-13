'use client'

import { useEffect, useRef, useState } from 'react'
import type { LiveServiceSettings } from '@/lib/liveServiceConfig'

/** One public Multilinguum client owns captions and audio across both Heritage pages. */
export function LiveServiceClient({ settings, video = false }: { settings: LiveServiceSettings; video?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  useEffect(() => {
    let stopped = false
    let dispose: (() => void) | undefined
    const element = document.createElement('div')
    host.current?.append(element)
    const load = async () => {
      setState('loading')
      try {
        const configured = settings.translationUrl
        if (!configured) throw new Error('Translation has not been configured')
        const base = configured === '/translate' ? new URL('/translation/', window.location.origin)
          : new URL(configured.endsWith('/') ? configured : `${configured}/`)
        const url = new URL('client/heritage.js', base).href
        const client = await import(/* webpackIgnore: true */ url) as {
          clientVersion: number
          mount(element: HTMLElement, options: { apiBase: string; churchName: string; videoId: string | null; channelUrl: string | null }): () => void
        }
        if (stopped) return
        if (client.clientVersion !== 1 || typeof client.mount !== 'function') throw new Error('Incompatible listener client')
        dispose = client.mount(element, { apiBase: base.href, churchName: settings.churchName, videoId: video ? settings.videoId : null, channelUrl: video ? settings.channelUrl : null })
        setState('ready')
      } catch { if (!stopped) setState('unavailable') }
    }
    void load()
    return () => { stopped = true; dispose?.(); element.remove() }
  }, [settings.translationUrl, settings.churchName, settings.videoId, settings.channelUrl, video])

  return <>
    <div ref={host} className="live-service-client" />
    {state === 'loading' && <p role="status">Opening live service…</p>}
    {state === 'unavailable' && <section className="live-service-fallback">
      {video && settings.videoId && <iframe src={`https://www.youtube.com/embed/${settings.videoId}`} title={`${settings.churchName} live service`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />}
      <p>Live translation is currently unavailable here.</p>
      {settings.translationUrl && settings.translationUrl !== '/translate' && <p><a href={settings.translationUrl} target="_blank" rel="noreferrer">Open the translation listener ↗</a></p>}
      {video && settings.channelUrl && <p><a href={settings.channelUrl} target="_blank" rel="noreferrer">Visit the church’s YouTube channel ↗</a></p>}
    </section>}
  </>
}
