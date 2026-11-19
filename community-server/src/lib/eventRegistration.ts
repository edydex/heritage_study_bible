// Event registration (sign-up forms) shared by the admin editor, the public
// form and the server. Pure: no Node or database imports, so the browser can
// validate with exactly the same rules the server enforces.

import { csvFile } from './csv'

export const QUESTION_TYPES = ['text', 'paragraph', 'choice', 'choices', 'checkbox', 'number'] as const
export const PAYMENT_KINDS = ['zelle', 'cashapp', 'venmo', 'paypal', 'other'] as const
export const PHONE_MODES = ['off', 'optional', 'required'] as const
export const REGISTRATION_STATUSES = ['confirmed', 'waitlisted', 'cancelled'] as const

export type QuestionType = typeof QUESTION_TYPES[number]
export type PaymentKind = typeof PAYMENT_KINDS[number]
export type PhoneMode = typeof PHONE_MODES[number]
export type RegistrationStatus = typeof REGISTRATION_STATUSES[number]

export type RegistrationQuestion = {
  id: string
  label: string
  type: QuestionType
  required: boolean
  options: string[]
  help: string
}
export type PaymentMethod = { kind: PaymentKind; handle: string; label: string }
export type RegistrationSettings = {
  enabled: boolean
  opensAt: string | null
  closesAt: string | null
  /** Total people (not sign-ups) the event can take; null means unlimited. */
  capacity: number | null
  waitlist: boolean
  maxPartySize: number
  phone: PhoneMode
  /** Price per person in the smallest currency unit; null means free. */
  priceCents: number | null
  currency: string
  paymentInstructions: string
  paymentMethods: PaymentMethod[]
  questions: RegistrationQuestion[]
  confirmationMessage: string
}
export type AnswerValue = string | string[] | boolean | number
export type RegistrationAnswer = { id: string; label: string; type: QuestionType; value: AnswerValue }
export type RegistrationSubmission = {
  name: string
  email: string
  phone: string
  partySize: number
  answers: RegistrationAnswer[]
  language: string
}

export const LIMITS = {
  questions: 30, options: 30, optionLength: 120, label: 200, help: 400,
  paymentMethods: 6, handle: 120, methodLabel: 60, instructions: 2000, confirmation: 2000,
  name: 120, email: 254, phone: 40, text: 500, paragraph: 4000, maxPartySize: 20, capacity: 100000,
  priceCents: 10_000_000,
} as const

export class RegistrationError extends Error {
  status: number
  field?: string
  constructor(message: string, status = 400, field?: string) {
    super(message)
    this.name = 'RegistrationError'
    this.status = status
    this.field = field
  }
}

const fail = (message: string, field?: string): never => { throw new RegistrationError(message, 400, field) }
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function cleanText(value: unknown, max: number, what: string, required = false) {
  if (value === undefined || value === null) value = ''
  if (typeof value !== 'string') fail(`${what} must be text.`)
  // Strip control characters except line breaks and tabs.
  const text = (value as string).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  if (required && !text) fail(`${what} is required.`)
  if (text.length > max) fail(`${what} must be at most ${max} characters.`)
  return text
}

function optionalInteger(value: unknown, min: number, max: number, what: string) {
  if (value === undefined || value === null || value === '') return null
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isInteger(number) || number < min || number > max) {
    fail(`${what} must be a whole number from ${min} to ${max}.`)
  }
  return number as number
}

function optionalInstant(value: unknown, what: string) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(`${what} must be a valid date and time.`)
  return new Date(value as string).toISOString()
}

const CASHTAG = /^\$?[A-Za-z][A-Za-z0-9_-]{0,20}$/
const VENMO = /^@?[A-Za-z0-9_-]{2,30}$/
const PAYPAL = /^[A-Za-z0-9]{1,20}$/
const EMAIL = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
const PHONE = /^[+()\-.\s\d]{7,40}$/

export function validEmail(value: string) {
  return value.length <= LIMITS.email && EMAIL.test(value)
}

function normalizePaymentMethod(raw: unknown, index: number): PaymentMethod {
  const what = `Payment option ${index + 1}`
  if (!record(raw)) fail(`${what} is invalid.`)
  const method = raw as Record<string, unknown>
  if (!PAYMENT_KINDS.includes(method.kind as PaymentKind)) fail(`${what} has an unknown type.`)
  const kind = method.kind as PaymentKind
  const handle = cleanText(method.handle, LIMITS.handle, `${what} details`, true)
  const label = cleanText(method.label, LIMITS.methodLabel, `${what} name`)
  if (kind === 'cashapp' && !CASHTAG.test(handle)) fail(`${what}: enter a Cash App $cashtag such as $GraceChurch.`)
  if (kind === 'venmo' && !VENMO.test(handle)) fail(`${what}: enter a Venmo username such as @Grace-Church.`)
  if (kind === 'paypal' && !PAYPAL.test(handle)) fail(`${what}: enter the PayPal.Me name (letters and numbers only).`)
  if (kind === 'zelle' && !validEmail(handle) && !PHONE.test(handle)) fail(`${what}: enter the email address or phone number registered with Zelle.`)
  if (kind === 'other' && !label) fail(`${what}: give this payment option a name.`)
  return { kind, handle, label }
}

function normalizeQuestion(raw: unknown, index: number, seen: Set<string>): RegistrationQuestion {
  const what = `Question ${index + 1}`
  if (!record(raw)) fail(`${what} is invalid.`)
  const question = raw as Record<string, unknown>
  const id = typeof question.id === 'string' ? question.id : ''
  if (!/^[a-z0-9_-]{1,40}$/.test(id)) fail(`${what} has an invalid id.`)
  if (seen.has(id)) fail(`${what} repeats another question's id.`)
  seen.add(id)
  if (!QUESTION_TYPES.includes(question.type as QuestionType)) fail(`${what} has an unknown answer type.`)
  const type = question.type as QuestionType
  const label = cleanText(question.label, LIMITS.label, `${what} text`, true)
  const help = cleanText(question.help, LIMITS.help, `${what} help text`)
  let options: string[] = []
  if (type === 'choice' || type === 'choices') {
    if (!Array.isArray(question.options)) fail(`${what} needs answer choices.`)
    options = (question.options as unknown[]).map((option, optionIndex) =>
      cleanText(option, LIMITS.optionLength, `${what} choice ${optionIndex + 1}`)).filter(Boolean)
    if (options.length < 1) fail(`${what} needs at least one answer choice.`)
    if (options.length > LIMITS.options) fail(`${what} may have at most ${LIMITS.options} choices.`)
    if (new Set(options.map(option => option.toLocaleLowerCase())).size !== options.length) fail(`${what} repeats an answer choice.`)
  }
  return { id, label, type, required: question.required === true, options, help }
}

/** Normalize what organizers save on an event. Returns null when registration is off. */
export function normalizeRegistrationSettings(raw: unknown): RegistrationSettings | null {
  if (raw === undefined || raw === null) return null
  if (!record(raw)) fail('Registration settings are invalid.')
  const value = raw as Record<string, unknown>
  const questionsRaw = value.questions ?? []
  const methodsRaw = value.paymentMethods ?? []
  if (!Array.isArray(questionsRaw) || questionsRaw.length > LIMITS.questions) fail(`Use at most ${LIMITS.questions} questions.`)
  if (!Array.isArray(methodsRaw) || methodsRaw.length > LIMITS.paymentMethods) fail(`Use at most ${LIMITS.paymentMethods} payment options.`)
  const seen = new Set<string>()
  const opensAt = optionalInstant(value.opensAt, 'Registration opening time')
  const closesAt = optionalInstant(value.closesAt, 'Registration closing time')
  if (opensAt && closesAt && opensAt >= closesAt) fail('Registration must open before it closes.')
  const currency = typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency) ? value.currency : 'USD'
  const phone = PHONE_MODES.includes(value.phone as PhoneMode) ? value.phone as PhoneMode : 'optional'
  const settings: RegistrationSettings = {
    enabled: value.enabled === true,
    opensAt,
    closesAt,
    capacity: optionalInteger(value.capacity, 1, LIMITS.capacity, 'Capacity'),
    waitlist: value.waitlist === true,
    maxPartySize: optionalInteger(value.maxPartySize, 1, LIMITS.maxPartySize, 'People per sign-up') ?? 1,
    phone,
    priceCents: optionalInteger(value.priceCents, 0, LIMITS.priceCents, 'Price'),
    currency,
    paymentInstructions: cleanText(value.paymentInstructions, LIMITS.instructions, 'Payment instructions'),
    paymentMethods: (methodsRaw as unknown[]).map(normalizePaymentMethod),
    questions: (questionsRaw as unknown[]).map((question, index) => normalizeQuestion(question, index, seen)),
    confirmationMessage: cleanText(value.confirmationMessage, LIMITS.confirmation, 'Confirmation message'),
  }
  if (settings.priceCents === 0) settings.priceCents = null
  return settings
}

/** Payload field validator: true or a message. */
export function validateRegistrationField(value: unknown, recurrence?: unknown): true | string {
  try {
    const settings = normalizeRegistrationSettings(value)
    if (settings?.enabled && recurrence && recurrence !== 'none') {
      return 'Sign-up forms are available only for events that do not repeat. Create a separate event for each date.'
    }
    return true
  } catch (error) {
    return error instanceof RegistrationError ? error.message : 'Registration settings are invalid.'
  }
}

/** Stored values are trusted to have passed validation, but never crash a page on an old row. */
export function storedRegistrationSettings(raw: unknown): RegistrationSettings | null {
  try { return normalizeRegistrationSettings(raw) } catch { return null }
}

function answerFor(question: RegistrationQuestion, raw: unknown): AnswerValue | null {
  const field = question.id
  const empty = raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)
  if (question.type === 'checkbox') {
    if (raw !== undefined && raw !== null && typeof raw !== 'boolean') fail(`“${question.label}” is invalid.`, field)
    if (question.required && raw !== true) fail(`Please check “${question.label}”.`, field)
    return raw === true
  }
  if (empty) {
    if (question.required) fail(`Please answer “${question.label}”.`, field)
    return null
  }
  switch (question.type) {
    case 'text':
      return cleanText(raw, LIMITS.text, `“${question.label}”`, question.required)
    case 'paragraph':
      return cleanText(raw, LIMITS.paragraph, `“${question.label}”`, question.required)
    case 'number': {
      const number = typeof raw === 'string' ? Number(raw.trim()) : raw
      if (typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number) > 1e9) fail(`“${question.label}” must be a number.`, field)
      return number as number
    }
    case 'choice':
      if (typeof raw !== 'string' || !question.options.includes(raw)) fail(`Choose an answer for “${question.label}”.`, field)
      return raw as string
    case 'choices': {
      if (!Array.isArray(raw) || raw.some(item => typeof item !== 'string' || !question.options.includes(item))) {
        fail(`Choose answers for “${question.label}” from the list.`, field)
      }
      // Keep the organizer's order and drop repeats.
      return question.options.filter(option => (raw as string[]).includes(option))
    }
  }
  return null
}

/** Validate what a visitor submits against the event's current form. */
export function normalizeSubmission(settings: RegistrationSettings, raw: unknown): RegistrationSubmission {
  if (!record(raw)) fail('The sign-up form is invalid.')
  const body = raw as Record<string, unknown>
  const name = cleanText(body.name, LIMITS.name, 'Name', true)
  const email = cleanText(body.email, LIMITS.email, 'Email', true).toLowerCase()
  if (!validEmail(email)) fail('Enter a valid email address.', 'email')
  let phone = ''
  if (settings.phone !== 'off') {
    phone = cleanText(body.phone, LIMITS.phone, 'Phone', settings.phone === 'required')
    if (phone && !PHONE.test(phone)) fail('Enter a valid phone number.', 'phone')
  }
  const partySize = optionalInteger(body.partySize ?? 1, 1, settings.maxPartySize, 'Number of people') ?? 1
  const answersRaw = record(body.answers) ? body.answers as Record<string, unknown> : {}
  const answers: RegistrationAnswer[] = []
  for (const question of settings.questions) {
    const value = answerFor(question, answersRaw[question.id])
    if (value !== null) answers.push({ id: question.id, label: question.label, type: question.type, value })
  }
  const language = typeof body.language === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(body.language) ? body.language : 'en'
  return { name, email, phone, partySize, answers, language }
}

export type Availability = {
  state: 'open' | 'waitlist' | 'full' | 'not-open-yet' | 'closed' | 'cancelled'
  spotsLeft: number | null
  opensAt: string | null
  closesAt: string | null
}

/**
 * Whether a new sign-up of `partySize` people can be accepted right now.
 * Registration closes when the event starts unless organizers choose a time.
 */
export function registrationAvailability(settings: RegistrationSettings,
  event: { startsAt?: string | null; cancelled?: boolean | null },
  confirmedPeople: number, now: number = Date.now(), partySize = 1): Availability {
  const closesAt = settings.closesAt || event.startsAt || null
  const spotsLeft = settings.capacity === null ? null : Math.max(0, settings.capacity - confirmedPeople)
  const base = { spotsLeft, opensAt: settings.opensAt, closesAt }
  if (event.cancelled) return { ...base, state: 'cancelled' }
  if (settings.opensAt && now < Date.parse(settings.opensAt)) return { ...base, state: 'not-open-yet' }
  if (closesAt && now >= Date.parse(closesAt)) return { ...base, state: 'closed' }
  if (spotsLeft !== null && spotsLeft < partySize) return { ...base, state: settings.waitlist ? 'waitlist' : 'full' }
  return { ...base, state: 'open' }
}

export function formatMoney(cents: number, currency: string, locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

export function registrationReference(id: number | string) {
  return `R-${id}`
}

export type PaymentOption = { kind: PaymentKind; label: string; handle: string; url: string | null }
export type PaymentDetails = {
  amountCents: number
  amount: string
  currency: string
  reference: string
  instructions: string
  options: PaymentOption[]
}

const KIND_LABELS: Record<PaymentKind, string> = { zelle: 'Zelle', cashapp: 'Cash App', venmo: 'Venmo', paypal: 'PayPal', other: 'Other' }

/** Pay-by-link details. Nothing is charged here: people pay outside the app. */
export function paymentDetails(settings: RegistrationSettings, partySize: number, reference: string): PaymentDetails | null {
  if (!settings.priceCents) return null
  const amountCents = settings.priceCents * partySize
  const plain = (amountCents / 100).toFixed(2)
  const options = settings.paymentMethods.map(method => {
    const label = method.label || KIND_LABELS[method.kind]
    let url: string | null = null
    if (method.kind === 'cashapp') url = `https://cash.app/$${encodeURIComponent(method.handle.replace(/^\$/, ''))}/${plain}`
    if (method.kind === 'paypal') url = `https://paypal.me/${encodeURIComponent(method.handle)}/${plain}`
    if (method.kind === 'venmo') url = `https://venmo.com/u/${encodeURIComponent(method.handle.replace(/^@/, ''))}`
    if (method.kind === 'other' && /^https:\/\/[^\s]+$/i.test(method.handle)) url = method.handle
    return { kind: method.kind, label, handle: method.handle, url }
  })
  return { amountCents, amount: formatMoney(amountCents, settings.currency), currency: settings.currency, reference,
    instructions: settings.paymentInstructions, options }
}

/** What the public page may see: everything except internal limits. */
export function publicForm(settings: RegistrationSettings) {
  return {
    questions: settings.questions,
    phone: settings.phone,
    maxPartySize: settings.maxPartySize,
    price: settings.priceCents ? { cents: settings.priceCents, amount: formatMoney(settings.priceCents, settings.currency), currency: settings.currency } : null,
    hasPaymentOptions: settings.paymentMethods.length > 0 || Boolean(settings.paymentInstructions),
    waitlist: settings.waitlist,
  }
}

export function answerText(value: AnswerValue | undefined | null) {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join('; ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export type RegistrationRow = {
  id: number | string
  status: RegistrationStatus
  name: string
  email: string
  phone?: string | null
  partySize: number
  amountDueCents?: number | null
  paid?: boolean | null
  paidNote?: string | null
  answers?: RegistrationAnswer[] | null
  createdAt: string
}

export function registrationsCsv(settings: RegistrationSettings | null, rows: RegistrationRow[], currency = 'USD') {
  const questions = settings?.questions ?? []
  // Include answers to questions that were later removed from the form.
  const extra = new Map<string, string>()
  for (const row of rows) for (const answer of row.answers ?? []) {
    if (!questions.some(question => question.id === answer.id) && !extra.has(answer.id)) extra.set(answer.id, answer.label)
  }
  const columns = [...questions.map(question => ({ id: question.id, label: question.label })),
    ...[...extra].map(([id, label]) => ({ id, label }))]
  const header = ['Reference', 'Status', 'Name', 'Email', 'Phone', 'People', 'Amount due', 'Paid', 'Payment note', 'Registered at',
    ...columns.map(column => column.label)]
  const lines: unknown[][] = [header]
  for (const row of rows) {
    const answers = new Map((row.answers ?? []).map(answer => [answer.id, answer.value]))
    lines.push([
      registrationReference(row.id), row.status, row.name, row.email, row.phone || '', row.partySize,
      row.amountDueCents ? formatMoney(row.amountDueCents, currency) : '', row.paid ? 'Yes' : 'No', row.paidNote || '', row.createdAt,
      ...columns.map(column => answerText(answers.get(column.id))),
    ])
  }
  return csvFile(lines)
}

export function emptyRegistrationSettings(): RegistrationSettings {
  return { enabled: true, opensAt: null, closesAt: null, capacity: null, waitlist: false, maxPartySize: 1, phone: 'optional',
    priceCents: null, currency: 'USD', paymentInstructions: '', paymentMethods: [], questions: [], confirmationMessage: '' }
}
