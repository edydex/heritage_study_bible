import { useEffect, useLayoutEffect, useState } from 'react'
import { useHeritageAudio } from './AudioProvider'
import { getBibleAudioTrack, loadBibleAudioTiming, matchingAudioVerse, normalizeSpokenText } from '../../services/bibleAudio'

export default function useBibleAudio({ book, chapter, translationId, selectionMode = false, renderKey, onMessage }) {
  const audio = useHeritageAudio()
  const track = getBibleAudioTrack(book, chapter?.number, translationId)
  const [timing, setTiming] = useState(null)
  const active = track && audio?.state.trackId === track.id
  useEffect(() => {
    let cancelled = false
    setTiming(null)
    if (track) loadBibleAudioTiming(track).then(value => { if (!cancelled) setTiming(value) }).catch(() => {})
    return () => { cancelled = true }
  }, [track?.id])
  useEffect(() => {
    if (!active || !timing || selectionMode) return
    // The native playback clock wakes the UI at real timestamp boundaries.
    // Keep both ends: display continuity advances in the breath after a verse.
    return audio.player.watchPositions?.(track.id, timing.verses.flatMap(span => [span.start, span.end]))
  }, [active, timing, selectionMode, audio?.player, track?.id])
  const verse = active && !selectionMode ? matchingAudioVerse(timing, audio.state.position, chapter) : null
  useLayoutEffect(() => {
    if (!verse) return
    const row = document.getElementById(`verse-${chapter.number}-${verse}`)
    const texts = [...(row?.querySelectorAll('[data-verse-content]') || [])].filter(text => text.dataset.book === book && text.dataset.translation === translationId)
    texts.forEach(text => text.setAttribute('data-audio-active', 'true'))
    const text = texts.find(text => text.getBoundingClientRect().height > 0)
    if (text && audio?.settings.followBible && audio.state.status === 'playing') {
      const rect = text.getBoundingClientRect()
      if (rect.top < 150 || rect.bottom > window.innerHeight - 80) row.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
    return () => texts.forEach(text => text.removeAttribute('data-audio-active'))
  }, [verse, chapter?.number, book, translationId, audio?.settings.followBible, audio?.state.status, renderKey])
  const seekVerse = number => {
    if (!active || !['playing', 'loading'].includes(audio.state.status) || selectionMode) return false
    const text = chapter?.verses.find(value => value.number === number)?.text
    const span = timing?.verses.find(value => value.verse === number && value.text === normalizeSpokenText(text))
    if (span) audio.player.seek(span.start)
    else onMessage?.('This verse has no verified audio position yet.')
    return true
  }
  return { track, seekVerse }
}
