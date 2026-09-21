import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHeritageAudio } from './AudioProvider'
import { getBibleAudioTrack, loadBibleAudioTiming, matchingAudioVerse } from '../../services/bibleAudio'

export default function BibleAudioControls({ book, chapter, translationId, selectionMode = false }) {
  const audio = useHeritageAudio(), navigate = useNavigate()
  const track = getBibleAudioTrack(book, chapter?.number, translationId)
  const [timing, setTiming] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const [follow, setFollow] = useState(false)
  const active = track && audio?.state.trackId === track.id
  useEffect(() => {
    let cancelled = false
    setTiming(null); setError(''); setFollow(false)
    if (track) loadBibleAudioTiming(track).then(value => { if (!cancelled) setTiming(value) }).catch(() => { if (!cancelled) setError('Verse timing could not load. Audio is still available.') })
    return () => { cancelled = true }
  }, [track?.id, retry])
  const verse = active && !selectionMode ? matchingAudioVerse(timing, audio.state.position, chapter) : null
  useEffect(() => {
    if (!verse) return
    const row = document.getElementById(`verse-${chapter.number}-${verse}`)
    const texts = [...(row?.querySelectorAll('[data-verse-content][data-translation="BSB"]') || [])].filter(text => text.dataset.book === book)
    if (!texts.length) return
    texts.forEach(text => text.setAttribute('data-audio-active', 'true'))
    const text = texts.find(text => text.getBoundingClientRect().height > 0)
    if (text && follow && audio?.state.status === 'playing') {
      const rect = text.getBoundingClientRect()
      const playerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--audio-player-height')) || 100
      if (rect.top < 150 || rect.bottom > window.innerHeight - playerHeight - 75) row.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
    return () => texts.forEach(text => text.removeAttribute('data-audio-active'))
  }, [verse, chapter?.number, book, follow, audio?.state.status])
  if (!track) return null
  return <div className="bible-audio-controls" aria-label="Chapter audio">
    <div className="audio-actions">
      <button type="button" disabled={!audio} onClick={() => active && ['playing', 'loading'].includes(audio.state.status) ? audio.player.pause() : audio.player.play(track.id)}>
        {active && audio.state.status === 'playing' ? 'Pause chapter' : active && audio.state.status === 'loading' ? 'Cancel audio' : 'Listen · BSB'}
      </button>
      <label><input type="checkbox" checked={follow} disabled={!active || !timing?.verses.length || selectionMode} onChange={event => setFollow(event.target.checked)} /> Auto-scroll this chapter</label>
      <button type="button" onClick={() => navigate(`/audio?book=${track.bookId}`)}>Chapters &amp; downloads</button>
    </div>
    <small>Barry Hays · {timing ? `${timing.verses.length} of ${timing.totalVerses} verses have automatic timing; gaps stay unhighlighted.` : 'Berean Standard Bible'} </small>
    {error && <small role="status">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></small>}
  </div>
}
