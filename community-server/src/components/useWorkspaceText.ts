'use client'
import { useEffect, useMemo, useState } from 'react'
import { workspaceLanguage, type WorkspaceLanguage } from '../lib/workspaceLanguage'
import { translateWorkspaceText, type WorkspaceTextVariables } from '../lib/workspaceText'

export const WORKSPACE_LANGUAGE_EVENT = 'heritage-workspace-language'
export function documentWorkspaceLanguage(): WorkspaceLanguage {
  if (typeof document === 'undefined') return 'en'
  return workspaceLanguage(document.documentElement.lang.split('-')[0])
}

// The same editor runs inside Payload, SyncShow and isolated previews. The document
// language is the shared boundary; no Payload/Next context is required here.
export function useWorkspaceText() {
  const [language, setLanguage] = useState<WorkspaceLanguage>('en')
  useEffect(() => {
    const update = () => setLanguage(documentWorkspaceLanguage())
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    window.addEventListener(WORKSPACE_LANGUAGE_EVENT, update)
    return () => { observer.disconnect(); window.removeEventListener(WORKSPACE_LANGUAGE_EVENT, update) }
  }, [])
  return useMemo(() => Object.assign(
    (value: string, variables?: WorkspaceTextVariables) => translateWorkspaceText(value, language, variables),
    { language },
  ), [language])
}
