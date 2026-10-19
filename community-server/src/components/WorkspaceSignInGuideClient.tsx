'use client'

import { useTranslation } from '@payloadcms/ui'

export default function WorkspaceSignInGuideClient({ name }: { name: string }) {
  const { i18n } = useTranslation()
  const ru = i18n.language === 'ru'
  return <section style={{ marginBottom: '24px', textAlign: 'center' }} aria-label={ru ? 'Вход в рабочую область' : 'Church workspace sign-in'}>
    <h1 style={{ fontSize: '26px', marginBottom: '12px' }}>{ru ? `Рабочая область ${name}` : `${name} workspace`}</h1>
    <p>{ru ? 'Войдите с учётной записью руководителя церкви, чтобы готовить богослужения, работать с материалами и управлять переводом.' : 'Sign in with your church manager account to prepare services, manage resources and control live translation.'}</p>
    <p style={{ opacity: 0.75 }}>{ru ? 'Получили приглашение как руководитель или администратор? Откройте письмо, чтобы создать пароль, или нажмите «Забыли пароль?» ниже. Синхронизация чтения в Heritage использует отдельный вход.' : 'Invited as a leader or administrator? Open the workspace invitation email to set your password, or use Forgot Password below. Heritage reading sync has a separate sign-in.'}</p>
    <a href="/">{ru ? 'Вернуться на сайт церкви' : 'Back to the church website'}</a>
  </section>
}
