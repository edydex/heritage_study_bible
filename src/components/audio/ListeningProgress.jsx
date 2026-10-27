import { listeningTimeLeft } from '../../services/audioProgress'

export default function ListeningProgress({ progress, rate = 1 }) {
  if (!progress) return null
  return <div className="listening-progress">
    <progress aria-label="Book progress" max="100" value={progress.percent} />
    <small>{progress.started ? `${progress.percent}% · ${listeningTimeLeft(progress.remaining, rate)}` : listeningTimeLeft(progress.duration, rate)}</small>
  </div>
}
