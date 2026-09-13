import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePublishedSermonArchive } from '../hooks/usePublishedSermonArchive.js'
import {
  CONTENT_SERVERS_CHANGE_EVENT,
  getPublicSermonPublicationSources,
} from '../services/contentServers.js'
import { formatCanonicalBibleRange } from '../utils/sermonPassageSelection.js'
import SermonViewer from './SermonViewer.jsx'
import { COMMUNITIES_CHANGE_EVENT, getCommunities } from '../services/communities.js'

function localizedValues(values, defaultLanguage) {
  if (!values || typeof values !== 'object') return []
  const entries = Object.entries(values).sort(([left], [right]) => {
    if (left === defaultLanguage) return -1
    if (right === defaultLanguage) return 1
    return left.localeCompare(right)
  })
  const seen = new Set()
  const result = []
  for (const [, rawValue] of entries) {
    const value = String(rawValue || '').trim()
    const key = value.toLocaleLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function localizedDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parsed)
}

function referenceLabels(entry) {
  return entry.references.map(reference => ({
    label: formatCanonicalBibleRange(reference.range),
    role: reference.role,
  }))
}

function matchesSearch(entry, query) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase()
  if (!normalizedQuery) return true
  const titles = localizedValues(entry.titles, entry.defaultLanguage)
  const seriesTitles = localizedValues(entry.series?.titles, entry.defaultLanguage)
  const references = referenceLabels(entry).map(reference => reference.label)
  return [
    ...titles,
    ...seriesTitles,
    ...references,
    entry.speaker?.name,
    entry.sourceServerName,
    entry.serviceDate,
  ]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase()
    .includes(normalizedQuery)
}

function PublishedSermonCard({ entry, onOpen }) {
  const titles = localizedValues(entry.titles, entry.defaultLanguage)
  const alternateTitles = titles.filter(title => title !== entry.title)
  const seriesTitles = localizedValues(entry.series?.titles, entry.defaultLanguage)
  const references = referenceLabels(entry)

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-400/60 sm:p-5"
      aria-label={`Open ${entry.title} from ${entry.sourceServerName}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-snug text-gray-950 dark:text-gray-100 sm:text-lg">
            {entry.title}
          </h2>
          {alternateTitles.length > 0 && (
            <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">
              {alternateTitles.join(' · ')}
            </p>
          )}
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {entry.speaker.name}
            {seriesTitles.length > 0 ? ` · ${seriesTitles.join(' · ')}` : ''}
          </p>
        </div>
        <div className="flex-shrink-0 text-left sm:text-right">
          <time
            dateTime={entry.serviceDate}
            className="text-sm font-semibold text-gray-700 dark:text-gray-300"
          >
            {localizedDate(entry.serviceDate)}
          </time>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {entry.sourceServerName}
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Scripture references">
        {references.map((reference, index) => (
          <li
            key={`${reference.role}-${reference.label}-${index}`}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              reference.role === 'primary'
                ? 'bg-blue-50 text-primary dark:bg-blue-950/40 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {reference.label}
            {reference.role === 'mentioned' ? ' · mentioned' : ''}
          </li>
        ))}
      </ul>
    </button>
  )
}

function PublishedSermonArchivePage() {
  const navigate = useNavigate()
  const { serverId, publicId } = useParams()
  const [searchParams] = useSearchParams()
  const communityId = searchParams.get('community')
  const catalogQuery = communityId ? `?community=${encodeURIComponent(communityId)}` : ''
  const [communities, setCommunities] = useState(getCommunities)
  const community = communities.find(record => record.manifest.id === communityId)
  const [searchQuery, setSearchQuery] = useState('')
  const [sources, setSources] = useState(() => getPublicSermonPublicationSources())

  useEffect(() => {
    const refreshSources = () => {
      setSources(getPublicSermonPublicationSources())
      setCommunities(getCommunities())
    }
    window.addEventListener(CONTENT_SERVERS_CHANGE_EVENT, refreshSources)
    window.addEventListener(COMMUNITIES_CHANGE_EVENT, refreshSources)
    return () => {
      window.removeEventListener(CONTENT_SERVERS_CHANGE_EVENT, refreshSources)
      window.removeEventListener(COMMUNITIES_CHANGE_EVENT, refreshSources)
    }
  }, [])

  const selectedSources = useMemo(() => communityId
    ? sources.filter(source => source.serverId === community?.contentPreview?.manifest?.id)
    : sources, [sources, communityId, community])

  const {
    status,
    entries,
    errors,
    warnings,
    sourceCount,
    refresh,
    loadDetail,
  } = usePublishedSermonArchive({ sources: selectedSources })
  const selectedMatch = useMemo(
    () => entries.find(entry => (
      entry.sourceServerId === serverId
      && entry.publicId === publicId
    )) || null,
    [entries, publicId, serverId],
  )
  const visibleEntries = useMemo(
    () => entries.filter(entry => matchesSearch(entry, searchQuery)),
    [entries, searchQuery],
  )
  const deepLinkRequested = Boolean(serverId || publicId)
  const deepLinkUnavailable = deepLinkRequested
    && status === 'ready'
    && !selectedMatch
  const openSermon = useCallback((entry) => {
    navigate(
      `/resources/sermons/${encodeURIComponent(entry.sourceServerId)}/${encodeURIComponent(entry.publicId)}${catalogQuery}`,
    )
  }, [navigate, catalogQuery])
  const closeSermon = useCallback(() => {
    navigate(`/resources/sermons${catalogQuery}`, { replace: true })
  }, [navigate, catalogQuery])

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="sticky top-0 z-40 bg-primary text-white shadow-lg">
        <div className="mx-auto flex min-h-14 max-w-4xl items-center gap-3 px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => navigate(communityId ? '/community' : '/genesis/1')}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label={communityId ? 'Back to Community Home' : 'Back to Bible'}
          >
            <span className="text-lg" aria-hidden="true">←</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold sm:text-lg">Published Sermons</h1>
            <p className="hidden text-xs text-blue-100 sm:block">
              Sermons and study notes shared by your churches
            </p>
          </div>
          {status === 'ready' && sourceCount > 0 && (
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Refresh
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {communityId && <div className="mb-4 flex items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-300">
          <p>{community?.manifest.name || 'Community unavailable'}</p>
          <button onClick={() => navigate('/resources/sermons')} className="text-primary underline dark:text-blue-300">Show all churches</button>
        </div>}
        <div className="mb-5">
          <label htmlFor="published-sermon-search" className="sr-only">
            Search published sermons
          </label>
          <input
            id="published-sermon-search"
            type="search"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search title, speaker, series, or Scripture…"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        {deepLinkUnavailable && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30" role="alert">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              This published sermon is unavailable
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
              It may have been withdrawn, or its church is no longer connected on this device.
            </p>
            <button
              type="button"
              onClick={closeSermon}
              className="mt-3 text-sm font-semibold text-primary underline underline-offset-2 dark:text-blue-300"
            >
              Return to the sermon archive
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400" role="status" aria-live="polite">
            <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
            <span className="mt-3 block">Verifying published sermon catalogs…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900 dark:bg-red-950/30" role="alert">
            <h2 className="font-semibold text-red-900 dark:text-red-200">
              Published sermon archive unavailable
            </h2>
            <p className="mt-2 text-sm leading-6 text-red-700 dark:text-red-300">
              None of the connected sermon catalogs could be verified. Other Bible resources remain available.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            {errors.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" role="status">
                Some connected sermon sources could not be verified. Showing results only from verified sources.
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" role="status">
                Showing a previously verified sermon catalog because its latest refresh failed.
              </div>
            )}

            {sourceCount === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 p-7 text-center dark:border-gray-600">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  No published sermon sources are installed
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  Add or refresh your church’s Content Server to find its published sermons.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/settings/content-servers')}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Manage Content Servers
                </button>
              </div>
            )}

            {sourceCount > 0 && entries.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 p-7 text-center dark:border-gray-600">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  No sermons have been published yet
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  Installed churches are connected, but their verified public catalogs are currently empty.
                </p>
              </div>
            )}

            {entries.length > 0 && visibleEntries.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 p-7 text-center dark:border-gray-600">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  No published sermons match that search
                </h2>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-sm font-semibold text-primary underline underline-offset-2 dark:text-blue-300"
                >
                  Clear search
                </button>
              </div>
            )}

            {visibleEntries.length > 0 && (
              <>
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
                  {visibleEntries.length} published sermon{visibleEntries.length === 1 ? '' : 's'}
                  {searchQuery.trim() ? ' matching your search' : ''}
                </p>
                <div className="space-y-4">
                  {visibleEntries.map(entry => (
                    <PublishedSermonCard
                      key={`${entry.sourceKey}-${entry.publicId}-${entry.sermonRevision}`}
                      entry={entry}
                      onOpen={openSermon}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {selectedMatch && (
        <SermonViewer
          key={`${selectedMatch.sourceKey}-${selectedMatch.publicId}-${selectedMatch.sermonRevision}-${selectedMatch.checksum}`}
          match={selectedMatch}
          loadDetail={loadDetail}
          onClose={closeSermon}
        />
      )}
    </div>
  )
}

export default PublishedSermonArchivePage
