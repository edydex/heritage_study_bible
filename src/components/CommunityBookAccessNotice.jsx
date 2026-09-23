import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COMMUNITIES_CHANGE_EVENT, getCommunities } from '../services/communities'
import { COMMUNITY_SESSION_CHANGE_EVENT, getCommunitySession } from '../services/communitySessions'

export default function CommunityBookAccessNotice({ communityId }) {
  const navigate = useNavigate()
  const [state, setState] = useState(null)

  useEffect(() => {
    let cancelled = false, revision = 0
    const check = async () => {
      const current = ++revision
      const churches = getCommunities().filter(record => !communityId || record.manifest.id === communityId)
      const needsSignIn = (await Promise.all(churches.map(async church => {
        if (church.status !== 'joined' || church.syncOnly) return church
        try {
          const session = await getCommunitySession(church.manifest.id, church)
          return session?.token && (!session.expiresAt || Date.parse(session.expiresAt) > Date.now()) ? null : church
        } catch { return church }
      }))).filter(Boolean)
      if (!cancelled && current === revision) setState({ churches, needsSignIn })
    }
    void check()
    window.addEventListener(COMMUNITIES_CHANGE_EVENT, check)
    window.addEventListener(COMMUNITY_SESSION_CHANGE_EVENT, check)
    return () => {
      cancelled = true
      window.removeEventListener(COMMUNITIES_CHANGE_EVENT, check)
      window.removeEventListener(COMMUNITY_SESSION_CHANGE_EVENT, check)
    }
  }, [communityId])

  if (!state || (state.churches.length && !state.needsSignIn.length)) return null
  return <section aria-label="Community book access" className="mb-4 rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-gray-800 dark:text-gray-100">
    <h2 className="font-semibold">Your church’s books</h2>
    <p className="mt-1">Sign in as a member to add your church’s private books to this library. Use the email your church invited. Signing in to church administration does not sign in this reader.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {state.needsSignIn.map(church => <button key={church.manifest.id} type="button" onClick={() => navigate(`/community?signin=${encodeURIComponent(church.manifest.id)}`)} className="min-h-11 rounded-lg bg-primary px-3 py-2 font-semibold text-white">Sign in to {church.manifest.name}</button>)}
      {!state.churches.length && <button type="button" onClick={() => navigate('/community')} className="min-h-11 rounded-lg bg-primary px-3 py-2 font-semibold text-white">Connect your church</button>}
    </div>
  </section>
}
