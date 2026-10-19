import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReaderTextSize } from './ReaderTextSize'
import ReaderSettings from './ReaderSettings'
import useReaderVerseMode from './useReaderVerseMode'
import RecordedSentenceText from './RecordedSentenceText'
import AudioTransport from './audio/AudioTransport'
import { useHeritageAudio } from './audio/AudioProvider'
import { isTimedTranscript, loadSermonCaptions, matchingSermonSentences } from '../services/sermonAudioText'
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

function SermonAudioPlayer({ media, label, duration, register, onState, sharedAudio }) {
  const playerRef = useRef(null)
  const pendingSeek = useRef(null)
  const [playbackError, setPlaybackError] = useState('')
  const [playback, setPlayback] = useState({ position: 0, duration: media.durationSeconds || 0, status: 'paused', rate: 1 })
  const updatePlayback = () => {
    const player = playerRef.current
    const next = { position: pendingSeek.current ?? player.currentTime ?? 0, duration: Number.isFinite(player.duration) ? player.duration : media.durationSeconds || 0, status: player.paused ? 'paused' : 'playing', rate: player.playbackRate }
    setPlayback(next); onState(media, next)
  }
  const play = () => {
    setPlaybackError('')
    return playerRef.current.play().catch(() => setPlaybackError('Tap Play to start this recording.'))
  }
  const seek = (position, startPlayback = false) => {
    const player = playerRef.current
    const duration = Number.isFinite(player.duration) ? player.duration : media.durationSeconds || Infinity
    const next = Math.max(0, Math.min(duration, position))
    if (player.readyState >= 1) { pendingSeek.current = null; player.currentTime = next }
    else { pendingSeek.current = next; if (!startPlayback) player.load() }
    updatePlayback()
    if (startPlayback) play()
  }
  const metadataLoaded = () => {
    const player = playerRef.current
    if (pendingSeek.current != null) {
      player.currentTime = Math.min(pendingSeek.current, Number.isFinite(player.duration) ? player.duration : pendingSeek.current)
      pendingSeek.current = null
    }
    updatePlayback()
  }
  const language = mediaLanguageTag(media)
  const host = mediaHostname(media)

  useEffect(() => {
    const player = playerRef.current
    if (!player.getAttribute('src')) player.src = media.url
    register(media.url, { element: player, seekAndPlay: position => seek(position, true) })
    return () => {
      register(media.url, null)
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
    sharedAudio?.player.pause()
    updatePlayback()
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
        controls={!sharedAudio}
        hidden={Boolean(sharedAudio)}
        preload="none"
        src={media.url}
        aria-label={`Play ${label} (${language})`}
        tabIndex={0}
        onPlay={stopSiblingPlayers}
        onPause={updatePlayback} onTimeUpdate={updatePlayback} onLoadedMetadata={metadataLoaded} onRateChange={updatePlayback}
        onError={() => setPlaybackError('This recording could not load. Try Play again or open the recording link.')}
        className="mt-3 w-full"
      />
      {sharedAudio && <section className="audio-player audio-player-inline" aria-label={`${label} (${language}) player`}>
        <AudioTransport state={playback} play={play} pause={() => playerRef.current.pause()}
          seek={position => seek(position)}
          setRate={rate => { playerRef.current.playbackRate = rate; updatePlayback() }} />
      </section>}
      {playbackError && <p role="status" className="mt-2 text-sm">{playbackError}</p>}
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
  const [textSize, setTextSize] = useReaderTextSize()
  const [showSettings, setShowSettings] = useState(false)
  const [verseMode, setVerseMode] = useReaderVerseMode()
  const [followAudio, setFollowAudio] = useState(true)
  const [captions, setCaptions] = useState({})
  const [captionError, setCaptionError] = useState('')
  const [playback, setPlayback] = useState({ mediaUrl: null, position: 0, status: 'paused' })
  const players = useRef(new Map())
  const scrollRef = useRef(null)
  const sharedAudio = useHeritageAudio()
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
        if (showSettings) {
          setShowSettings(false)
          dialogRef.current?.querySelector('[data-reader-settings] > button')?.focus()
        }
        else onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], audio[controls], [tabindex]:not([tabindex="-1"])',
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
      if (showSettings) {
        setShowSettings(false)
        dialogRef.current?.querySelector('[data-reader-settings] > button')?.focus()
      }
      else onClose()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('heritage:native-back', handleNativeBack, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('heritage:native-back', handleNativeBack, true)
    }
  }, [onClose, showSettings])

  const detail = state.verified?.detail || null
  useEffect(() => {
    const controller = new AbortController()
    setCaptions({}); setCaptionError('')
    if (verseMode && detail) {
      const transcripts = detail.media.filter(isTimedTranscript)
      Promise.allSettled(transcripts.map(async media => [media.url, await loadSermonCaptions(media, controller.signal)]))
        .then(results => {
          if (controller.signal.aborted) return
          setCaptions(Object.fromEntries(results.filter(result => result.status === 'fulfilled').map(result => result.value)))
          if (results.some(result => result.status === 'rejected')) setCaptionError('Recording timestamps could not load. You can still read the text.')
        })
    }
    return () => controller.abort()
  }, [detail, verseMode])
  useEffect(() => {
    if (sharedAudio?.state.status === 'playing') for (const player of players.current.values()) player.element.pause()
  }, [sharedAudio?.state.trackId, sharedAudio?.state.status])
  useEffect(() => {
    if (!verseMode || !followAudio || playback.status !== 'playing') return
    const current = scrollRef.current?.querySelector('[data-audio-sentence="true"]')
    const container = scrollRef.current?.getBoundingClientRect(), rect = current?.getBoundingClientRect()
    if (rect && container && (rect.top < container.top + 16 || rect.bottom > container.bottom - 48)) current.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [verseMode, followAudio, playback.position, playback.status])

  const timedBodies = useMemo(() => new Map((detail?.body || []).map(entry => {
    const recordings = detail.media.filter(media => isInlineAudio(media) && media.language === entry.language)
    const recording = recordings.length === 1 ? recordings[0] : null
    const matches = recording ? detail.media.filter(media => isTimedTranscript(media) && media.language === entry.language)
      .map(media => matchingSermonSentences(entry.text, captions[media.url] || [], entry.language, recording.durationSeconds)).filter(spans => spans.length) : []
    return [entry, { recording, spans: matches.length === 1 ? matches[0] : [] }]
  })), [detail, captions])

  if (typeof document === 'undefined') return null

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
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-black sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl"
      >
        <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-black sm:px-6">
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
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              aria-label="Close sermon viewer"
            >
              Close
            </button>
            <ReaderSettings
              textSize={textSize} onTextSizeChange={setTextSize} lightHeader
              open={showSettings} onOpenChange={setShowSettings}
              verseMode={verseMode} onVerseModeChange={setVerseMode}
              followAudio={followAudio} onFollowAudioChange={setFollowAudio}
            />
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
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
                            sharedAudio={sharedAudio}
                            register={(url, player) => { player ? players.current.set(url, player) : players.current.delete(url) }}
                            onState={(media, next) => setPlayback(previous => next.status === 'playing' || previous.mediaUrl === media.url ? { ...next, mediaUrl: media.url } : previous)}
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
                {verseMode && <p role="status" className="text-sm text-gray-500 dark:text-gray-400">{captionError || (detail.media.some(isTimedTranscript) ? 'Sentence seeking uses timestamps only when the published transcript matches this text and has one recording in that language.' : 'This sermon has no timestamped transcript. Sentence seeking needs a matching VTT or SRT transcript from the publisher.')}</p>}
                {bodyLanguages.length > 1 && <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Text language
                  <select aria-label="Sermon text language" value={selectedLanguage} onChange={event => setBodyLanguage(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
                    {bodyLanguages.map(language => <option key={language} value={language}>{({ en: 'English', ru: 'Русский' })[language] || language.toUpperCase()}</option>)}
                  </select>
                </label>}
                {detail.body.filter(entry => entry.language === selectedLanguage).map((entry, index) => {
                  const { recording, spans } = timedBodies.get(entry)
                  const active = recording?.url === playback.mediaUrl ? spans.find(span => span.start <= playback.position && playback.position < span.end) : null
                  return <section key={`${entry.kind}-${entry.language}-${index}`}>
                    <h3 className="text-base font-bold text-gray-950 dark:text-gray-100">{BODY_LABELS[entry.kind] || 'Sermon text'}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{entry.language}</p>
                    <div className="reader-content mt-4 whitespace-pre-wrap leading-[1.8] text-gray-800 dark:text-gray-200" style={{ fontSize: `${textSize}px` }}>
                      <RecordedSentenceText text={entry.text} spans={verseMode ? spans : []} verseMode={verseMode} language={entry.language} activeStart={active?.textStart} onSeek={start => {
                        const player = players.current.get(recording?.url)
                        if (!player) return
                        sharedAudio?.player.pause()
                        player.seekAndPlay(start)
                      }} />
                    </div>
                  </section>
                })}
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
