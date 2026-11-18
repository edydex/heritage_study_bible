import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPeopleDirectory } from '../src/lib/peopleDirectory.ts'
import { workspaceAccountLanguageResponse } from '../src/endpoints/workspaceAccount.ts'
import { sendWorkspaceInvitation } from '../src/lib/workspaceInvitation.ts'
import { workspaceInvitationContent, workspaceLanguageURL } from '../src/lib/workspaceLanguage.ts'

test('People joins accounts, current roles and invitations without hiding pending people', () => {
  const rows = buildPeopleDirectory([
    { id: 1, email: 'OWNER@example.test', displayName: 'Owner', systemRole: 'system-admin', preferredLanguage: 'en' },
    { id: 2, email: 'direct@example.test', displayName: 'Direct account', systemRole: 'member', preferredLanguage: 'ru' },
  ], [ { id: 8, user: 1, role: 'owner', joinedAt: '2026-01-01' } ], [
    { id: 11, email: 'owner@example.test', role: 'leader', active: false, emailSentAt: '2026-01-01', acceptedAt: '2026-01-02' },
    { id: 12, email: 'pending@example.test', displayName: 'Pending pastor', role: 'admin', active: true, emailSentAt: '2026-01-03', preferredLanguage: 'ru' },
    { id: 13, email: 'draft@example.test', role: 'member', active: true },
    { id: 14, email: 'revoked@example.test', role: 'leader', active: false },
  ])
  assert.equal(rows.length, 5)
  const owner = rows.find(row => row.email === 'owner@example.test')!
  assert.equal(owner.role, 'owner', 'invitation never replaces current church role in directory')
  assert.equal(owner.invitationStatus, 'accepted')
  assert.equal(owner.serverAdmin, true)
  assert.equal(rows.find(row => row.email === 'pending@example.test')!.accountId, null)
  assert.equal(rows.find(row => row.email === 'pending@example.test')!.invitationStatus, 'pending')
  assert.equal(rows.find(row => row.email === 'pending@example.test')!.language, 'ru')
  assert.equal(rows.find(row => row.email === 'draft@example.test')!.invitationStatus, 'not-sent')
  assert.equal(rows.find(row => row.email === 'revoked@example.test')!.invitationStatus, 'revoked')
  assert.equal(rows.find(row => row.email === 'direct@example.test')!.role, null)
})

test('reactivated invitations remain pending even if they were accepted earlier', () => {
  const [row] = buildPeopleDirectory([], [], [{ id: 1, email: 'a@example.test', role: 'admin', active: true,
    acceptedAt: '2026-01-01', emailSentAt: '2026-01-02' }])
  assert.equal(row.invitationStatus, 'pending')
})

test('language endpoint changes only the signed-in workspace account language', async () => {
  const updates: any[] = []
  const req: any = { user: { id: 4, _strategy: 'local-jwt' },
    headers: new Headers({ origin: 'https://church.example.test' }),
    json: async () => ({ language: 'ru' }),
    payload: { config: { serverURL: 'https://church.example.test' }, update: async (options: any) => { updates.push(options) } } }
  const response = await workspaceAccountLanguageResponse(req)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { language: 'ru' })
  assert.equal(updates[0].id, 4)
  assert.equal(updates[0].overrideAccess, true)
  assert.deepEqual(updates[0].data, { preferredLanguage: 'ru' })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  for (const user of [null, { id: 4, _strategy: 'community-session' }, { id: 4, _strategy: 'api-key' }]) {
    assert.equal((await workspaceAccountLanguageResponse({ ...req, user })).status, 401)
  }
  for (const origin of [null, 'https://other.example.test']) {
    assert.equal((await workspaceAccountLanguageResponse({ ...req, headers: new Headers(origin ? { origin } : {}) })).status, 403)
  }
  for (const data of [{ language: 'de' }, { language: 'ru', id: 99 }, { language: 'ru', systemRole: 'system-admin' }, []]) {
    assert.equal((await workspaceAccountLanguageResponse({ ...req, json: async () => data })).status, 400)
  }
  assert.equal(updates.length, 1)
})

test('localized invitation email preserves password token and escapes church names', () => {
  const setupURL = workspaceLanguageURL('https://church.example.test/admin/reset/opaque-token', 'ru')
  assert.equal(new URL(setupURL).pathname, '/admin/reset/opaque-token')
  assert.equal(new URL(setupURL).searchParams.get('language'), 'ru')
  const email = workspaceInvitationContent({ name: 'Church <script>alert(1)</script>', role: 'admin', setupURL,
    loginURL: 'https://church.example.test/admin/login?language=ru', hours: 24, language: 'ru' })
  assert.match(email.subject, /Приглашение/)
  assert.match(email.text, /Создать пароль/)
  assert.match(email.text, /24 часа/)
  assert.doesNotMatch(email.html, /<script>/)
  assert.match(email.html, /&lt;script&gt;/)
})

test('a Russian workspace invitation creates a member account with Russian menus', async () => {
  const writes: any[] = []
  const messages: any[] = []
  const payload: any = { find: async () => ({ docs: [] }),
    create: async (options: any) => { writes.push(options); return { id: 1, ...options.data } },
    forgotPassword: async () => 'valid-reset-token', sendEmail: async (email: any) => messages.push(email) }
  await sendWorkspaceInvitation({ payload } as any, { email: 'Pastor@example.test', role: 'admin', preferredLanguage: 'ru' })
  assert.equal(writes[0].data.systemRole, 'member')
  assert.equal(writes[0].data.preferredLanguage, 'ru')
  assert.equal(messages[0].to, 'pastor@example.test')
  assert.match(messages[0].subject, /Приглашение/)
  assert.match(messages[0].text, /language=ru/)
})

test('inviting an existing account preserves its language and permissions', async () => {
  const payload: any = { find: async () => ({ docs: [{ id: 1, preferredLanguage: 'en', systemRole: 'system-admin' }] }),
    create: async () => { throw new Error('unexpected account write') },
    update: async () => { throw new Error('unexpected account write') },
    forgotPassword: async () => 'valid-reset-token', sendEmail: async () => {} }
  await sendWorkspaceInvitation({ payload } as any, { email: 'pastor@example.test', role: 'leader', preferredLanguage: 'ru' })
})
