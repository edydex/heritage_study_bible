'use client'
import { useMemo, useSyncExternalStore } from 'react'
import { WORKSPACE_LANGUAGE_EVENT, workspaceLanguage, type WorkspaceLanguage } from '../lib/workspaceLanguage'
import { translateWorkspaceText, type WorkspaceTextVariables } from '../lib/workspaceText'

export { WORKSPACE_LANGUAGE_EVENT } from '../lib/workspaceLanguage'
export function documentWorkspaceLanguage(): WorkspaceLanguage {
  if (typeof document === 'undefined') return 'en'
  return workspaceLanguage(document.documentElement.lang.split('-')[0])
}
function subscribeLanguage(update: () => void) {
  const observer = new MutationObserver(update)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  window.addEventListener(WORKSPACE_LANGUAGE_EVENT, update)
  return () => { observer.disconnect(); window.removeEventListener(WORKSPACE_LANGUAGE_EVENT, update) }
}

// The same editor runs inside Payload, SyncShow and isolated previews. The document
// language is the shared boundary; no Payload/Next context is required here.
// A newly opened child panel reads the current language on its first render;
// the server snapshot keeps SSR hydration deterministic.
export function useWorkspaceText() {
  const language = useSyncExternalStore(subscribeLanguage, documentWorkspaceLanguage, () => 'en' as WorkspaceLanguage)
  return useMemo(() => Object.assign(
    (value: string, variables?: WorkspaceTextVariables) => translateWorkspaceText(value, language, variables),
    { language },
  ), [language])
}
