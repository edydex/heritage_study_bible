import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { inspectCommunity, savePublicCommunity } from '../services/communities'
import { CONTENT_SERVERS_CHANGE_EVENT, getContentServerSubscriptions, refreshContentServer } from '../services/contentServers'

export default function CommunityResources({ community }) {
  const navigate = useNavigate()
  const [subscriptions, setSubscriptions] = useState(getContentServerSubscriptions)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const server = subscriptions.find(row => row.manifest.id === community.contentPreview?.manifest.id)
  const pages = community.manifest.publicPages || {}

  useEffect(() => {
    const refresh = () => setSubscriptions(getContentServerSubscriptions())
    window.addEventListener(CONTENT_SERVERS_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(CONTENT_SERVERS_CHANGE_EVENT, refresh)
  }, [])

  const updateResources = async category => {
    setBusy(true)
    setMessage('')
    try {
      if (server) await refreshContentServer(server.manifest.id)
      else await savePublicCommunity(await inspectCommunity(community.manifestUrl))
      if (category) navigate(`/resources/${category}?community=${encodeURIComponent(community.manifest.id)}`)
      else setMessage('Church resources updated.')
    } catch (error) {
      setMessage(`${error.message} Previously loaded resources are still available.`)
    } finally { setBusy(false) }
  }
  const openResource = category => {
    if (category === 'calendar') {
      navigate(`/community/calendar?community=${encodeURIComponent(community.manifest.id)}`)
      return
    }
    if (server?.enabled === false) {
      navigate('/settings/content-servers')
    } else if (server) {
      navigate(`/resources/${category}?community=${encodeURIComponent(community.manifest.id)}`)
    } else {
      updateResources(category)
    }
  }
  const tileClass = 'block rounded-xl border border-gray-200 dark:border-gray-600 p-4 text-left hover:border-primary dark:hover:border-blue-400 disabled:opacity-50'
  return <section aria-label="Church resources" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">At church and at home</h2>
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-900 dark:text-gray-100">
      {pages.live && <a href={pages.live} target="_blank" rel="noopener noreferrer" className={tileClass}>
        <span className="block font-semibold">Live service</span>
        <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">Watch the stream and choose original or translated audio.</span>
      </a>}
      {pages.translation && <a href={pages.translation} target="_blank" rel="noopener noreferrer" className={tileClass}>
        <span className="block font-semibold">Live translation</span>
        <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">Read the translation or listen when translated audio is available.</span>
      </a>}
      {[['calendar', 'Calendar', 'See upcoming events and regular gatherings.'], ['sermons', 'Sermons and notes', 'Read the messages your church shares.'], ['songs', 'Songs', 'Find the songs your congregation sings.'], ['commentaries', 'Passage commentary', 'Open your church’s published Bible study notes.']].map(([id, title, description]) =>
        <button key={id} onClick={() => openResource(id)} disabled={busy} className={tileClass}>
          <span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">{description}</span>
        </button>)}
      <button onClick={() => navigate('/settings/sync')} className={tileClass}>
        <span className="block font-semibold">My notes and progress</span>
        <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">Manage personal sync between your devices.</span>
      </button>
    </div>
    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
      {server?.enabled === false ? <p>This church’s resources are disabled. Open Content settings to enable them.</p> :
        <p>{server ? 'Your saved library remains available when the church server cannot be reached.' : 'Opening a resource adds this church’s public library. No membership sign-in is needed.'}</p>}
      {server && <button disabled={busy} onClick={() => updateResources()} className="mt-2 text-primary dark:text-blue-300 underline disabled:opacity-50">{busy ? 'Updating…' : 'Refresh church resources'}</button>}
      {(pages.live || pages.translation) && <p className="mt-2">Live pages open separately and need an internet connection.</p>}
    </div>
    {message && <p role="status" className="mt-3 text-sm text-gray-700 dark:text-gray-200">{message}</p>}
  </section>
}
