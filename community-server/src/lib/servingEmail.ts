import type { Payload } from 'payload'
import { registrationEmailEnabled } from './eventRegistrationEmail'
import { escapeEmailHTML } from './workspaceLanguage'

export const servingEmailEnabled = registrationEmailEnabled

type Text = {
  requestSubject: string; hello: string; request: string; button: string; linkNote: string; footer: string
  declineSubject: string; declined: string; noteLabel: string; open: string
}

// Add a language by adding one entry here and in servingText.ts.
const TEXT: Record<string, Text> = {
  en: {
    requestSubject: 'Can you serve on {date}?',
    hello: 'Hello {name},',
    request: 'You are on the serving schedule at {church}. Please let us know whether you can serve:',
    button: 'Accept or decline',
    linkNote: 'This private link shows all your serving dates. You can also tell us the dates you will be away. Please do not forward it.',
    footer: 'If this is not you, you can ignore this email.',
    declineSubject: '{name} cannot serve on {date}',
    declined: '{name} cannot serve as {role} at {service}.',
    noteLabel: 'Their note',
    open: 'Open the serving schedule',
  },
  ru: {
    requestSubject: 'Сможете послужить {date}?',
    hello: 'Здравствуйте, {name}!',
    request: 'Вы в графике служения церкви {church}. Пожалуйста, ответьте, сможете ли вы послужить:',
    button: 'Принять или отказаться',
    linkNote: 'По этой личной ссылке видны все ваши даты служения. Там же можно указать дни, когда вас не будет. Пожалуйста, не пересылайте её.',
    footer: 'Если это письмо пришло вам по ошибке, просто проигнорируйте его.',
    declineSubject: '{name} не сможет послужить {date}',
    declined: '{name} не сможет послужить ({role}) — {service}.',
    noteLabel: 'Комментарий',
    open: 'Открыть график служения',
  },
}

const textFor = (language: string) => TEXT[language.slice(0, 2)] || TEXT.en
const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match)
const e = escapeEmailHTML
const wrap = (body: string) => `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#17251f;max-width:560px">${body}</div>`
const button = (url: string, label: string) =>
  `<p><a href="${e(url)}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#315c49;color:#fff;font-weight:700;text-decoration:none">${e(label)}</a></p>`

export type ServingRequest = {
  language: string; churchName: string; name: string; dateLabel: string; url: string
  services: Array<{ title: string; when: string; location?: string | null; roles: string[] }>
}

export function servingRequestContent(request: ServingRequest) {
  const text = textFor(request.language)
  const values = { name: request.name, church: request.churchName, date: request.dateLabel }
  const lines = request.services.flatMap(service => [
    `${service.title} — ${service.when}${service.location ? ` (${service.location})` : ''}`,
    ...service.roles.map(role => `  • ${role}`),
  ])
  const plain = [fill(text.hello, values), '', fill(text.request, values), '', ...lines, '', `${text.button}: ${request.url}`, '',
    text.linkNote, '', text.footer, '', request.churchName].join('\n')
  const html = wrap(`<p>${e(fill(text.hello, values))}</p><p>${e(fill(text.request, values))}</p>
${request.services.map(service => `<p style="margin:12px 0 4px"><strong>${e(service.title)}</strong><br><span style="color:#65716b">${e(service.when)}${
    service.location ? ` · ${e(service.location)}` : ''}</span></p><ul style="margin:0 0 8px;padding-left:20px">${service.roles.map(role => `<li>${e(role)}</li>`).join('')}</ul>`).join('')}
${button(request.url, text.button)}
<p style="color:#65716b;font-size:13px">${e(text.linkNote)}</p><p style="color:#65716b;font-size:13px">${e(text.footer)}<br>${e(request.churchName)}</p>`)
  return { subject: fill(text.requestSubject, values), text: plain, html }
}

export type ServingDecline = {
  language: string; churchName: string; name: string; role: string; service: string; dateLabel: string; note?: string | null; url: string
}

export function servingDeclineContent(notice: ServingDecline) {
  const text = textFor(notice.language)
  const values = { name: notice.name, role: notice.role, service: notice.service, date: notice.dateLabel }
  const plain = [fill(text.declined, values), ...(notice.note ? ['', `${text.noteLabel}: ${notice.note}`] : []), '',
    `${text.open}: ${notice.url}`, '', notice.churchName].join('\n')
  const html = wrap(`<p>${e(fill(text.declined, values))}</p>${notice.note ? `<p><span style="color:#65716b">${e(text.noteLabel)}:</span> ${e(notice.note)}</p>` : ''}
${button(notice.url, text.open)}<p style="color:#65716b;font-size:13px">${e(notice.churchName)}</p>`)
  return { subject: fill(text.declineSubject, values), text: plain, html }
}

/** Never throws: a failed email must not undo a saved schedule. */
export async function sendServingEmail(payload: Payload, to: string, content: { subject: string; text: string; html: string }) {
  if (!servingEmailEnabled() || !to) return false
  try {
    await payload.sendEmail({ to, ...content })
    return true
  } catch (error) {
    payload.logger.error({ err: error }, 'Serving email failed')
    return false
  }
}
