import { splitParagraphText } from '../utils/verseLayout'

function renderFormattedLine(line, keyPrefix) {
  if (!line.includes('<b>')) return line

  return line.split(/(<b>.*?<\/b>)/g).map((part, index) => {
    const match = part.match(/^<b>(.*?)<\/b>$/)
    if (match) {
      return <strong key={`${keyPrefix}-b${index}`} className="font-bold">{match[1]}</strong>
    }
    return part
  })
}

function ParagraphMarker() {
  return (
    <>
      <span className="sr-only">Paragraph break. </span>
      <span
        aria-hidden="true"
        className="mr-1 select-none text-[0.72em] font-semibold text-amber-600/80 dark:text-amber-400/80"
        title="Paragraph break in the source text"
      >
        ¶
      </span>
    </>
  )
}

export default function VerseText({ text, layout = null }) {
  const { startsParagraph, segments } = splitParagraphText(text)
  const showLeadingMarker = startsParagraph || Boolean(layout?.breakBefore)

  return (
    <>
      {showLeadingMarker && <ParagraphMarker />}
      {segments.map((segment, segmentIndex) => {
        const lines = segment.replace(/\s*\|\|\s*/g, '\n').split('\n')
        return (
          <span key={`paragraph-${segmentIndex}`}>
            {segmentIndex > 0 && (
              <>
                <br />
                <ParagraphMarker />
              </>
            )}
            {lines.map((line, lineIndex) => (
              <span key={`line-${lineIndex}`}>
                {lineIndex > 0 && <><br /><span className="inline-block w-4" /></>}
                {renderFormattedLine(line, `${segmentIndex}-${lineIndex}`)}
              </span>
            ))}
          </span>
        )
      })}
    </>
  )
}
