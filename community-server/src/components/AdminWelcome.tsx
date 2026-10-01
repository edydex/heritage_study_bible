'use client'

import { useTranslation } from '@payloadcms/ui'

const actions = [
  {
    href: '/admin/plan-service',
    title: 'Plan Sunday’s service',
    russianTitle: 'Подготовить воскресное богослужение',
    text: 'Build the order with songs, Scripture, sermon slides, and media in one simple workspace.',
    russianText: 'Составьте порядок богослужения с песнями, чтением Писания, слайдами проповеди и медиа.',
  },
  {
    href: '/admin/prepare-sermon',
    title: 'Prepare a sermon',
    russianTitle: 'Подготовить проповедь',
    text: 'Create a private sermon draft, build its slides, and add the whole sermon to a service.',
    russianText: 'Создайте черновик проповеди, подготовьте слайды и добавьте проповедь в богослужение.',
  },
  {
    href: '/admin/sermon-publications',
    title: 'Publish a sermon',
    russianTitle: 'Опубликовать проповедь',
    text: 'Review the exact sermon text, audio, and video before it appears on the public website.',
    russianText: 'Проверьте текст, аудио и видео проповеди перед публикацией на сайте.',
  },
]

export default function AdminWelcome({ name }: { name: string }) {
  const { i18n } = useTranslation()
  const ru = i18n.language === 'ru'
  return (
    <section className="heritage-admin-welcome">
      <p className="heritage-admin-eyebrow">{ru ? 'Рабочая область церкви' : 'Church workspace'}</p>
      <h1>{ru ? 'Что вы хотите подготовить?' : 'What are you working on?'}</h1>
      <p className="heritage-admin-intro">
        {ru ? 'Начните с воскресного богослужения. Песни и проповеди всегда доступны в меню рабочей области.' : 'Start with the Sunday service. The song and sermon libraries are always available from the workspace menu.'}
      </p>
      <div className="heritage-admin-actions">
        {actions.map(action => (
          <a href={action.href} key={action.href}>
            <strong>{ru ? action.russianTitle : action.title}</strong>
            <span>{ru ? action.russianText : action.text}</span>
          </a>
        ))}
      </div>
      <div className="heritage-admin-links">
        <a href="/" target="_blank">{ru ? `Сайт ${name}` : `Open ${name} website`}</a>
        <a href="/songs">{ru ? 'Опубликованные песни' : 'Browse public song titles'}</a>
        <a href="/sermons">{ru ? 'Опубликованные проповеди' : 'Browse public sermons'}</a>
      </div>
    </section>
  )
}
