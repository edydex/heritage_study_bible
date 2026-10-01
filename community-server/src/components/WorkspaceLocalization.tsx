'use client'

import { useAuth, useTranslation, useDocumentInfo, useField } from '@payloadcms/ui'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { workspaceLanguage, type WorkspaceLanguage } from '@/lib/workspaceLanguage'
import type { User } from '@/payload-types'

export function WorkspaceLocalizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth<User>()
  const { i18n, switchLanguage } = useTranslation()
  const query = useSearchParams()
  const pathname = usePathname()
  const applied = useRef('')
  const requested = query.get('language')
  useEffect(() => {
    const language = user ? workspaceLanguage(user.preferredLanguage)
      : requested === 'ru' || requested === 'en' ? requested : null
    const key = user ? `${user.id}:${user.preferredLanguage}` : `${pathname}:${requested}`
    if (!language || applied.current === key || !switchLanguage) return
    applied.current = key
    if (language !== i18n.language) void switchLanguage(language)
  }, [user, requested, pathname, i18n.language, switchLanguage])
  return children
}

export function AccountLocalizationPreference() {
  const { user, fetchFullUser } = useAuth<User>()
  const { id } = useDocumentInfo()
  const { setValue: setFormLanguage } = useField<WorkspaceLanguage>({ path: 'preferredLanguage' })
  const { i18n, switchLanguage } = useTranslation()
  const ru = i18n.language === 'ru'
  const [language, setLanguage] = useState<WorkspaceLanguage>(workspaceLanguage(user?.preferredLanguage))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => { setLanguage(workspaceLanguage(user?.preferredLanguage)) }, [user?.preferredLanguage])
  const change = async (value: WorkspaceLanguage) => {
    setLanguage(value)
    setSaving(true)
    setNotice('')
    try {
      const response = await fetch('/api/workspace/account/language', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: value }),
      })
      if (!response.ok) throw new Error('Could not save language')
      setFormLanguage(value, true)
      await fetchFullUser()
      await switchLanguage?.(value)
      setNotice(value === 'ru' ? 'Язык сохранён для вашей учётной записи.' : 'Language saved for your account.')
    } catch {
      setLanguage(workspaceLanguage(user?.preferredLanguage))
      setNotice(ru ? 'Не удалось сохранить язык. Попробуйте ещё раз.' : 'Could not save language. Please try again.')
    } finally { setSaving(false) }
  }
  if (!user || String(id) !== String(user.id)) return null
  return <section className="heritage-account-language">
    <h3>{ru ? 'Язык рабочей области' : 'Workspace language'}</h3>
    <label htmlFor="workspace-account-language">{ru ? 'Язык меню и писем' : 'Menu and email language'}</label>
    <select id="workspace-account-language" value={language} disabled={saving}
      onChange={event => { void change(workspaceLanguage(event.target.value)) }}>
      <option value="en">English</option><option value="ru">Русский</option>
    </select>
    <p>{ru ? 'Сохраняется сразу и применяется при входе на другом устройстве.' : 'Saved immediately and used when you sign in on another device.'}</p>
    <small role="status">{saving ? (ru ? 'Сохранение…' : 'Saving…') : notice}</small>
  </section>
}
