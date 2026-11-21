import type { Payload } from 'payload'
import { communityAuthEnabled } from './publicConfig'
import { escapeEmailHTML } from './workspaceLanguage'
import type { PaymentDetails, RegistrationStatus } from './eventRegistration'

export function registrationEmailEnabled() {
  return communityAuthEnabled && Boolean(process.env.SMTP_HOST)
}

type EmailText = {
  confirmedSubject: string; waitlistedSubject: string; promotedSubject: string; cancelledSubject: string
  hello: string; confirmed: string; waitlisted: string; promoted: string; cancelled: string
  when: string; where: string; people: string; reference: string
  pay: string; payNote: string; manage: string; manageLink: string; ignore: string
}

// Add a language by adding one entry; the form sends the visitor's language.
const TEXT: Record<string, EmailText> = {
  en: {
    confirmedSubject: 'You are registered: {event}', waitlistedSubject: 'You are on the waitlist: {event}',
    promotedSubject: 'A spot opened up: {event}', cancelledSubject: 'Registration cancelled: {event}',
    hello: 'Hello {name},',
    confirmed: 'Thank you for signing up for {event}.',
    waitlisted: '{event} is full right now, so you are on the waitlist. We will email you if a spot opens up.',
    promoted: 'Good news: a spot opened up and you are now registered for {event}.',
    cancelled: 'Your registration for {event} has been cancelled.',
    when: 'When', where: 'Where', people: 'People', reference: 'Reference',
    pay: 'Amount due: {amount}', payNote: 'Please include {reference} in the payment note.',
    manage: 'Need to cancel? Use this private link:', manageLink: 'Manage my registration',
    ignore: 'If you did not sign up, you can ignore this email.',
  },
  ru: {
    confirmedSubject: 'Вы зарегистрированы: {event}', waitlistedSubject: 'Вы в листе ожидания: {event}',
    promotedSubject: 'Освободилось место: {event}', cancelledSubject: 'Регистрация отменена: {event}',
    hello: 'Здравствуйте, {name}!',
    confirmed: 'Спасибо за регистрацию на «{event}».',
    waitlisted: 'Сейчас на «{event}» нет мест, поэтому вы в листе ожидания. Мы напишем вам, если место освободится.',
    promoted: 'Хорошая новость: место освободилось, и теперь вы зарегистрированы на «{event}».',
    cancelled: 'Ваша регистрация на «{event}» отменена.',
    when: 'Когда', where: 'Где', people: 'Человек', reference: 'Номер',
    pay: 'К оплате: {amount}', payNote: 'Пожалуйста, укажите {reference} в комментарии к платежу.',
    manage: 'Нужно отменить? Воспользуйтесь личной ссылкой:', manageLink: 'Управлять регистрацией',
    ignore: 'Если вы не регистрировались, просто проигнорируйте это письмо.',
  },
}

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match)
}

export type RegistrationEmail = {
  kind: 'confirmed' | 'waitlisted' | 'promoted' | 'cancelled'
  language: string
  churchName: string
  eventTitle: string
  when: string
  location?: string | null
  name: string
  partySize: number
  reference: string
  payment: PaymentDetails | null
  confirmationMessage?: string
  manageUrl?: string | null
}

export function registrationEmailContent(email: RegistrationEmail) {
  const text = TEXT[email.language.slice(0, 2)] || TEXT.en
  const values = { event: email.eventTitle, name: email.name, reference: email.reference, amount: email.payment?.amount || '' }
  const subjects: Record<RegistrationEmail['kind'], string> = {
    confirmed: text.confirmedSubject, waitlisted: text.waitlistedSubject, promoted: text.promotedSubject, cancelled: text.cancelledSubject,
  }
  const intro = fill(text[email.kind], values)
  const details: Array<[string, string]> = [[text.when, email.when]]
  if (email.location) details.push([text.where, email.location])
  details.push([text.people, String(email.partySize)], [text.reference, email.reference])
  const showPayment = email.payment && (email.kind === 'confirmed' || email.kind === 'promoted')
  const paymentLines = showPayment && email.payment ? [
    fill(text.pay, values),
    ...email.payment.options.map(option => `${option.label}: ${option.handle}${option.url ? ` (${option.url})` : ''}`),
    ...(email.payment.instructions ? [email.payment.instructions] : []),
    fill(text.payNote, values),
  ] : []
  const message = email.kind !== 'cancelled' && email.confirmationMessage ? email.confirmationMessage : ''
  const manage = email.manageUrl && email.kind !== 'cancelled' ? [text.manage, email.manageUrl] : []

  const plain = [fill(text.hello, values), '', intro, '', ...details.map(([label, value]) => `${label}: ${value}`),
    ...(paymentLines.length ? ['', ...paymentLines] : []), ...(message ? ['', message] : []),
    ...(manage.length ? ['', ...manage] : []), '', text.ignore, '', email.churchName].join('\n')

  const e = escapeEmailHTML
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#17251f;max-width:560px">
<p>${e(fill(text.hello, values))}</p><p>${e(intro)}</p>
<table style="border-collapse:collapse">${details.map(([label, value]) =>
    `<tr><td style="padding:2px 12px 2px 0;color:#65716b">${e(label)}</td><td style="padding:2px 0">${e(value)}</td></tr>`).join('')}</table>
${paymentLines.length && email.payment ? `<p><strong>${e(fill(text.pay, values))}</strong></p><ul>${email.payment.options.map(option =>
    `<li>${e(option.label)}: ${option.url ? `<a href="${e(option.url)}">${e(option.handle)}</a>` : e(option.handle)}</li>`).join('')}</ul>${
    email.payment.instructions ? `<p style="white-space:pre-wrap">${e(email.payment.instructions)}</p>` : ''}<p>${e(fill(text.payNote, values))}</p>` : ''}
${message ? `<p style="white-space:pre-wrap">${e(message)}</p>` : ''}
${email.manageUrl && email.kind !== 'cancelled' ? `<p>${e(text.manage)} <a href="${e(email.manageUrl)}">${e(text.manageLink)}</a></p>` : ''}
<p style="color:#65716b;font-size:13px">${e(text.ignore)}</p><p style="color:#65716b;font-size:13px">${e(email.churchName)}</p></div>`
  return { subject: fill(subjects[email.kind], values), text: plain, html }
}

/** Never throws: a failed email must not undo a saved registration. */
export async function sendRegistrationEmail(payload: Payload, to: string, email: RegistrationEmail) {
  if (!registrationEmailEnabled()) return false
  try {
    const content = registrationEmailContent(email)
    await payload.sendEmail({ to, ...content })
    return true
  } catch (error) {
    payload.logger.error({ err: error }, 'Registration email failed')
    return false
  }
}
