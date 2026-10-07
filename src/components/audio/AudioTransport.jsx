import { formatAudioTime } from '../../services/audioCatalog'

export default function AudioTransport({ state, play, pause, seek, setRate, title, expanded = true, children }) {
  return <>
    <div className="audio-player-row">
      {title}
      <button type="button" onClick={() => seek(state.position - 10)} aria-label="Rewind 10 seconds">−10</button>
      <button type="button" onClick={() => ['playing', 'loading'].includes(state.status) ? pause() : play()}>
        {state.status === 'loading' ? 'Cancel' : state.status === 'playing' ? 'Pause' : 'Play'}
      </button>
      <button type="button" onClick={() => seek(state.position + 10)} aria-label="Forward 10 seconds">+10</button>
    </div>
    {expanded && <div className="audio-player-expanded">
      <label className="audio-seek"><span>{formatAudioTime(state.position)}</span> <input aria-label="Audio position" type="range" min="0" max={state.duration || 1} step="1" value={Math.min(state.position, state.duration || 1)} onChange={event => seek(Number(event.target.value))} /> {formatAudioTime(state.duration)}</label>
      <div className="audio-actions">
        {children}
        <label>Speed <select aria-label="Playback speed" value={state.rate} onChange={event => setRate(Number(event.target.value))}>{[0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
      </div>
    </div>}
  </>
}
