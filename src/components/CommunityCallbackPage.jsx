import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { completeCommunitySignIn } from '../services/communities'

function CommunityCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [message, setMessage] = useState('Finishing secure sign-in…')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const server = params.get('server')
    const token = params.get('token')
    if (!server || !token) {
      setFailed(true)
      setMessage('This sign-in link is incomplete.')
      return
    }
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
  }, [navigate, params])

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Community sign-in</h1>
        <p className={`mt-3 text-sm ${failed ? 'text-red-600 dark:text-red-300' : 'text-gray-600 dark:text-gray-300'}`}>{message}</p>
        {failed && <button onClick={() => navigate('/community', { replace: true })} className="mt-4 rounded-lg bg-primary px-4 py-2 text-white">Back to Communities</button>}
      </div>
    </div>
  )
}

export default CommunityCallbackPage
