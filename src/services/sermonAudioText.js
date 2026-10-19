import { sentenceRanges } from './communityAudio'

const clock = value => {
  const parts = value.replace(',', '.').split(':').map(Number)
  return parts.every(value => Number.isFinite(value) && value >= 0) && [2, 3].includes(parts.length)
    && parts.at(-1) < 60 && (parts.length !== 3 || parts[1] < 60)
    ? parts.reduce((total, part) => total * 60 + part, 0) : NaN
}
export function parseCaptionCues(raw) {
  if (typeof raw !== 'string' || raw.length > 1_000_000) return []
  const cues = []
  for (const block of raw.replace(/\r/g, '').trim().split(/\n\s*\n/)) {
    const lines = block.split('\n')
    const index = lines.findIndex(line => line.includes('-->'))
    if (index < 0 || /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue
    const match = lines[index].match(/^(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3})\s+-->\s+(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3})(?:\s.*)?$/)
    if (!match) return []
    const start = clock(match[1]), end = clock(match[2])
    if (!(end > start && start >= 0) || start < (cues.at(-1)?.end ?? 0)) return []
    const text = lines.slice(index + 1).join(' ').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
    if (!text) return []
    cues.push({ start, end, text })
  }
  return cues
}
function normalizedOffsets(text) {
  let value = '', offsets = []
  for (let index = 0; index < text.length; index++) {
    const character = /\s/u.test(text[index]) ? ' ' : text[index]
    if (character === ' ' && (!value || value.endsWith(' '))) continue
    value += character; offsets.push(index)
  }
  if (value.endsWith(' ')) { value = value.slice(0, -1); offsets.pop() }
  return { value, offsets }
}
export function matchingSermonSentences(text, cues, language = 'en', duration) {
  const source = normalizedOffsets(text)
  if (!cues.length || normalizedOffsets(cues.map(cue => cue.text).join(' ')).value !== source.value
    || (duration > 0 && cues.at(-1).end > duration + 0.5)) return []
  let cursor = 0
  const aligned = cues.map(cue => {
    const length = normalizedOffsets(cue.text).value.length
    const next = { ...cue, textStart: source.offsets[cursor], textEnd: source.offsets[cursor + length - 1] + 1 }
    cursor += length + 1
    return next
  })
  const spans = []
  for (const range of sentenceRanges(text, language)) {
    const matches = aligned.filter(cue => cue.textStart < range.end && cue.textEnd > range.start)
    if (!matches.length) continue
    const span = { start: matches[0].start, end: matches.at(-1).end, textStart: range.start, textEnd: range.end }
    const previous = spans.at(-1)
    // A caption spanning two sentences cannot provide two distinct seek points.
    if (previous && span.start < previous.end) { previous.end = span.end; previous.textEnd = span.textEnd }
    else spans.push(span)
  }
  return spans
}
export async function loadSermonCaptions(media, signal) {
  const response = await fetch(media.url, { signal, credentials: 'omit' })
  if (!response.ok) throw new Error('Recording timestamps could not load.')
  if (Number(response.headers.get('content-length')) > 1_000_000) throw new Error('Recording timestamps are too large.')
  return parseCaptionCues(await response.text())
}
export const isTimedTranscript = media => media.kind === 'transcript' && ['text/vtt', 'application/x-subrip'].includes(media.mediaType?.toLowerCase().split(';')[0].trim())
