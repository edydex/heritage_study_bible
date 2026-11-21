'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { answerText, formatMoney, registrationReference, type RegistrationAnswer, type RegistrationStatus } from '../lib/eventRegistration'
import { useWorkspaceText } from './useWorkspaceText'

type Row = {
  id: number; status: RegistrationStatus; name: string; email: string; phone?: string | null; partySize: number
  amountDueCents?: number | null; paid?: boolean | null; paidNote?: string | null; answers?: RegistrationAnswer[] | null; createdAt: string
}

const STATUS_LABELS: Record<RegistrationStatus, string> = { confirmed: 'Confirmed', waitlisted: 'Waitlist', cancelled: 'Cancelled' }

// Organizer view on the event's edit page: who signed up, who paid, export.
export default function EventRegistrationsPanel() {
  const t = useWorkspaceText()
  const { id } = useDocumentInfo()
  const settings = useFormFields(([fields]) => fields.registration?.value) as { enabled?: boolean; capacity?: number | null; currency?: string } | null
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      const response = await fetch(`/api/event-registrations?where[event][equals]=${encodeURIComponent(String(id))}&limit=1000&sort=createdAt&depth=0`, { credentials: 'same-origin', cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.errors?.[0]?.message || 'Could not load sign-ups.')
      setRows(result.docs)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load sign-ups.') }
  }, [id])
  useEffect(() => { void load() }, [load])

  const change = async (row: Row, data: Partial<Row>) => {
    setRows(current => current?.map(item => item.id === row.id ? { ...item, ...data } : item) ?? null)
    const response = await fetch(`/api/event-registrations/${row.id}`, { method: 'PATCH', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!response.ok) { setError(t('Could not save. Reloading the list.')); void load() }
  }

  if (!id || !settings?.enabled) return null
  const currency = settings.currency || 'USD'
  const active = rows?.filter(row => row.status !== 'cancelled') ?? []
  const confirmedPeople = active.filter(row => row.status === 'confirmed').reduce((sum, row) => sum + Number(row.partySize), 0)
  const waitlistPeople = active.filter(row => row.status === 'waitlisted').reduce((sum, row) => sum + Number(row.partySize), 0)
  const dueCents = active.filter(row => row.status === 'confirmed' && !row.paid).reduce((sum, row) => sum + Number(row.amountDueCents || 0), 0)

  return <div className="field-type heritage-registrations-panel">
    <h3>{t('Sign-ups')}</h3>
    <p>
      {t('{count} people registered', { count: confirmedPeople })}{settings.capacity ? ` / ${settings.capacity}` : ''}
      {waitlistPeople ? ` · ${t('{count} on the waitlist', { count: waitlistPeople })}` : ''}
      {dueCents ? ` · ${t('{amount} not yet marked paid', { amount: formatMoney(dueCents, currency) })}` : ''}
    </p>
    <p className="heritage-registrations-panel__actions">
      <a href={`/api/community/calendar/events/${encodeURIComponent(String(id))}/registrations.csv`}>{t('Download spreadsheet (CSV)')}</a>
      {' · '}<a href={`/events/${encodeURIComponent(String(id))}`} target="_blank" rel="noopener noreferrer">{t('Open the public sign-up page')}</a>
      {' · '}<button type="button" onClick={() => void load()}>{t('Refresh')}</button>
    </p>
    {error && <p role="alert" className="heritage-registration-settings__error">{error}</p>}
    {rows === null && !error && <p>{t('Loading…')}</p>}
    {rows?.length === 0 && <p>{t('No one has signed up yet.')}</p>}
    {rows && rows.length > 0 && <div className="heritage-registrations-panel__table"><table>
      <thead><tr><th>{t('Reference')}</th><th>{t('Name')}</th><th>{t('Contact')}</th><th>{t('People')}</th><th>{t('Status')}</th><th>{t('Due')}</th><th>{t('Paid')}</th><th>{t('Payment note')}</th></tr></thead>
      <tbody>{rows.map(row => <Fragment key={row.id}>
        <tr className={row.status === 'cancelled' ? 'is-cancelled' : undefined}>
          <td><button type="button" className="heritage-registrations-panel__link" onClick={() => setOpen(open === row.id ? null : row.id)}
            aria-expanded={open === row.id}>{registrationReference(row.id)}</button></td>
          <td>{row.name}</td>
          <td><a href={`mailto:${row.email}`}>{row.email}</a>{row.phone ? <><br />{row.phone}</> : null}</td>
          <td>{row.partySize}</td>
          <td><select aria-label={t('Status')} value={row.status} onChange={event => void change(row, { status: event.target.value as RegistrationStatus })}>
            {(Object.keys(STATUS_LABELS) as RegistrationStatus[]).map(status => <option key={status} value={status}>{t(STATUS_LABELS[status])}</option>)}
          </select></td>
          <td>{row.amountDueCents ? formatMoney(row.amountDueCents, currency) : '—'}</td>
          <td><input type="checkbox" aria-label={t('Paid')} checked={Boolean(row.paid)} onChange={event => void change(row, { paid: event.target.checked })} /></td>
          <td><input aria-label={t('Payment note')} defaultValue={row.paidNote || ''} maxLength={200}
            onBlur={event => { if (event.target.value !== (row.paidNote || '')) void change(row, { paidNote: event.target.value }) }} /></td>
        </tr>
        {open === row.id && <tr className="heritage-registrations-panel__answers"><td colSpan={8}>
          {(row.answers ?? []).length ? <dl>{row.answers!.map(answer => <div key={answer.id}><dt>{answer.label}</dt><dd>{answerText(answer.value)}</dd></div>)}</dl>
            : <p>{t('No answers to extra questions.')}</p>}
          <small>{t('Signed up {date}', { date: new Date(row.createdAt).toLocaleString() })}</small>
        </td></tr>}
      </Fragment>)}</tbody>
    </table></div>}
  </div>
}
