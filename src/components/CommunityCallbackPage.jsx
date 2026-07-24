import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { completeCommunitySignIn } from '../services/communities'
import { buildHeritageAppUrl } from '../utils/nativeDeepLinks'

function CommunityCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [message, setMessage] = useState('Finishing secure sign-in…')
  const [failed, setFailed] = useState(false)
  const [continueInBrowser, setContinueInBrowser] = useState(false)
  const [showAndroidChoice, setShowAndroidChoice] = useState(false)

  useEffect(() => {
    const server = params.get('server')
    const token = params.get('token')
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
    completeCommunitySignIn(server, token)
      .then(record => {
        setMessage(record.contentWarning
          ? `You joined ${record.manifest.name}. ${record.contentWarning}`
          : `You joined ${record.manifest.name}.`)
        window.setTimeout(() => navigate('/community', { replace: true }), record.contentWarning ? 2400 : 900)
      })
      .catch(error => {
        setFailed(true)
        setMessage(error.message || 'This sign-in link is invalid or expired.')
      })
  }, [continueInBrowser, navigate, params])

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
        {showAndroidChoice && (
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={openAndroidApp} className="rounded-lg bg-primary px-4 py-2 text-white">Open Heritage app</button>
            <button onClick={() => setContinueInBrowser(true)} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-200">Continue in browser</button>
          </div>
        )}
        {failed && <button onClick={() => navigate('/community', { replace: true })} className="mt-4 rounded-lg bg-primary px-4 py-2 text-white">Back to Communities</button>}
      </div>
    </div>
  )
}

export default CommunityCallbackPage
