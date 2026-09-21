import { useEffect, useState } from 'react'
import { useHeritageAudio } from './AudioProvider'

export default function AudioPlayButton({ track, label = 'chapter' }) {
  const audio = useHeritageAudio()
  const [error, setError] = useState('')
  const playbackError = audio?.state.trackId === track?.id ? audio?.state.error : ''
  useEffect(() => {
    setError(playbackError || '')
    if (!playbackError) return
    const timer = setTimeout(() => setError(''), 8000)
    return () => clearTimeout(timer)
  }, [playbackError])
  if (!track) return null
  const active = audio?.state.trackId === track.id
  const playing = active && ['playing', 'loading'].includes(audio.state.status)
  const name = `${playing ? 'Pause' : 'Play'} ${label} audio`
  return <><button type="button" className="reader-audio-button text-primary dark:text-blue-400" aria-label={name} title={active && audio.state.error ? audio.state.error : name} disabled={!audio}
    onClick={() => playing ? audio.player.pause() : audio.player.play(track.id)}>
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">{playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="M6 3v18l16-9z" />}</svg>
  </button>{error && <div role="status" className="fixed bottom-20 left-4 right-4 mx-auto max-w-md rounded-lg bg-gray-800 text-white p-3 text-sm shadow-lg">{error}</div>}</>
}
