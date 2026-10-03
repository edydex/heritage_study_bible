'use client'
import { useAuth } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { workspaceIsActive, workspaceScreen } from '../lib/workspaceActivity'

export default function WorkspaceActivityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const path = usePathname()
  useEffect(() => {
    const screen = workspaceScreen(path)
    if (!user || !screen) return
    let lastInteraction = Date.now()
    let lastSent = 0
    const send = (kind: 'navigation' | 'heartbeat') => {
      if (!workspaceIsActive(document.visibilityState === 'visible', lastInteraction, Date.now())) return
      if (kind === 'heartbeat' && Date.now() - lastSent < 60000) return
      lastSent = Date.now()
      void fetch('/api/workspace/activity', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ screen, kind }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {}) // Activity never blocks editing or saving.
    }
    const interact = () => { lastInteraction = Date.now(); send('heartbeat') }
    send('navigation')
    const timer = window.setInterval(() => send('heartbeat'), 60000)
    for (const name of ['pointerdown', 'keydown', 'wheel'] as const) window.addEventListener(name, interact, { passive: true })
    return () => { window.clearInterval(timer); for (const name of ['pointerdown', 'keydown', 'wheel'] as const) window.removeEventListener(name, interact) }
  }, [path, user?.id])
  return children
}
