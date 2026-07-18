import { splitParagraphText } from '../utils/verseLayout'
import { getTextHighlightClasses } from '../utils/highlightColors'

function renderHighlightedText(text, startOffset, highlights, keyPrefix) {
  const boundaries = new Set([0, text.length])
  highlights.forEach(highlight => {
    const start = Math.max(0, Math.min(text.length, highlight.startOffset - startOffset))
    const end = Math.max(0, Math.min(text.length, highlight.endOffset - startOffset))
    if (start < end) {
      boundaries.add(start)
      boundaries.add(end)
    }
  })
  const points = [...boundaries].sort((a, b) => a - b)
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1]
    const value = text.slice(start, end)
    const highlight = highlights.find(item =>
      item.startOffset < startOffset + end && item.endOffset > startOffset + start
    )
    return highlight
      ? <mark key={`${keyPrefix}-h${index}`} data-highlight-color={highlight.color || 'yellow'} className={`rounded-sm px-0 ${getTextHighlightClasses(highlight.color)}`}>{value}</mark>
      : <span key={`${keyPrefix}-t${index}`}>{value}</span>
  })
}

function renderFormattedLine(line, keyPrefix, startOffset, highlights) {
  let cursor = startOffset
  return line.split(/(<b>.*?<\/b>)/g).map((part, index) => {
    const match = part.match(/^<b>(.*?)<\/b>$/)
    const value = match ? match[1] : part
    const rendered = renderHighlightedText(value, cursor, highlights, `${keyPrefix}-${index}`)
    cursor += value.length
    if (match) {
      return <strong key={`${keyPrefix}-b${index}`} className="font-bold">{rendered}</strong>
    }
    return <span key={`${keyPrefix}-p${index}`}>{rendered}</span>
  })
}

function ParagraphMarker() {
  return (
    <>
      <span className="sr-only" data-selection-ignore>Paragraph break. </span>
      <span
        data-selection-ignore
        aria-hidden="true"
        className="mr-1 select-none text-[0.72em] font-semibold text-amber-600/80 dark:text-amber-400/80"
        title="Paragraph break in the source text"
      >
        ¶
      </span>
    </>
  )
}

export default function VerseText({ text, layout = null, highlights = [] }) {
  const { startsParagraph, segments } = splitParagraphText(text)
  const showLeadingMarker = startsParagraph || Boolean(layout?.breakBefore)
  let currentOffset = 0

  return (
    <>
      {showLeadingMarker && <ParagraphMarker />}
      {segments.map((segment, segmentIndex) => {
        const lines = segment.replace(/\s*\|\|\s*/g, '\n').split('\n')
        if (segmentIndex > 0) currentOffset += 1
        return (
          <span key={`paragraph-${segmentIndex}`}>
            {segmentIndex > 0 && (
              <>
                <br />
                <ParagraphMarker />
              </>
            )}
            {lines.map((line, lineIndex) => (
              (() => {
                if (lineIndex > 0) currentOffset += 1
                const lineOffset = currentOffset
                const visibleLength = line.replace(/<\/?b>/g, '').length
                currentOffset += visibleLength
                return (
                  <span key={`line-${lineIndex}`}>
                    {lineIndex > 0 && <><br /><span data-selection-ignore className="inline-block w-4" /></>}
                    {renderFormattedLine(line, `${segmentIndex}-${lineIndex}`, lineOffset, highlights)}
                  </span>
                )
              })()
            ))}
          </span>
        )
      })}
    </>
  )
}
