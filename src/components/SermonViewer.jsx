import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatCanonicalBibleRange } from '../utils/sermonPassageSelection.js'

const BODY_LABELS = Object.freeze({
  manuscript: 'Sermon manuscript',
  'slide-notes': 'Sermon notes',
  transcript: 'Transcript',
  other: 'Additional text',
})

function localizedText(values, language) {
  if (!values || typeof values !== 'object') return ''
  return values[language] || Object.values(values)[0] || ''
}

function mediaLabel(media) {
  return media.title || `${media.kind.charAt(0).toUpperCase()}${media.kind.slice(1)}`
}

function isInlineAudio(media) {
  return media?.kind === 'audio'
    && typeof media.mediaType === 'string'
    && media.mediaType.toLowerCase().startsWith('audio/')
}

function mediaLanguageTag(media) {
  return typeof media?.language === 'string' && media.language
    ? media.language.toUpperCase()
    : 'UND'
}

function mediaHostname(media) {
  try {
    return new URL(media.url).hostname
  } catch {
    return 'the recording host'
  }
}

function SermonAudioPlayer({ media, label, duration }) {
  const playerRef = useRef(null)
  const language = mediaLanguageTag(media)
  const host = mediaHostname(media)

  useEffect(() => {
    const player = playerRef.current
    return () => {
      if (!player) return
      try {
        player.pause()
      } catch {
        // The element is already inert.
      }
      player.removeAttribute('src')
      try {
        player.load()
      } catch {
        // Some embedded engines have no reload operation after teardown.
      }
    }
  }, [])

  function stopSiblingPlayers(event) {
    const dialog = event.currentTarget.closest('[role="dialog"]')
    for (const sibling of dialog?.querySelectorAll('audio') || []) {
      if (sibling !== event.currentTarget) sibling.pause()
    }
  }

  return (
    <article className="rounded-xl border border-gray-200 p-3 dark:border-gray-700 sm:col-span-2">
      <span className="block text-sm font-semibold text-primary dark:text-blue-400">
        {label}
      </span>
      <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
        audio · {language}{duration ? ` · ${duration}` : ''}
      </span>
      <audio
        ref={playerRef}
        controls
        preload="none"
        src={media.url}
        aria-label={`Play ${label} (${language})`}
        tabIndex={0}
        onPlay={stopSiblingPlayers}
        className="mt-3 w-full"
      />
      <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
        Playback connects directly to {host}. That host receives your IP address
        and browser details when you press Play.
      </p>
      <a
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs font-semibold text-primary underline underline-offset-2 dark:text-blue-400"
      >
        Open {label} ({language}) in a new tab
      </a>
    </article>
  )
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainder = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}

function SermonViewer({ match, loadDetail, onClose }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const [retryToken, setRetryToken] = useState(0)
  const [bodyLanguage, setBodyLanguage] = useState('')
  const [state, setState] = useState({
    status: 'loading',
    verified: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', verified: null })
    setBodyLanguage('')
    loadDetail(match, { signal: controller.signal })
      .then(verified => {
        if (!controller.signal.aborted) setState({ status: 'ready', verified })
      })
      .catch(error => {
        if (controller.signal.aborted || error?.name === 'AbortError') return
        setState({ status: 'error', verified: null })
      })
    return () => controller.abort()
  }, [loadDetail, match.publicId, match.sourceKey, retryToken])

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), a[href], audio[controls], [tabindex]:not([tabindex="-1"])',
      ) || [])]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const handleNativeBack = event => {
      event.preventDefault?.()
      event.stopImmediatePropagation?.()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('heritage:native-back', handleNativeBack, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('heritage:native-back', handleNativeBack, true)
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  const detail = state.verified?.detail || null
  const bodyLanguages = [...new Set(detail?.body.map(entry => entry.language) || [])]
  const selectedLanguage = bodyLanguages.includes(bodyLanguage) ? bodyLanguage
    : bodyLanguages.includes(detail?.defaultLanguage) ? detail.defaultLanguage
      : bodyLanguages[0] || detail?.defaultLanguage
  const title = detail
    ? localizedText(detail.titles, selectedLanguage)
    : match.title
  const series = detail
    ? localizedText(detail.series?.titles, selectedLanguage)
    : ''

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-stretch sm:items-center sm:justify-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close sermon"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl"
      >
        <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary dark:text-blue-400">
              Published sermon
            </p>
            <h2 id={titleId} className="mt-1 text-xl font-bold leading-tight text-gray-950 dark:text-gray-100">
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {match.sourceServerName}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            aria-label="Close sermon viewer"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {state.status === 'loading' && (
            <div className="py-16 text-center" role="status" aria-live="polite">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Verifying the published sermon…
              </p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900 dark:bg-red-950/30" role="alert">
              <h3 className="font-semibold text-red-900 dark:text-red-200">
                This sermon could not be verified
              </h3>
              <p className="mt-2 text-sm leading-6 text-red-700 dark:text-red-300">
                The publication may be temporarily unavailable or may no longer match its catalog.
              </p>
              <button
                type="button"
                onClick={() => setRetryToken(value => value + 1)}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {state.status === 'ready' && detail && (
            <article className="space-y-7">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-gray-900 dark:text-gray-100">Speaker</dt>
                    <dd className="mt-0.5 text-gray-700 dark:text-gray-300">{detail.speaker.name}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-900 dark:text-gray-100">Service date</dt>
                    <dd className="mt-0.5 text-gray-700 dark:text-gray-300">
                      <time dateTime={detail.serviceDate}>{detail.serviceDate}</time>
                    </dd>
                  </div>
                  {series && (
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-gray-900 dark:text-gray-100">Series</dt>
                      <dd className="mt-0.5 text-gray-700 dark:text-gray-300">{series}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <section aria-labelledby={`${titleId}-passages`}>
                <h3 id={`${titleId}-passages`} className="text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">
                  Scripture passages
                </h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {detail.references.map((reference, index) => (
                    <li
                      key={`${reference.role}-${index}-${formatCanonicalBibleRange(reference.range)}`}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        reference.role === 'primary'
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {formatCanonicalBibleRange(reference.range)}
                      {reference.role === 'mentioned' ? ' · mentioned' : ''}
                    </li>
                  ))}
                </ul>
              </section>

              {detail.media.length > 0 && (
                <section aria-labelledby={`${titleId}-media`}>
                  <h3 id={`${titleId}-media`} className="text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">
                    Listen or view
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {detail.media.map((media, index) => {
                      const label = mediaLabel(media)
                      const duration = formatDuration(media.durationSeconds)
                      const key = `${media.kind}-${media.url}-${index}`
                      if (isInlineAudio(media)) {
                        return (
                          <SermonAudioPlayer
                            key={key}
                            media={media}
                            label={label}
                            duration={duration}
                          />
                        )
                      }
                      return (
                        <a
                          key={key}
                          href={media.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-gray-200 p-3 text-left hover:border-primary hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:hover:bg-blue-950/30"
                        >
                          <span className="block text-sm font-semibold text-primary dark:text-blue-400">
                            {label}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                            {media.kind}{duration ? ` · ${duration}` : ''}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                </section>
              )}

              <div className="space-y-8">
                {bodyLanguages.length > 1 && <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Text language
                  <select aria-label="Sermon text language" value={selectedLanguage} onChange={event => setBodyLanguage(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
                    {bodyLanguages.map(language => <option key={language} value={language}>{({ en: 'English', ru: 'Русский' })[language] || language.toUpperCase()}</option>)}
                  </select>
                </label>}
                {detail.body.filter(entry => entry.language === selectedLanguage).map((entry, index) => (
                  <section key={`${entry.kind}-${entry.language}-${index}`}>
                    <h3 className="text-base font-bold text-gray-950 dark:text-gray-100">
                      {BODY_LABELS[entry.kind] || 'Sermon text'}
                    </h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {entry.language}
                    </p>
                    <div className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-gray-800 dark:text-gray-200">
                      {entry.text}
                    </div>
                  </section>
                ))}
                {detail.body.length === 0 && (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    This publication does not include written sermon notes.
                  </p>
                )}
              </div>

              {detail.canonicalUrl && (
                <footer className="border-t border-gray-200 pt-5 dark:border-gray-700">
                  <a
                    href={detail.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-primary underline underline-offset-2 dark:text-blue-400"
                  >
                    Open this sermon on the church website
                  </a>
                </footer>
              )}
            </article>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}

export default SermonViewer
