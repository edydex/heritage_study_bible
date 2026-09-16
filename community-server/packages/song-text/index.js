const headingPattern = /^(verse|stanza|chorus|refrain|bridge|ending|куплет|припев|бридж|окончание)\s*(\d*)\s*:?\s*$/iu

// Interpret presentation-only lines for reading without changing stored lyrics
// or removing punctuation inside an actual lyric line.
export function parseSongLyrics(value, { language = 'en', label = '' } = {}) {
  const text = String(value || '').normalize('NFKC').replace(/\r\n?/g, '\n').trim()
  if (!text) return []
  const russian = language === 'ru'
  const lines = text.split('\n').map(line => line.trim())
  const marked = Boolean(label) || lines.some(line => /^\^[\p{L}\d]+$/u.test(line) || headingPattern.test(line))
  const sections = []
  let current = { label, lines: [] }
  const flush = () => {
    while (current.lines.at(-1) === '') current.lines.pop()
    if (current.lines.length) sections.push({ ...current, label: current.label || `${russian ? 'Куплет' : 'Verse'} ${sections.length + 1}` })
    current = { label: '', lines: [] }
  }
  for (const line of lines) {
    const candidate = line.match(headingPattern)
    // A word such as "Refrain" immediately after a heading can itself be
    // lyric text. Do not discard it as an empty second section.
    const heading = current.label && !current.lines.length ? null : candidate
    const marker = line.match(/^\^([\p{L}\d]+)$/u)
    if (heading || marker) {
      flush()
      if (heading) current.label = `${heading[1]}${heading[2] ? ` ${heading[2]}` : ''}`
      else if (/^\d+$/.test(marker[1])) current.label = `${russian ? 'Куплет' : 'Verse'} ${Number(marker[1])}`
      else {
        const name = marker[1].toLowerCase()
        if (['c', 'chorus', 'п', 'припев'].includes(name)) current.label = russian ? 'Припев' : 'Chorus'
        if (['b', 'bridge', 'бридж'].includes(name)) current.label = russian ? 'Бридж' : 'Bridge'
      }
    } else if (/^-{3,}$/.test(line) || !line) {
      if (!line && !marked) flush()
      else if (current.lines.length && current.lines.at(-1) !== '') current.lines.push('')
    } else current.lines.push(line)
  }
  flush()
  return sections
}

export function normalizeSongSections(sections, language = 'en') {
  return (Array.isArray(sections) ? sections : []).flatMap((section, index) => {
    const label = String(section?.label || '').trim()
    const text = (Array.isArray(section?.lines) ? section.lines : []).map(line => String(line?.text ?? line ?? '')).join('\n')
    return parseSongLyrics(text, { language, label: !label || /^section\s+\d+$/i.test(label) ? `${language === 'ru' ? 'Куплет' : 'Verse'} ${index + 1}` : label })
  })
}
