import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { completeCommunitySignIn } from '../services/communities'
import { getCommunitySession } from '../services/communitySessions'
import { inspectCommunity } from '../services/communities'
import { buildHeritageAppUrl } from '../utils/nativeDeepLinks'

function CommunityCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [message, setMessage] = useState('Finishing secure sign-in…')
  const [failed, setFailed] = useState(false)
  const [continueInBrowser, setContinueInBrowser] = useState(false)
  const [showAndroidChoice, setShowAndroidChoice] = useState(false)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const server = params.get('server')
  const token = params.get('token')
  const flow = params.get('flow') === 'sync' ? 'sync' : 'community'
  const purpose = params.get('purpose') === 'reverify' ? 'reverify' : 'sign-in'

  const finishSignIn = async suppliedPassword => {
    setBusy(true)
    setFailed(false)
    setMessage('Finishing secure sign-in…')
    try {
      let authorization = ''
      if (purpose === 'reverify') {
        const preview = await inspectCommunity(server)
        const current = await getCommunitySession(preview.manifest.id, preview)
        if (current?.token) authorization = `Community ${current.token}`
      }
      const record = await completeCommunitySignIn(server, token, {
        ...(suppliedPassword ? { password: suppliedPassword } : {}),
        ...(authorization ? { authorization } : {}),
      })
      if (record.reverified) {
        setMessage('Email verified. You can now change account protection.')
        window.setTimeout(() => navigate('/settings/sync?reverified=1', { replace: true }), 700)
        return
      }
      setMessage(record.contentWarning
        ? `You signed in. ${record.contentWarning}`
        : 'You are signed in.')
      window.setTimeout(
        () => navigate(flow === 'sync' ? '/settings/sync' : '/community', { replace: true }),
        record.contentWarning ? 1800 : 700,
      )
    } catch (error) {
      if (error?.status === 428 && error?.body?.passwordRequired) {
        setPasswordRequired(true)
        setMessage('Enter your Strict protection password to finish adding this device.')
      } else {
        setFailed(true)
        setMessage(error.message || 'This sign-in link or password is invalid or expired.')
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!server || !token) {
      setFailed(true)
      setMessage('This sign-in link is incomplete.')
      return
    }

    const isNative = Capacitor.isNativePlatform?.() === true
    const isAndroidBrowser = !isNative && /Android/i.test(navigator.userAgent)
    if (isAndroidBrowser && !continueInBrowser) {
      setShowAndroidChoice(true)
      setMessage('Open Heritage to finish joining on this device. The one-time link will not be used until the app opens.')
      return
    }

    setShowAndroidChoice(false)
    setMessage('Finishing secure sign-in…')
    finishSignIn('')
  }, [continueInBrowser, server, token])

  const openAndroidApp = () => {
    const appUrl = buildHeritageAppUrl(window.location.href)
    if (!appUrl) {
      setFailed(true)
      setMessage('This sign-in link is incomplete.')
      return
    }
    window.location.href = appUrl
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Community sign-in</h1>
        <p className={`mt-3 text-sm ${failed ? 'text-red-600 dark:text-red-300' : 'text-gray-600 dark:text-gray-300'}`}>{message}</p>
        {passwordRequired && (
          <form onSubmit={event => { event.preventDefault(); finishSignIn(password) }} className="mt-5 text-left">
            <label htmlFor="strict-password" className="block text-sm font-semibold text-gray-800 dark:text-gray-100">Strict protection password</label>
            <input
              id="strict-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">This password cannot be reset while signed out. Use the password saved in your password manager or an existing trusted device.</p>
            <button disabled={busy || !password} className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Checking…' : 'Finish sign-in'}</button>
          </form>
        )}
        {showAndroidChoice && (
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={openAndroidApp} className="rounded-lg bg-primary px-4 py-2 text-white">Open Heritage app</button>
            <button onClick={() => setContinueInBrowser(true)} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-200">Continue in browser</button>
          </div>
        )}
        {failed && <button onClick={() => navigate(flow === 'sync' ? '/settings/sync' : '/community', { replace: true })} className="mt-4 rounded-lg bg-primary px-4 py-2 text-white">Back</button>}
      </div>
    </div>
  )
}

export default CommunityCallbackPage
