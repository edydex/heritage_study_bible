'use client'

import { useEffect, useState } from 'react'
import type { PaymentDetails } from '../lib/eventRegistration'
import { PaymentBox } from './EventRegistrationForm'
import { publicText, usePublicLanguage } from './eventRegistrationText'

type Summary = {
  status: 'confirmed' | 'waitlisted' | 'cancelled'; reference: string; name: string; partySize: number
  event: { title: string; when: string; location: string | null }; canCancel: boolean; payment: PaymentDetails | null; paid: boolean
}

async function call(action: 'lookup' | 'cancel', token: string) {
  const response = await fetch(`/api/community/registrations/${action}`, { method: 'POST', credentials: 'omit', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || '')
  return value as Summary
}

// The private token lives in the URL fragment, which browsers never send to
// the server or in Referer headers; this page posts it explicitly.
export default function ManageRegistration() {
  const [language] = usePublicLanguage()
  const text = publicText(language)
  const [token, setToken] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const value = window.location.hash.slice(1)
    setToken(value)
    if (!value) { setError(text.manageInvalid); return }
    call('lookup', value).then(setSummary).catch(reason => setError(reason.message || text.manageInvalid))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancel = async () => {
    if (!window.confirm(text.confirmCancel)) return
    setBusy(true); setError('')
    try { setSummary(await call('cancel', token)) } catch (reason) { setError(reason instanceof Error && reason.message ? reason.message : text.submitFailed) }
    finally { setBusy(false) }
  }

  const status = summary ? { confirmed: text.statusConfirmed, waitlisted: text.statusWaitlisted, cancelled: text.statusCancelled }[summary.status] : ''
  return <section className="church-event church-signup">
    <h1>{text.manageTitle}</h1>
    {!summary && !error && <p role="status">{text.manageLoading}</p>}
    {error && <p role="alert" className="church-signup__field-error">{error}</p>}
    {summary && <article>
      <h2>{summary.event.title}</h2>
      <dl>
        <div><dt>{summary.event.when}</dt>{summary.event.location && <dd>{summary.event.location}</dd>}</div>
        <div><dt>{text.reference}</dt><dd>{summary.reference}</dd></div>
        <div><dt>{text.name}</dt><dd>{summary.name}</dd></div>
        <div><dt>{text.people}</dt><dd>{summary.partySize}</dd></div>
        <div><dt>{text.statusConfirmed === status ? '✓' : '•'}</dt><dd>{status}{summary.paid ? ` · ${text.paid}` : ''}</dd></div>
      </dl>
      {summary.status === 'cancelled' && <p>{text.cancelledDone}</p>}
      {summary.payment && !summary.paid && <PaymentBox payment={summary.payment} text={text} />}
      {summary.canCancel && <button type="button" disabled={busy} onClick={() => void cancel()}>{busy ? text.cancelling : text.cancel}</button>}
    </article>}
  </section>
}
