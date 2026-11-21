'use client'

import { useEffect, useState, type FormEvent } from 'react'
import type { Availability, PaymentDetails, RegistrationQuestion } from '../lib/eventRegistration'
import { publicText, usePublicLanguage, type PublicText } from './eventRegistrationText'

type Form = {
  questions: RegistrationQuestion[]
  phone: 'off' | 'optional' | 'required'
  maxPartySize: number
  price: { cents: number; amount: string; currency: string } | null
  hasPaymentOptions: boolean
  waitlist: boolean
}
type Loaded = { form: Form; availability: Availability; emailEnabled: boolean; prefill: { name: string; email: string } | null }
type Result = {
  status: 'confirmed' | 'waitlisted'; reference: string; name: string; partySize: number; emailSent: boolean
  payment: PaymentDetails | null; confirmationMessage: string; manageUrl: string
}
type Answer = string | string[] | boolean

export function PaymentBox({ payment, text }: { payment: PaymentDetails; text: PublicText }) {
  return <div className="church-signup__payment">
    <p className="church-signup__amount">{text.amountDue(payment.amount)}</p>
    {payment.options.length > 0 && <ul>{payment.options.map((option, index) => <li key={index}>
      <strong>{option.label}</strong>{' '}
      {option.url ? <a href={option.url} target="_blank" rel="noopener noreferrer">{option.handle}</a> : <span>{option.handle}</span>}
      {option.kind === 'zelle' && <small> — {text.zelleHint}</small>}
      {option.kind === 'venmo' && <small> — {text.enterAmount(payment.amount)}</small>}
    </li>)}</ul>}
    {payment.instructions && <p className="church-signup__instructions">{payment.instructions}</p>}
    <p>{text.paymentNote(payment.reference)}</p>
  </div>
}

export default function EventRegistrationForm({ eventId }: { eventId: string | number }) {
  const [language, setLanguage, languages] = usePublicLanguage()
  const text = publicText(language)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [missing, setMissing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [partySize, setPartySize] = useState(1)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; field?: string } | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/community/calendar/events/${encodeURIComponent(String(eventId))}/registration`, { cache: 'no-store', credentials: 'same-origin' })
      .then(async response => {
        if (!active) return
        if (response.status === 404) { setMissing(true); return }
        const value = await response.json()
        if (!response.ok) throw new Error(value.error)
        setLoaded(value)
        if (value.prefill) { setName(current => current || value.prefill.name); setEmail(current => current || value.prefill.email) }
      })
      .catch(() => { if (active) setError({ message: text.loadFailed }) })
    return () => { active = false }
    // The form does not depend on the display language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (missing) return null
  if (!loaded) return error ? <p role="alert">{error.message}</p> : null
  const { form, availability } = loaded
  const accepting = availability.state === 'open' || availability.state === 'waitlist'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(null)
    try {
      const response = await fetch(`/api/community/calendar/events/${encodeURIComponent(String(eventId))}/registration`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, partySize, answers, language, website }),
      })
      const value = await response.json()
      if (!response.ok) { setError({ message: value.error || text.submitFailed, field: value.field }); return }
      setResult(value)
    } catch {
      setError({ message: text.submitFailed })
    } finally { setBusy(false) }
  }

  const languageSwitch = languages.length > 1 && <p className="church-signup__languages">{languages.map(code =>
    <button key={code} type="button" aria-pressed={code === language} onClick={() => setLanguage(code)}>{publicText(code).languageName}</button>)}</p>

  if (result) return <section className="church-signup" aria-live="polite">
    {languageSwitch}
    <h2>{result.status === 'waitlisted' ? text.waitlistedTitle : text.confirmedTitle}</h2>
    <p>{result.status === 'waitlisted' ? text.waitlistedBody : text.confirmedBody(result.name, result.partySize)}</p>
    <p>{text.reference}: <strong>{result.reference}</strong></p>
    {result.payment && <PaymentBox payment={result.payment} text={text} />}
    {result.confirmationMessage && <p className="church-signup__instructions">{result.confirmationMessage}</p>}
    <p>{result.emailSent ? text.emailSent : text.noEmail}</p>
    {!result.emailSent && <p><a href={result.manageUrl}>{text.saveLink}</a></p>}
  </section>

  const fieldError = (field: string) => error?.field === field ? <span className="church-signup__field-error" role="alert">{error.message}</span> : null
  const setAnswer = (id: string, value: Answer) => setAnswers(current => ({ ...current, [id]: value }))

  return <section className="church-signup" aria-labelledby="church-signup-title">
    {languageSwitch}
    <h2 id="church-signup-title">{text.title}</h2>
    {form.price && <p className="church-signup__price">{text.price(form.price.amount)}</p>}
    {availability.spotsLeft !== null && accepting && availability.state === 'open' && <p>{text.spotsLeft(availability.spotsLeft)}</p>}
    {availability.state === 'waitlist' && <p className="church-signup__notice">{text.waitlistNotice}</p>}
    {availability.state === 'full' && <p className="church-signup__notice">{text.full}</p>}
    {availability.state === 'closed' && <p className="church-signup__notice">{text.closed}</p>}
    {availability.state === 'cancelled' && <p className="church-signup__notice">{text.cancelled}</p>}
    {availability.state === 'not-open-yet' && availability.opensAt && <p className="church-signup__notice">{text.opensAt(new Date(availability.opensAt).toLocaleString(language))}</p>}
    {accepting && <form onSubmit={submit} noValidate={false}>
      <label>{text.name}<input required autoComplete="name" maxLength={120} value={name} onChange={event => setName(event.target.value)} />{fieldError('name')}</label>
      <label>{text.email}<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />{fieldError('email')}</label>
      {form.phone !== 'off' && <label>{form.phone === 'required' ? text.phone : text.phoneOptional}
        <input type="tel" autoComplete="tel" required={form.phone === 'required'} maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} />{fieldError('phone')}</label>}
      {form.maxPartySize > 1 && <label>{text.partySize}
        <input type="number" min={1} max={form.maxPartySize} required value={partySize} onChange={event => setPartySize(Math.max(1, Math.min(form.maxPartySize, Number(event.target.value) || 1)))} />
        {fieldError('partySize')}</label>}
      {form.questions.map(question => {
        const label = <>{question.label}{question.required && question.type !== 'checkbox' ? ' *' : ''}</>
        const help = question.help ? <small>{question.help}</small> : null
        const value = answers[question.id]
        if (question.type === 'checkbox') return <label key={question.id} className="church-signup__check">
          <input type="checkbox" required={question.required} checked={value === true} onChange={event => setAnswer(question.id, event.target.checked)} />
          <span>{question.label}{help}</span>{fieldError(question.id)}</label>
        if (question.type === 'choice') return <fieldset key={question.id}><legend>{label}</legend>{help}
          {question.options.map(option => <label key={option} className="church-signup__check">
            <input type="radio" name={question.id} value={option} required={question.required} checked={value === option} onChange={() => setAnswer(question.id, option)} /><span>{option}</span></label>)}
          {fieldError(question.id)}</fieldset>
        if (question.type === 'choices') {
          const selected = Array.isArray(value) ? value : []
          return <fieldset key={question.id}><legend>{label}</legend>{help}
            {question.options.map(option => <label key={option} className="church-signup__check">
              <input type="checkbox" value={option} checked={selected.includes(option)}
                onChange={event => setAnswer(question.id, event.target.checked ? [...selected, option] : selected.filter(item => item !== option))} /><span>{option}</span></label>)}
            {fieldError(question.id)}</fieldset>
        }
        if (question.type === 'paragraph') return <label key={question.id}>{label}{help}
          <textarea rows={4} required={question.required} maxLength={4000} value={typeof value === 'string' ? value : ''} onChange={event => setAnswer(question.id, event.target.value)} />{fieldError(question.id)}</label>
        return <label key={question.id}>{label}{help}
          <input type={question.type === 'number' ? 'number' : 'text'} required={question.required} maxLength={500}
            value={typeof value === 'string' ? value : ''} onChange={event => setAnswer(question.id, event.target.value)} />{fieldError(question.id)}</label>
      })}
      {/* Spam trap: hidden from people and screen readers. */}
      <div className="church-signup__trap" aria-hidden="true">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label>
      </div>
      {error && !error.field && <p role="alert" className="church-signup__field-error">{error.message}</p>}
      {error?.field && !['name', 'email', 'phone', 'partySize', ...form.questions.map(question => question.id)].includes(error.field) &&
        <p role="alert" className="church-signup__field-error">{error.message}</p>}
      <button type="submit" disabled={busy}>{busy ? text.sending : availability.state === 'waitlist' ? text.joinWaitlist : text.submit}</button>
      {form.price && form.hasPaymentOptions && <p><small>{text.payLater}</small></p>}
    </form>}
  </section>
}
