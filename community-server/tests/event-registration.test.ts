import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  normalizeRegistrationSettings, normalizeSubmission, paymentDetails, publicForm, registrationAvailability, registrationsCsv,
  RegistrationError, validateRegistrationField, type RegistrationSettings,
} from '../src/lib/eventRegistration'
import { registrationEmailContent } from '../src/lib/eventRegistrationEmail'
import { migrations } from '../src/migrations'

const base = {
  enabled: true, capacity: 10, waitlist: true, maxPartySize: 4, phone: 'optional', priceCents: 2500, currency: 'USD',
  paymentMethods: [
    { kind: 'zelle', handle: 'treasurer@example.church' }, { kind: 'cashapp', handle: '$GraceChurch' },
    { kind: 'venmo', handle: '@Grace-Church' }, { kind: 'paypal', handle: 'gracechurch' },
    { kind: 'other', handle: 'Cash or check at the welcome desk', label: 'In person' },
  ],
  questions: [
    { id: 'size', label: 'T-shirt size', type: 'choice', required: true, options: ['S', 'M', 'L'] },
    { id: 'meals', label: 'Meals', type: 'choices', options: ['Friday dinner', 'Saturday lunch'] },
    { id: 'allergies', label: 'Allergies', type: 'paragraph' },
    { id: 'photo', label: 'Photo consent', type: 'checkbox', required: true },
    { id: 'age', label: 'Age', type: 'number' },
  ],
}
const settings = normalizeRegistrationSettings(base) as RegistrationSettings

test('organizer settings normalize and reject unsafe or inconsistent values', () => {
  assert.equal(normalizeRegistrationSettings(null), null)
  assert.equal(settings.questions[0].options.length, 3)
  assert.equal(settings.paymentMethods[1].handle, '$GraceChurch')
  assert.equal(normalizeRegistrationSettings({ ...base, priceCents: 0 })?.priceCents, null)
  assert.throws(() => normalizeRegistrationSettings({ ...base, capacity: 0 }), RegistrationError)
  assert.throws(() => normalizeRegistrationSettings({ ...base, paymentMethods: [{ kind: 'cashapp', handle: 'not a tag!' }] }), /cashtag/)
  assert.throws(() => normalizeRegistrationSettings({ ...base, paymentMethods: [{ kind: 'zelle', handle: 'nope' }] }), /Zelle/)
  assert.throws(() => normalizeRegistrationSettings({ ...base, questions: [{ id: 'a', label: 'Pick', type: 'choice', options: [] }] }), /answer choice/)
  assert.throws(() => normalizeRegistrationSettings({ ...base, questions: [base.questions[0], base.questions[0]] }), /repeats/)
  assert.throws(() => normalizeRegistrationSettings({ ...base, opensAt: '2026-12-02T00:00:00Z', closesAt: '2026-12-01T00:00:00Z' }), /open before/)
  assert.match(String(validateRegistrationField(base, 'weekly')), /do not repeat/)
  assert.equal(validateRegistrationField(base, 'none'), true)
  assert.equal(validateRegistrationField({ ...base, enabled: false }, 'weekly'), true)
})

test('submissions are checked against the form, keep labels, and ignore unknown answers', () => {
  const result = normalizeSubmission(settings, {
    name: '  Anna Petrova ', email: 'Anna@Example.com', partySize: 2, language: 'ru',
    answers: { size: 'M', meals: ['Saturday lunch', 'Friday dinner', 'Saturday lunch'], photo: true, age: '34', injected: 'x' },
  })
  assert.equal(result.name, 'Anna Petrova')
  assert.equal(result.email, 'anna@example.com')
  assert.equal(result.language, 'ru')
  assert.deepEqual(result.answers.map(answer => [answer.id, answer.value]),
    [['size', 'M'], ['meals', ['Friday dinner', 'Saturday lunch']], ['photo', true], ['age', 34]])
  assert.equal(result.answers[0].label, 'T-shirt size')
  const field = (body: object) => { try { normalizeSubmission(settings, body); return 'ok' } catch (error) { return (error as RegistrationError).field } }
  const good = { name: 'A', email: 'a@b.co', answers: { size: 'S', photo: true } }
  assert.equal(field(good), 'ok')
  assert.equal(field({ ...good, email: 'not-an-email' }), 'email')
  assert.equal(field({ ...good, answers: { photo: true } }), 'size')
  assert.equal(field({ ...good, answers: { size: 'XL', photo: true } }), 'size')
  assert.equal(field({ ...good, answers: { size: 'S' } }), 'photo')
  assert.throws(() => normalizeSubmission(settings, { ...good, partySize: 5 }), /Number of people/)
  assert.throws(() => normalizeSubmission({ ...settings, phone: 'required' }, good), /Phone/)
})

test('availability follows opening, closing, capacity, waitlist and cancellation', () => {
  const event = { startsAt: '2026-12-05T18:00:00Z', cancelled: false }
  const now = Date.parse('2026-12-01T00:00:00Z')
  assert.equal(registrationAvailability(settings, event, 0, now).state, 'open')
  assert.equal(registrationAvailability(settings, event, 0, now).spotsLeft, 10)
  assert.equal(registrationAvailability(settings, event, 9, now, 2).state, 'waitlist')
  assert.equal(registrationAvailability({ ...settings, waitlist: false }, event, 10, now).state, 'full')
  assert.equal(registrationAvailability(settings, event, 0, Date.parse('2026-12-05T18:00:00Z')).state, 'closed')
  assert.equal(registrationAvailability({ ...settings, opensAt: '2026-12-02T00:00:00.000Z' }, event, 0, now).state, 'not-open-yet')
  assert.equal(registrationAvailability({ ...settings, capacity: null }, event, 500, now).spotsLeft, null)
  assert.equal(registrationAvailability(settings, { ...event, cancelled: true }, 0, now).state, 'cancelled')
})

test('payment details give direct links with the amount where the service supports it', () => {
  const payment = paymentDetails(settings, 2, 'R-7')!
  assert.equal(payment.amount, '$50.00')
  const byKind = Object.fromEntries(payment.options.map(option => [option.kind, option]))
  assert.equal(byKind.cashapp.url, 'https://cash.app/$GraceChurch/50.00')
  assert.equal(byKind.paypal.url, 'https://paypal.me/gracechurch/50.00')
  assert.equal(byKind.venmo.url, 'https://venmo.com/u/Grace-Church')
  assert.equal(byKind.zelle.url, null)
  assert.equal(byKind.other.url, null)
  assert.equal(byKind.other.label, 'In person')
  assert.equal(paymentDetails({ ...settings, priceCents: null }, 2, 'R-7'), null)
  assert.equal(publicForm(settings).price?.amount, '$25.00')
  assert.equal('paymentMethods' in publicForm(settings), false)
})

test('CSV export keeps removed questions, opens in Excel, and blocks spreadsheet formulas', () => {
  const csv = registrationsCsv(settings, [{
    id: 3, status: 'confirmed', name: '=HYPERLINK("http://evil")', email: 'a@b.co', partySize: 2, amountDueCents: 5000, paid: true,
    createdAt: '2026-11-17T00:00:00.000Z',
    answers: [{ id: 'size', label: 'T-shirt size', type: 'choice', value: 'M' }, { id: 'old', label: 'Old question', type: 'text', value: '+1' }],
  }])
  assert.ok(csv.startsWith('﻿'))
  const [header, row] = csv.slice(1).trim().split('\r\n')
  assert.match(header, /"T-shirt size".*"Old question"/)
  assert.match(row, /^"R-3","confirmed","'=HYPERLINK\(""http:\/\/evil""\)"/)
  assert.match(row, /"\$50\.00","Yes"/)
  assert.match(row, /"'\+1"$/)
})

test('emails escape church-entered text and only ask confirmed people to pay', () => {
  const common = { language: 'en', churchName: 'Grace <Church>', eventTitle: 'Retreat & <b>Fun</b>', when: 'Sat', name: 'Ann',
    partySize: 2, reference: 'R-9', payment: paymentDetails(settings, 2, 'R-9'), manageUrl: 'https://example.church/registrations/manage#abc' }
  const confirmed = registrationEmailContent({ ...common, kind: 'confirmed' })
  assert.match(confirmed.subject, /Retreat & <b>Fun<\/b>/)
  assert.ok(!confirmed.html.includes('<b>Fun</b>'))
  assert.match(confirmed.html, /Retreat &amp; &lt;b&gt;Fun/)
  assert.match(confirmed.text, /Amount due: \$50\.00/)
  assert.match(confirmed.text, /R-9 in the payment note/)
  const waitlisted = registrationEmailContent({ ...common, kind: 'waitlisted' })
  assert.doesNotMatch(waitlisted.text, /Amount due/)
  const russian = registrationEmailContent({ ...common, kind: 'promoted', language: 'ru' })
  assert.match(russian.subject, /Освободилось место/)
})

test('the migration is registered last and the collection is not writable through its API', () => {
  assert.equal(migrations.at(-1)?.name, '20261117_180000_event_registrations')
  const migration = readFileSync(new URL('../src/migrations/20261117_180000_event_registrations.ts', import.meta.url), 'utf8')
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "registration" jsonb/)
  assert.match(migration, /"payload_locked_documents_rels" ADD COLUMN "event_registrations_id"/)
  const collection = readFileSync(new URL('../src/collections/EventRegistrations.ts', import.meta.url), 'utf8')
  assert.match(collection, /create: \(\) => false/)
  assert.match(collection, /read: manageCommunityContent/)
})
