'use client'

import { useEffect, useState } from 'react'
import { openedWorkspaceServices, workspaceHomeServices, workspaceServiceHref, type WorkspaceService } from '../lib/workspaceHome'
import { useWorkspaceText } from './useWorkspaceText'

export default function AdminWelcome({name}: {name:string}) {
  const t = useWorkspaceText()
  const [services,setServices] = useState<WorkspaceService[] | null>(null), [opened,setOpened] = useState<string[]>([]), [error,setError] = useState(false)
  const {continued,personal,recent} = workspaceHomeServices(services || [],opened)
  async function refresh(signal?:AbortSignal) {
    try {
      const response = await fetch('/api/community/service-documents',{credentials:'same-origin',cache:'no-store',signal})
      if (!response.ok) throw new Error('Unavailable')
      const result = await response.json()
      if (!Array.isArray(result.items)) throw new Error('Unavailable')
      setServices(result.items); setError(false)
      try { setOpened(openedWorkspaceServices(localStorage,result)) } catch { setOpened([]) }
    } catch { if (!signal?.aborted) setError(true) }
  }
  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    const refocus = () => void refresh(controller.signal)
    window.addEventListener('focus',refocus)
    return () => {controller.abort();window.removeEventListener('focus',refocus)}
  },[])
  const date = (value:string) => new Intl.DateTimeFormat(t.language === 'ru' ? 'ru' : 'en',{weekday:'short',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`))
  const edited = (value:string) => new Intl.DateTimeFormat(t.language === 'ru' ? 'ru' : 'en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value))
  return <section className="heritage-workspace-home">
    <header className="heritage-workspace-home__heading"><p>{name}</p><h1>{t('Workspace')}</h1></header>
    {error && <p className="heritage-workspace-home__error" role="status">{t('Services could not be loaded. You can still open the planner or create a song.')} <button type="button" onClick={() => void refresh()}>{t('Retry')}</button></p>}
    <div className="heritage-workspace-home__main">
      <div className="heritage-workspace-home__planning">
        <h2>{t('Continue planning')}</h2>
        {continued ? <a className="heritage-workspace-home__continue" href={workspaceServiceHref(continued.syncId)}>
          <div><time dateTime={continued.serviceDate}>{date(continued.serviceDate)}</time><span className="heritage-workspace-home__status">{t(continued.status === 'ready' ? 'Ready' : 'Planning')}</span></div>
          <h3>{continued.title}</h3><p>{t(personal ? 'Last opened by you' : 'Most recently edited')} · {t('Edited {date}',{date:edited(continued.changedAt)})}</p>
          <strong>{t('Open service')} <span aria-hidden="true">→</span></strong>
        </a> : <div className="heritage-workspace-home__empty" role="status">
          <h3>{t(error ? 'Open the service planner' : services === null ? 'Finding your recent services…' : 'Start your next service')}</h3>
          <p>{t(error ? 'Your saved services are available in the planner.' : services === null ? 'Your latest work will appear here.' : 'Add songs, Scripture, sermon slides and media to one service plan.')}</p>
          {(services !== null || error) && <a className="heritage-workspace-home__primary" href={error ? '/admin/plan-service' : '/admin/plan-service?new=1'}>{t(error ? 'Plan a service' : 'New service')} <span aria-hidden="true">→</span></a>}
        </div>}
        {!!recent.length && <section className="heritage-workspace-home__recent"><header><h2>{t('Other recent services')}</h2><a href="/admin/plan-service">{t('All services')} <span aria-hidden="true">→</span></a></header>
          {recent.map(service => <a className="heritage-workspace-home__service" key={service.syncId} href={workspaceServiceHref(service.syncId)}><div><strong>{service.title}</strong><time dateTime={service.serviceDate}>{date(service.serviceDate)}</time><small>{t('Edited {date}',{date:edited(service.changedAt)})}</small></div><span className="heritage-workspace-home__status">{t(service.status === 'ready' ? 'Ready' : 'Planning')}</span><span aria-hidden="true">→</span></a>)}
        </section>}
      </div>
      <section className="heritage-workspace-home__start"><h2>{t('Start something new')}</h2>
        <div>
          {(services === null || continued) && <a className="heritage-workspace-home__primary" href="/admin/plan-service?new=1"><span aria-hidden="true">＋</span><strong>{t('New service')}</strong></a>}
          <a href="/admin/collections/songs/create"><span aria-hidden="true">♪</span><div><strong>{t('Add a song')}</strong><small>{t('Type lyrics or import a PowerPoint.')}</small></div><span aria-hidden="true">→</span></a>
          <a href="/admin/prepare-sermon"><span aria-hidden="true">¶</span><div><strong>{t('Prepare a sermon')}</strong><small>{t('Start a draft and build its slides.')}</small></div><span aria-hidden="true">→</span></a>
        </div><p>{t('Songs and sermons are saved to their libraries. Add them to a service when you are ready.')}</p>
      </section>
    </div>
    <nav className="heritage-workspace-home__libraries" aria-label={t('Workspace shortcuts')}>
      <a href="/admin/collections/songs">{t('Song library')} <span aria-hidden="true">→</span></a><a href="/admin/collections/sermons">{t('Sermon library')} <span aria-hidden="true">→</span></a><a href="/admin/collections/media">{t('Media library')} <span aria-hidden="true">→</span></a><a href="/admin/sermon-publications">{t('Publish a sermon')} <span aria-hidden="true">→</span></a><a href="/admin/live-translation">{t('Live translation')} <span aria-hidden="true">→</span></a>
    </nav>
  </section>
}
