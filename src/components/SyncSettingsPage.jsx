import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  beginSyncSignIn,
  changeAccountProtection,
  clearPendingSyncSignIn,
  eraseSynchronizedAccountData,
  exportSynchronizedAccountData,
  getSyncState,
  loadSyncConflicts,
  loadSyncAccount,
  performManualSync,
  requestAccountReverification,
  resolveSyncConflict,
  revokeSyncDevice,
  signOutSyncAccount,
} from '../services/progressSync.js'
import { authenticateLocalDevice } from '../services/secureStorage.js'

function downloadJson(fileName, payload) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function formatDate(value) {
  if (!value) return 'Not yet'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Not yet'
}

function statusMessage(state) {
  if (state.status === 'conflict' || state.conflictCount) return `${state.conflictCount || 1} change needs review. Nothing was overwritten.`
  if (state.status === 'synced') return 'Your supported reading data is up to date.'
  return 'Ready to synchronize.'
}

export default function SyncSettingsPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [state, setState] = useState(null)
  const [accountContext, setAccountContext] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('loading')
  const [now, setNow] = useState(Date.now())
  const [showProtection, setShowProtection] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [eraseText, setEraseText] = useState('')
  const [conflicts, setConflicts] = useState([])

  const refresh = async () => {
    const saved = await getSyncState()
    setState(saved)
    try {
      const context = await loadSyncAccount()
      setAccountContext(context)
      setConflicts(context?.account?.conflicts ? await loadSyncConflicts(context) : [])
    } catch (loadError) {
      setAccountContext(null)
      setConflicts([])
      setError(loadError.message)
    }
  }

  useEffect(() => {
    refresh().finally(() => setBusy(''))
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const resendSeconds = useMemo(() => {
    const sentAt = Date.parse(state?.verificationSentAt || '')
    if (!Number.isFinite(sentAt)) return 0
    return Math.max(0, 60 - Math.floor((now - sentAt) / 1000))
  }, [now, state?.verificationSentAt])

  const run = async (name, action, successMessage = '') => {
    setBusy(name)
    setError('')
    setMessage('')
    try {
      const result = await action()
      if (successMessage) setMessage(successMessage)
      await refresh()
      return result
    } catch (actionError) {
      setError(actionError.message || 'That did not finish. Your local reading data is safe; try again.')
      return null
    } finally {
      setBusy('')
    }
  }

  const sendLink = async event => {
    event?.preventDefault()
    const targetEmail = email || state?.pendingEmail
    const result = await run('email', () => beginSyncSignIn(targetEmail))
    if (result) {
      setEmail('')
      setMessage(`We sent a sign-in link to ${result.email}.`)
    }
  }

  const syncNow = () => run('sync', performManualSync, 'Synchronization finished.')

  const resolveConflict = (conflict, action) => run(
    `conflict-${conflict.id}`,
    () => resolveSyncConflict(conflict, action),
    action === 'use-conflict' ? 'This device’s saved change is now synchronized.' : 'The synchronized version was kept.',
  )

  const reverify = () => run(
    'reverify',
    requestAccountReverification,
    `We sent a fresh verification link to ${accountContext?.account?.member?.email || 'your email'}.`,
  )

  const saveProtection = async mode => {
    const local = await authenticateLocalDevice('Confirm this Heritage account-protection change')
    if (local.supported && !local.authenticated) {
      setError('Device authentication was cancelled. Account protection was not changed.')
      return
    }
    const input = mode === 'strict-password'
      ? { mode, password, passwordConfirmation: confirmation, acknowledgedLockoutRisk: acknowledged }
      : { mode }
    const result = await run('protection', () => changeAccountProtection(input), mode === 'strict-password'
      ? 'Strict password protection is enabled.'
      : 'Email verification is now your account protection.')
    if (result) {
      setShowProtection(false)
      setPassword('')
      setConfirmation('')
      setAcknowledged(false)
      setShowPassword(false)
    }
  }

  const exportAccount = () => run('export', async () => {
    const payload = await exportSynchronizedAccountData()
    downloadJson(`heritage-synchronized-data-${new Date().toISOString().slice(0, 10)}.json`, payload)
  }, 'Personal-data export downloaded.')

  const eraseAccount = () => run('erase', async () => {
    if (eraseText !== 'ERASE') throw new Error('Type ERASE before removing synchronized data.')
    await eraseSynchronizedAccountData()
    setEraseText('')
  }, 'Synchronized server data was erased. Local reading data remains on this device.')

  if (busy === 'loading' || !state) {
    return <div className="min-h-screen bg-background dark:bg-gray-900 grid place-items-center text-sm text-gray-500">Opening Sync…</div>
  }

  const account = accountContext?.account
  const waiting = !account && state.pendingEmail

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white sticky top-0 z-40 shadow-lg safe-area-top">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/20" aria-label="Back">←</button>
          <h1 className="heading-text text-lg font-bold">Sync</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-5 pb-20 space-y-4">
        {!account && !waiting && (
          <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h2 className="heading-text text-xl font-bold text-gray-900 dark:text-gray-100">Sync your reading progress</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Keep your reading position, plans, bookmarks, notes, and highlights available on your other devices.</p>
            <form onSubmit={sendLink} className="mt-5 space-y-3">
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" aria-label="Email address" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-3 text-gray-900 dark:text-gray-100" />
              <button disabled={busy === 'email' || !email.trim()} className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">{busy === 'email' ? 'Sending…' : 'Continue'}</button>
            </form>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">No password required.</p>
          </section>
        )}

        {!account && waiting && (
          <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h2 className="heading-text text-xl font-bold text-gray-900 dark:text-gray-100">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">We sent a sign-in link to {state.pendingEmail}.</p>
            <div className="mt-5 grid gap-2">
              <a href="mailto:" className="rounded-lg bg-primary px-4 py-3 text-center font-semibold text-white">Open email app</a>
              <button type="button" onClick={sendLink} disabled={busy === 'email' || resendSeconds > 0} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 font-semibold text-gray-700 dark:text-gray-100 disabled:opacity-50">{resendSeconds ? `Resend in ${resendSeconds}s` : 'Resend link'}</button>
              <button type="button" onClick={() => run('different', clearPendingSyncSignIn)} className="px-4 py-2 text-sm text-primary dark:text-blue-300">Use a different email</button>
            </div>
          </section>
        )}

        {account && (
          <>
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <h2 className="heading-text text-xl font-bold text-gray-900 dark:text-gray-100">Sync</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{account.member.email}</p>
              <button type="button" onClick={syncNow} disabled={busy === 'sync'} className="mt-5 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">{busy === 'sync' ? 'Syncing…' : 'Sync now'}</button>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Last synced: {formatDate(state.lastSyncedAt)}</p>
              <p className={`mt-1 text-sm ${state.conflictCount ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-300'}`}>{statusMessage(state)}</p>
              <button type="button" onClick={() => run('signout', signOutSyncAccount)} disabled={busy === 'signout'} className="mt-4 text-sm font-semibold text-gray-700 dark:text-gray-200 underline disabled:opacity-50">{busy === 'signout' ? 'Signing out…' : 'Sign out on this device'}</button>
              <div className="mt-5 border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Account protection</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{account.accountProtection === 'strict-password' ? 'Strict password protection' : 'Email verification'}</p>
                </div>
                <button type="button" onClick={() => setShowProtection(value => !value)} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-100">Change protection</button>
              </div>
            </section>

            {showProtection && (
              <section className="rounded-xl border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 p-5">
                <h2 className="font-bold text-gray-900 dark:text-gray-100">Choose account protection</h2>
                {!account.recentEmailVerification ? (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Verify your email again before changing this setting.</p>
                    <button type="button" onClick={reverify} disabled={busy === 'reverify'} className="mt-3 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy === 'reverify' ? 'Sending…' : 'Send verification link'}</button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <button type="button" onClick={() => saveProtection('email')} disabled={busy === 'protection'} className="w-full rounded-lg border border-primary bg-primary/5 dark:bg-blue-500/10 p-4 text-left">
                      <span className="block font-semibold text-gray-900 dark:text-gray-100">Email verification <span className="text-xs text-primary dark:text-blue-300">Recommended</span></span>
                      <span className="mt-1 block text-xs text-gray-600 dark:text-gray-300">Simplest — sign in using a secure link sent to your email.</span>
                    </button>
                    <div className="rounded-lg border border-gray-300 dark:border-gray-600 p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Strict password protection</h3>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Requires your email verification and password when adding a new device. The password cannot be reset while logged out.</p>
                      <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-950 dark:text-amber-100">
                        <p className="font-bold">Important: this password cannot be reset by email.</p>
                        <p className="mt-2">If you lose it and are signed out on every device, you will lose access to your synchronized account data. Neither the church nor Heritage support can reset it for you.</p>
                        <p className="mt-2">We strongly recommend saving it in a password manager.</p>
                      </div>
                      <button type="button" onClick={exportAccount} className="mt-3 text-xs font-semibold text-primary dark:text-blue-300 underline">Export personal data before enabling</button>
                      <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password (12+ characters)" className="mt-3 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-gray-100" />
                      <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Enter password again" className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-gray-100" />
                      <label className="mt-2 flex gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} /><span>Show password</span></label>
                      <label className="mt-3 flex gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} className="mt-1" /><span>I understand that this password cannot be reset while I am logged out.</span></label>
                      {confirmation && password !== confirmation && <p className="mt-2 text-xs text-red-600 dark:text-red-300">The two passwords do not match.</p>}
                      <button type="button" onClick={() => saveProtection('strict-password')} disabled={busy === 'protection' || password.length < 12 || password !== confirmation || !acknowledged} className="mt-4 w-full rounded-lg bg-gray-950 dark:bg-gray-100 px-4 py-2.5 font-semibold text-white dark:text-gray-950 disabled:opacity-50">Enable Strict protection</button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {conflicts.length > 0 && (
              <section className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 p-5">
                <h2 className="font-bold text-amber-950 dark:text-amber-100">Review changes from two devices</h2>
                <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">Heritage kept both versions instead of overwriting either one. Choose the version you want for each item.</p>
                <div className="mt-4 space-y-3">
                  {conflicts.map(conflict => (
                    <article key={conflict.id} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 p-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{String(conflict.recordType || 'saved item').replaceAll('-', ' ')}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Changed on this device {formatDate(conflict.updatedAt)}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button type="button" onClick={() => resolveConflict(conflict, 'use-conflict')} disabled={Boolean(busy)} className="rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Use this device’s change</button>
                        <button type="button" onClick={() => resolveConflict(conflict, 'discard-conflict')} disabled={Boolean(busy)} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-100 disabled:opacity-50">Keep synchronized version</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <details className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <summary className="cursor-pointer font-semibold text-gray-900 dark:text-gray-100">Manage account</summary>
              <div className="mt-4 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Connected devices</h3>
                  <div className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                    {account.devices.map(device => (
                      <div key={device.id} className="py-3 flex items-start justify-between gap-3">
                        <div><p className="text-sm text-gray-900 dark:text-gray-100">{device.name}{device.current ? ' · This device' : ''}</p><p className="text-xs text-gray-500 dark:text-gray-400">{device.platform} · Connected {formatDate(device.firstConnectedAt)} · Last sync {formatDate(device.lastSyncedAt)}</p></div>
                        {!device.revokedAt && <button type="button" onClick={() => run('revoke', () => revokeSyncDevice(device.deviceId), 'Device revoked.')} className="text-xs font-semibold text-red-600 dark:text-red-300">Revoke</button>}
                      </div>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={exportAccount} disabled={busy === 'export'} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-100">Export synchronized data</button>
                {account.events?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent account security activity</h3>
                    <ul className="mt-2 space-y-2 text-xs text-gray-600 dark:text-gray-300">
                      {account.events.map(event => (
                        <li key={event.id} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                          {event.type === 'device-connected' ? 'A device signed in' : event.type === 'device-revoked' ? 'A device was revoked' : 'Account protection changed'} · {formatDate(event.occurredAt)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="border-t border-red-200 dark:border-red-900 pt-4">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">Erase synchronized server data</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This signs out every device. Local data on this phone is left intact.</p>
                  <input value={eraseText} onChange={event => setEraseText(event.target.value)} placeholder="Type ERASE" className="mt-3 w-full rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100" />
                  <button type="button" onClick={eraseAccount} disabled={eraseText !== 'ERASE' || busy === 'erase'} className="mt-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Erase synchronized data</button>
                </div>
              </div>
            </details>
          </>
        )}

        {message && <div className="rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">{message}</div>}
        {error && <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-900 dark:text-red-100">{error}</div>}
      </main>
    </div>
  )
}
