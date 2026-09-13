import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { usePassageSermons } from '../hooks/usePassageSermons.js'
import { selectedVersesToCanonicalRange } from '../utils/sermonPassageSelection.js'
import SermonViewer from './SermonViewer.jsx'

const INITIAL_PRIMARY_LIMIT = 6
const INITIAL_MENTIONED_LIMIT = 12

function SermonMatchButton({ match, prominent = false, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(match)}
      className={`w-full rounded-xl border text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
        prominent
          ? 'border-blue-200 bg-white p-3 shadow-sm hover:border-primary hover:bg-blue-50 dark:border-blue-900 dark:bg-gray-900 dark:hover:bg-blue-950/30'
          : 'border-gray-200 bg-white px-3 py-2 hover:border-primary hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-blue-950/30'
      }`}
    >
      <span className={`${prominent ? 'text-sm' : 'text-xs'} block font-semibold leading-snug text-gray-950 dark:text-gray-100`}>
        {match.title}
      </span>
      <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">
        {match.speaker.name} · <time dateTime={match.serviceDate}>{match.serviceDate}</time>
      </span>
      <span className="mt-1 block truncate text-[11px] text-gray-500 dark:text-gray-500">
        {match.sourceServerName}
      </span>
    </button>
  )
}

function ActivePassageSermonsPanel({ sources, selection, sourceVersionKey }) {
  const {
    status,
    primary,
    mentioned,
    errors,
    warnings,
    retry,
    loadDetail,
  } = usePassageSermons({
    sources,
    range: selection.range,
  })
  const [showMentioned, setShowMentioned] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [primaryLimit, setPrimaryLimit] = useState(INITIAL_PRIMARY_LIMIT)
  const [mentionedLimit, setMentionedLimit] = useState(INITIAL_MENTIONED_LIMIT)
  const closeViewer = useCallback(() => setSelectedMatch(null), [])

  useLayoutEffect(() => {
    setShowMentioned(false)
    setSelectedMatch(null)
    setPrimaryLimit(INITIAL_PRIMARY_LIMIT)
    setMentionedLimit(INITIAL_MENTIONED_LIMIT)
  }, [selection.label, sourceVersionKey])

  return (
    <>
      <section
        className="max-h-[45vh] overflow-y-auto overscroll-contain border-b border-blue-100 bg-blue-50/70 px-3 py-3 dark:border-blue-900 dark:bg-blue-950/20"
        aria-labelledby="passage-sermons-heading"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="passage-sermons-heading" className="text-sm font-bold text-gray-950 dark:text-gray-100">
              Sermons
            </h3>
            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {selection.label}
            </p>
          </div>
          {status === 'ready' && (
            <button
              type="button"
              onClick={retry}
              className="flex-shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-primary hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-primary dark:text-blue-400 dark:hover:bg-blue-950"
              aria-label="Refresh published sermons"
            >
              Refresh
            </button>
          )}
        </div>

        {status === 'loading' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400" role="status" aria-live="polite">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
            Verifying published sermons…
          </div>
        )}

        {status === 'error' && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30" role="alert">
            <p className="text-xs font-semibold text-red-900 dark:text-red-200">
              Published sermons are unavailable
            </p>
            <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">
              The connected publication could not be verified. Your Bible and commentary remain available.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            {primary.length > 0 && (
              <div className="mt-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                  On this passage
                </h4>
                <div className="space-y-2">
                  {primary.slice(0, primaryLimit).map(match => (
                    <SermonMatchButton
                      key={`${match.sourceKey}-${match.publicId}`}
                      match={match}
                      prominent
                      onOpen={setSelectedMatch}
                    />
                  ))}
                </div>
                {primary.length > primaryLimit && (
                  <button
                    type="button"
                    onClick={() => setPrimaryLimit(value => value + INITIAL_PRIMARY_LIMIT)}
                    className="mt-2 text-xs font-semibold text-primary underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary dark:text-blue-400"
                  >
                    Show more sermons
                  </button>
                )}
              </div>
            )}

            {primary.length === 0 && mentioned.length === 0 && (
              <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs leading-5 text-gray-600 dark:bg-gray-900/60 dark:text-gray-400">
                No published sermons are linked to this passage yet.
              </p>
            )}

            {mentioned.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowMentioned(value => !value)}
                  className="text-xs font-semibold text-primary underline decoration-blue-300 underline-offset-2 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-primary dark:text-blue-400"
                  aria-expanded={showMentioned}
                  aria-controls="passage-mentioned-sermons"
                >
                  Appears in {mentioned.length} sermon{mentioned.length === 1 ? '' : 's'}
                </button>
                {showMentioned && (
                  <div id="passage-mentioned-sermons" className="mt-2 space-y-2">
                    {mentioned.slice(0, mentionedLimit).map(match => (
                      <SermonMatchButton
                        key={`${match.sourceKey}-${match.publicId}`}
                        match={match}
                        onOpen={setSelectedMatch}
                      />
                    ))}
                    {mentioned.length > mentionedLimit && (
                      <button
                        type="button"
                        onClick={() => setMentionedLimit(value => value + INITIAL_MENTIONED_LIMIT)}
                        className="text-xs font-semibold text-primary underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary dark:text-blue-400"
                      >
                        Show more mentioned sermons
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {errors.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" role="status">
                Some connected sermon sources could not be verified.
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" role="status">
                Showing a previously verified sermon catalog because the latest refresh failed.
              </div>
            )}
          </>
        )}
      </section>

      {selectedMatch && (
        <SermonViewer
          match={selectedMatch}
          loadDetail={loadDetail}
          onClose={closeViewer}
        />
      )}
    </>
  )
}

function PassageSermonsPanel({
  publicationSources = [],
  selectedVerse = null,
  selectedVerses = [],
  bookName = '',
}) {
  const selection = useMemo(
    () => selectedVersesToCanonicalRange({
      selectedVerse,
      selectedVerses,
      fallbackBookName: bookName,
    }),
    [bookName, selectedVerse, selectedVerses],
  )
  const sourceVersionKey = useMemo(
    () => Array.isArray(publicationSources)
      ? publicationSources
          .map(source => [
            source.serverId,
            source.catalogUrl,
            source.subscriptionRevision || '',
          ].join(':'))
          .sort()
          .join('|')
      : '',
    [publicationSources],
  )

  if (!Array.isArray(publicationSources) || publicationSources.length === 0) return null
  if (selection.reason === 'cross-book') {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300" role="status">
        Passage-linked sermons can only be checked for verses within one Bible book.
      </div>
    )
  }
  if (!selection.range) return null

  return (
    <ActivePassageSermonsPanel
      sources={publicationSources}
      selection={selection}
      sourceVersionKey={sourceVersionKey}
    />
  )
}

export default PassageSermonsPanel
