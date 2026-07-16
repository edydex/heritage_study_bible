import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CONTENT_SERVERS_CHANGE_EVENT,
  addContentServer,
  getContentServerSubscriptions,
  inspectContentServer,
  refreshContentServer,
  removeContentServer,
} from '../services/contentServers'

const TYPE_LABELS = {
  readingPlans: 'Bible plans',
  songs: 'songs & hymns',
  sermons: 'sermons',
  books: 'books',
  commentaries: 'commentaries',
}

function formatCheckedAt(value) {
  if (!value) return 'Not checked yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Previously checked' : `Checked ${date.toLocaleString()}`
}

function ContentServersPage() {
  const navigate = useNavigate()
  const [serverUrl, setServerUrl] = useState('')
  const [preview, setPreview] = useState(null)
  const [subscriptions, setSubscriptions] = useState(() => getContentServerSubscriptions())
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const refresh = () => setSubscriptions(getContentServerSubscriptions())
    window.addEventListener(CONTENT_SERVERS_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(CONTENT_SERVERS_CHANGE_EVENT, refresh)
  }, [])

  const previewCapabilities = useMemo(() => {
    if (!preview) return []
    return Object.entries(preview.counts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${count} ${TYPE_LABELS[type] || type}`)
  }, [preview])

  const handleInspect = async event => {
    event.preventDefault()
    setBusy('inspect')
    setMessage('')
    setPreview(null)
    try {
      setPreview(await inspectContentServer(serverUrl))
    } catch (error) {
      setMessage(error.message || 'Could not read that content server.')
    } finally {
      setBusy('')
    }
  }

  const handleAdd = async () => {
    if (!preview) return
    setBusy('add')
    setMessage('')
    try {
      await addContentServer(preview)
      setSubscriptions(getContentServerSubscriptions())
      setMessage(`${preview.manifest.name} was added. Its catalog items now appear in Resources.`)
      setPreview(null)
      setServerUrl('')
    } catch (error) {
      setMessage(error.message || 'Could not add that content server.')
    } finally {
      setBusy('')
    }
  }

  const handleRefresh = async serverId => {
    setBusy(`refresh:${serverId}`)
    setMessage('')
    try {
      const server = await refreshContentServer(serverId)
      setSubscriptions(getContentServerSubscriptions())
      setMessage(`${server.manifest.name} is up to date.`)
    } catch (error) {
      setMessage(error.message || 'Could not refresh that server.')
    } finally {
      setBusy('')
    }
  }

  const handleRemove = server => {
    if (!window.confirm(`Remove ${server.manifest.name}? Downloaded personal notes are not affected.`)) return
    removeContentServer(server.manifest.id)
    setSubscriptions(getContentServerSubscriptions())
    setMessage(`${server.manifest.name} was removed.`)
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white sticky top-0 z-40 shadow-lg safe-area-top">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/20" aria-label="Back">←</button>
          <h1 className="heading-text text-lg font-bold">Content Servers</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-5 pb-20 space-y-5">
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add public resources</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            A Content Server is a public, read-only library run by a church or publisher. Checking it first shows exactly which kinds of resources it wants to add. It cannot read your notes or sign you into anything.
          </p>
          <form onSubmit={handleInspect} className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              inputMode="url"
              value={serverUrl}
              onChange={event => {
                setServerUrl(event.target.value)
                setPreview(null)
              }}
              placeholder="https://resources.example.church"
              className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-gray-100"
            />
            <button disabled={busy === 'inspect' || !serverUrl.trim()} className="rounded-lg bg-primary px-4 py-2.5 text-white font-semibold disabled:opacity-50">
              {busy === 'inspect' ? 'Checking…' : 'Check Server'}
            </button>
          </form>

          {preview && (
            <div className="mt-4 rounded-xl border border-primary/30 dark:border-blue-500/40 bg-primary/5 dark:bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                {preview.manifest.icon && <img src={preview.manifest.icon} alt="" className="h-11 w-11 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">{preview.manifest.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{preview.manifest.publisher || new URL(preview.manifestUrl).host}</p>
                  {preview.manifest.description && <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{preview.manifest.description}</p>}
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">This server will add</p>
              <ul className="mt-1 text-sm text-gray-700 dark:text-gray-200 list-disc pl-5">
                {previewCapabilities.map(capability => <li key={capability}>{capability}</li>)}
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Catalog metadata updates automatically. Larger files load only when you open them.</p>
              <button type="button" onClick={handleAdd} disabled={busy === 'add'} className="mt-4 w-full rounded-lg bg-gray-950 dark:bg-gray-100 px-4 py-2.5 text-white dark:text-gray-950 font-bold disabled:opacity-50">
                {busy === 'add' ? 'Adding…' : `Add ${preview.manifest.name}`}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Installed servers</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{subscriptions.length} installed</p>
            </div>
            <button type="button" onClick={() => navigate('/community')} className="rounded-lg border border-primary/40 px-3 py-2 text-sm font-semibold text-primary dark:text-blue-300">
              Communities
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <p className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4 text-sm text-gray-500 dark:text-gray-400">No external content servers are installed. The library bundled with Heritage remains available.</p>
          ) : (
            <div className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
              {subscriptions.map(server => (
                <div key={server.manifest.id} className="py-4 first:pt-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{server.manifest.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatCheckedAt(server.lastCheckedAt)}</p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        {Object.entries(server.counts || {}).filter(([, count]) => count > 0).map(([type, count]) => `${count} ${TYPE_LABELS[type] || type}`).join(' · ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleRefresh(server.manifest.id)} disabled={busy === `refresh:${server.manifest.id}`} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 disabled:opacity-50">Refresh</button>
                      <button type="button" onClick={() => handleRemove(server)} className="rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-xs text-red-700 dark:text-red-300">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {message && <div className="rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">{message}</div>}
      </main>
    </div>
  )
}

export default ContentServersPage
