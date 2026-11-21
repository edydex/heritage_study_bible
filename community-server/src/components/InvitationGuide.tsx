'use client'

import { useField, useTranslation } from '@payloadcms/ui'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function InvitationGuide() {
  const { i18n } = useTranslation()
  const query = useSearchParams()
  const { value, setValue, formInitializing } = useField<string>({ path: 'email' })
  const { value: role } = useField<string>({ path: 'role' })
  const applied = useRef(false)
  useEffect(() => {
    if (applied.current || formInitializing) return
    applied.current = true
    const email = query.get('email')
    if (!value && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setValue(email)
  }, [query, value, setValue, formInitializing])
  return <div className="heritage-invitation-guide">
    <Link href="/admin/people">← {i18n.language === 'ru' ? 'Все люди' : 'All people'}</Link>
    <p>{role === 'member'
      ? (i18n.language === 'ru' ? 'После сохранения участник получит ссылку для подключения к Heritage. Для доступа к подготовке богослужений выберите роль руководителя или администратора церкви.' : 'Save sends a Heritage join link. For service planning access, choose Church leader or Church administrator.')
      : (i18n.language === 'ru' ? 'После сохранения письмо отправится получателю. Пароль для рабочей области выбирает сам получатель.' : 'Save sends the workspace invitation email. The recipient chooses their own password.')}</p>
  </div>
}
