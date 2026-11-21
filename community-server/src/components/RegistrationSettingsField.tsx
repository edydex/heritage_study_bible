'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import type { JSONFieldClientProps } from 'payload'
import { useMemo } from 'react'
import {
  emptyRegistrationSettings, LIMITS, PAYMENT_KINDS, QUESTION_TYPES, validateRegistrationField,
  type PaymentKind, type QuestionType, type RegistrationQuestion, type RegistrationSettings,
} from '../lib/eventRegistration'
import { useWorkspaceText } from './useWorkspaceText'

const QUESTION_LABELS: Record<QuestionType, string> = {
  text: 'Short answer', paragraph: 'Long answer', choice: 'One choice', choices: 'Several choices', checkbox: 'Checkbox (yes/no)', number: 'Number',
}
const PAYMENT_LABELS: Record<PaymentKind, string> = { zelle: 'Zelle', cashapp: 'Cash App', venmo: 'Venmo', paypal: 'PayPal', other: 'Other' }
const PAYMENT_HINTS: Record<PaymentKind, string> = {
  zelle: 'Email or phone registered with Zelle', cashapp: '$cashtag', venmo: '@username', paypal: 'PayPal.Me name', other: 'Details or an https:// link',
}

// datetime-local works in the browser's time zone; store an exact instant.
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
const fromLocalInput = (value: string) => value ? new Date(value).toISOString() : null
const newId = () => `q_${Math.random().toString(36).slice(2, 10)}`

export default function RegistrationSettingsField({ path, readOnly }: JSONFieldClientProps) {
  const t = useWorkspaceText()
  const { value, setValue } = useField<RegistrationSettings | null>({ path })
  const recurrence = useFormFields(([fields]) => fields.recurrence?.value) as string | undefined
  const settings = value && typeof value === 'object' ? { ...emptyRegistrationSettings(), ...value } : null
  const problem = useMemo(() => {
    const result = validateRegistrationField(value, recurrence)
    return result === true ? '' : result
  }, [value, recurrence])

  const update = (patch: Partial<RegistrationSettings>) => setValue({ ...(settings || emptyRegistrationSettings()), ...patch })
  const updateQuestion = (index: number, patch: Partial<RegistrationQuestion>) =>
    update({ questions: settings!.questions.map((question, i) => i === index ? { ...question, ...patch } : question) })
  const moveQuestion = (index: number, offset: number) => {
    const questions = [...settings!.questions]
    const [item] = questions.splice(index, 1)
    questions.splice(index + offset, 0, item)
    update({ questions })
  }

  return <div className="field-type heritage-registration-settings">
    <h3>{t('Sign-up form')}</h3>
    <label className="heritage-registration-settings__toggle">
      <input type="checkbox" disabled={readOnly} checked={Boolean(settings?.enabled)}
        onChange={event => event.target.checked ? update({ enabled: true }) : setValue(settings ? { ...settings, enabled: false } : null)} />
      {' '}{t('Take sign-ups on this event’s page')}
    </label>
    {settings?.enabled && recurrence && recurrence !== 'none' && <p className="heritage-registration-settings__error">
      {t('Sign-up forms work only on events that do not repeat. Create a separate event for each date.')}</p>}
    {settings?.enabled && <fieldset disabled={readOnly} className="heritage-registration-settings__body">
      <div className="heritage-registration-settings__grid">
        <label>{t('Opens (optional)')}<input type="datetime-local" value={toLocalInput(settings.opensAt)} onChange={event => update({ opensAt: fromLocalInput(event.target.value) })} /></label>
        <label>{t('Closes (optional — default: when the event starts)')}<input type="datetime-local" value={toLocalInput(settings.closesAt)} onChange={event => update({ closesAt: fromLocalInput(event.target.value) })} /></label>
        <label>{t('Capacity — total people (blank = no limit)')}<input type="number" min={1} max={LIMITS.capacity} value={settings.capacity ?? ''}
          onChange={event => update({ capacity: event.target.value ? Number(event.target.value) : null })} /></label>
        <label>{t('Most people per sign-up')}<input type="number" min={1} max={LIMITS.maxPartySize} value={settings.maxPartySize}
          onChange={event => update({ maxPartySize: Number(event.target.value) || 1 })} /></label>
        <label>{t('Phone number')}<select value={settings.phone} onChange={event => update({ phone: event.target.value as RegistrationSettings['phone'] })}>
          <option value="off">{t('Do not ask')}</option><option value="optional">{t('Optional')}</option><option value="required">{t('Required')}</option>
        </select></label>
        <label className="heritage-registration-settings__inline"><input type="checkbox" checked={settings.waitlist} onChange={event => update({ waitlist: event.target.checked })} />
          {' '}{t('Keep a waitlist when full')}</label>
      </div>

      <h4>{t('Questions')}</h4>
      <p className="heritage-registration-settings__hint">{t('Name and email are always asked. Add anything else you need, such as T-shirt size or allergies.')}</p>
      {settings.questions.map((question, index) => <div key={question.id} className="heritage-registration-settings__question">
        <div className="heritage-registration-settings__row">
          <input aria-label={t('Question')} placeholder={t('Question')} value={question.label} maxLength={LIMITS.label}
            onChange={event => updateQuestion(index, { label: event.target.value })} />
          <select aria-label={t('Answer type')} value={question.type} onChange={event => updateQuestion(index, { type: event.target.value as QuestionType })}>
            {QUESTION_TYPES.map(type => <option key={type} value={type}>{t(QUESTION_LABELS[type])}</option>)}
          </select>
          <label className="heritage-registration-settings__inline"><input type="checkbox" checked={question.required}
            onChange={event => updateQuestion(index, { required: event.target.checked })} />{' '}{t('Required')}</label>
          <button type="button" aria-label={t('Move up')} disabled={index === 0} onClick={() => moveQuestion(index, -1)}>↑</button>
          <button type="button" aria-label={t('Move down')} disabled={index === settings.questions.length - 1} onClick={() => moveQuestion(index, 1)}>↓</button>
          <button type="button" onClick={() => update({ questions: settings.questions.filter((_, i) => i !== index) })}>{t('Remove')}</button>
        </div>
        {(question.type === 'choice' || question.type === 'choices') && <label>{t('Choices — one per line')}
          <textarea rows={3} value={question.options.join('\n')} onChange={event => updateQuestion(index, { options: event.target.value.split('\n') })} /></label>}
        <input aria-label={t('Help text (optional)')} placeholder={t('Help text (optional)')} value={question.help} maxLength={LIMITS.help}
          onChange={event => updateQuestion(index, { help: event.target.value })} />
      </div>)}
      {settings.questions.length < LIMITS.questions && <button type="button" onClick={() =>
        update({ questions: [...settings.questions, { id: newId(), label: '', type: 'text', required: false, options: [], help: '' }] })}>{t('Add question')}</button>}

      <h4>{t('Price and payment')}</h4>
      <p className="heritage-registration-settings__hint">{t('The app does not take payments. People see how to pay you directly and a reference to put in the payment note; you mark each sign-up as paid.')}</p>
      <div className="heritage-registration-settings__grid">
        <label>{t('Price per person (blank = free)')}<input type="number" min={0} step="0.01" value={settings.priceCents ? settings.priceCents / 100 : ''}
          onChange={event => update({ priceCents: event.target.value ? Math.round(Number(event.target.value) * 100) : null })} /></label>
        <label>{t('Currency')}<input value={settings.currency} maxLength={3} onChange={event => update({ currency: event.target.value.toUpperCase() })} /></label>
      </div>
      {settings.paymentMethods.map((method, index) => <div key={index} className="heritage-registration-settings__row">
        <select aria-label={t('Payment type')} value={method.kind} onChange={event => update({ paymentMethods: settings.paymentMethods.map((item, i) => i === index ? { ...item, kind: event.target.value as PaymentKind } : item) })}>
          {PAYMENT_KINDS.map(kind => <option key={kind} value={kind}>{PAYMENT_LABELS[kind]}</option>)}
        </select>
        <input aria-label={t(PAYMENT_HINTS[method.kind])} placeholder={t(PAYMENT_HINTS[method.kind])} value={method.handle} maxLength={LIMITS.handle}
          onChange={event => update({ paymentMethods: settings.paymentMethods.map((item, i) => i === index ? { ...item, handle: event.target.value } : item) })} />
        <input aria-label={t('Name shown (optional)')} placeholder={method.kind === 'other' ? t('Name, such as “Cash at the door”') : t('Name shown (optional)')}
          value={method.label} maxLength={LIMITS.methodLabel}
          onChange={event => update({ paymentMethods: settings.paymentMethods.map((item, i) => i === index ? { ...item, label: event.target.value } : item) })} />
        <button type="button" onClick={() => update({ paymentMethods: settings.paymentMethods.filter((_, i) => i !== index) })}>{t('Remove')}</button>
      </div>)}
      {settings.paymentMethods.length < LIMITS.paymentMethods && <button type="button"
        onClick={() => update({ paymentMethods: [...settings.paymentMethods, { kind: 'zelle', handle: '', label: '' }] })}>{t('Add payment option')}</button>}
      <label>{t('Payment instructions (optional)')}<textarea rows={3} maxLength={LIMITS.instructions} value={settings.paymentInstructions}
        onChange={event => update({ paymentInstructions: event.target.value })} /></label>

      <h4>{t('After signing up')}</h4>
      <label>{t('Message shown and emailed after sign-up (optional)')}<textarea rows={3} maxLength={LIMITS.confirmation} value={settings.confirmationMessage}
        onChange={event => update({ confirmationMessage: event.target.value })} /></label>
    </fieldset>}
    {problem && settings?.enabled && <p className="heritage-registration-settings__error" role="alert">{problem}</p>}
  </div>
}
