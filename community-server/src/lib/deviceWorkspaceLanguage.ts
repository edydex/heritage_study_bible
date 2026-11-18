import { WORKSPACE_LANGUAGE_EVENT } from './workspaceLanguage'

type LanguageEnvironment = {
  documentElement: { lang: string }
  dispatchLanguageChange: () => void
}

function browserEnvironment(): LanguageEnvironment | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null
  return {
    documentElement: document.documentElement,
    dispatchLanguageChange: () => window.dispatchEvent(new Event(WORKSPACE_LANGUAGE_EVENT)),
  }
}

/** Native WebContentsView and cached offline lists use the same server-verified
 * device marker. Cookie-authenticated pages keep Payload's language selection. */
export function applyDeviceWorkspaceLanguage(
  response: unknown,
  environment: LanguageEnvironment | null = browserEnvironment(),
) {
  if (!response || typeof response !== 'object' || Array.isArray(response) || !environment) return false
  const value = response as Record<string, unknown>
  if (value.workspaceLanguageSource !== 'device'
    || (value.workspaceLanguage !== 'en' && value.workspaceLanguage !== 'ru')) return false
  if (environment.documentElement.lang !== value.workspaceLanguage) {
    environment.documentElement.lang = value.workspaceLanguage
    environment.dispatchLanguageChange()
  }
  return true
}
