'use client'
import { useEffect, useState } from 'react'
import { useWorkspaceText } from './useWorkspaceText'

type Activity = { user: string; screen: string; lastNavigationAt: string; lastActiveAt: string }
export default function RecentWorkspaceActivity() {
  const t = useWorkspaceText()
  const [rows, setRows] = useState<Activity[] | null>(null)
  const [error, setError] = useState(false)
  const refresh = async () => {
    try {
      const response = await fetch('/api/workspace/activity', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error('Unavailable')
      const result = await response.json()
      setRows(result.items); setError(false)
    } catch { setError(true) }
  }
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 60000); return () => clearInterval(timer) }, [])
  return <details className="heritage-workspace-activity">
    <summary>{t('Recent workspace activity')}</summary>
    <p>{t('Page visits and active use in the last hour. Idle or hidden tabs stop sending activity after five minutes.')}</p>
    <button type="button" onClick={() => void refresh()}>{t('Refresh')}</button>
    {error ? <p role="status">{t('Activity could not be checked. Do not assume the workspace is idle.')}</p>
      : rows === null ? <p>{t('Loading…')}</p> : !rows.length ? <p>{t('No recorded workspace activity in the last hour.')}</p>
      : <table><thead><tr><th>{t('Person')}</th><th>{t('Screen')}</th><th>{t('Last activity')}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{row.user}</td><td>{t(row.screen)}</td><td><time dateTime={row.lastActiveAt}>{new Date(row.lastActiveAt).toLocaleTimeString(t.language === 'ru' ? 'ru' : 'en', { hour: 'numeric', minute: '2-digit' })}</time></td></tr>)}</tbody></table>}
  </details>
}
