import { sentenceRanges } from '../services/communityAudio'

// The recording's source offsets are authoritative. Untimed sentences remain
// readable but cannot seek to an invented position in a recording.
export default function RecordedSentenceText({ text, spans = [], activeStart, verseMode = false, language = 'en', renderText = value => value, onSeek }) {
  const verified = spans.filter(span => Number.isFinite(span.start) && Number.isFinite(span.end)
    && Number.isInteger(span.textStart) && Number.isInteger(span.textEnd)
    && span.textStart >= 0 && span.textEnd > span.textStart && span.textEnd <= text.length)
    .sort((a, b) => a.textStart - b.textStart)
  const ranges = []
  let covered = 0
  const addUntimed = end => {
    if (verseMode) for (const range of sentenceRanges(text.slice(covered, end), language)) {
      if (text.slice(covered + range.start, covered + range.end).trim()) ranges.push({ textStart: covered + range.start, textEnd: covered + range.end })
    }
  }
  for (const span of verified) {
    if (span.textStart < covered) continue
    addUntimed(span.textStart)
    ranges.push(span)
    covered = span.textEnd
  }
  addUntimed(text.length)
  const parts = []
  let cursor = 0
  for (const range of ranges) {
    if (range.textStart < cursor) continue
    if (range.textStart > cursor) parts.push(renderText(text.slice(cursor, range.textStart), cursor))
    const timed = Number.isFinite(range.start) && Boolean(onSeek)
    const activate = event => {
      if (event.target.closest('button,a') || !window.getSelection()?.isCollapsed) return
      event.stopPropagation()
      onSeek(range.start)
    }
    parts.push(<span key={range.textStart} className={`${verseMode ? 'reader-sentence-row' : ''} ${timed ? 'reader-sentence-seek' : ''}`}
      data-audio-sentence={range.textStart === activeStart ? 'true' : undefined}
      data-sentence-start={timed ? range.start : undefined}
      role={timed ? 'button' : undefined} tabIndex={timed ? 0 : undefined}
      aria-label={timed ? `Play from: ${text.slice(range.textStart, range.textEnd)}` : undefined}
      onClick={timed ? activate : undefined}
      onKeyDown={timed ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event) } } : undefined}>
      {renderText(text.slice(range.textStart, range.textEnd), range.textStart)}
    </span>)
    cursor = range.textEnd
  }
  if (cursor < text.length) parts.push(renderText(text.slice(cursor), cursor))
  return parts
}
