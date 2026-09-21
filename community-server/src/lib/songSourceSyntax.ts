/** Tolerate the labels people paste from service decks; preserve every lyric. */
export function songSectionMarker(line: string): string | null {
  let label = line.trim().replace(/^#{1,4}\s+/, '').replace(/^\[([^\]]+)\]$/, '$1').replace(/:$/, '').trim()
  const match = /^(verse|stanza|куплет|chorus|refrain|припев|pre[ -]?chorus|bridge|бридж|tag|intro|вступление|outro|ending|окончание)(?:\s*(\d+))?(?:\s*\(?([a-zа-я])\)?)?$/iu.exec(label)
  if (!match) return null
  const kind = match[1].toLowerCase(), number = match[2] || '', part = (match[3] || '').toLowerCase()
  const base = /^(verse|stanza|куплет)$/.test(kind) ? (number || 'verse')
    : /^(chorus|refrain|припев)$/.test(kind) ? 'chorus'
    : /^pre/.test(kind) ? 'pre-chorus' : /^(bridge|бридж)$/.test(kind) ? 'bridge'
    : /^(intro|вступление)$/.test(kind) ? 'intro' : /^(outro|ending|окончание)$/.test(kind) ? 'outro' : 'tag'
  return base + (!/^(verse|stanza|куплет)$/.test(kind) && number ? `-${number}` : '') + (part ? `-${part}` : '')
}

export function songDocumentBody(lyrics: unknown): string {
  const body = String(lyrics || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/^[ \t]*[-–—]{3,}[ \t]*$/gm, '---').trim()
  if (!body) return ''
  const lines = body.split('\n')
  const explicit = lines.some(line => /^\s*\^(?!\^)/.test(line))
  const headings = lines.some(line => songSectionMarker(line) !== null)
  if (!explicit && !headings) return body.split(/\n\s*\n/).filter(block => block.trim()).map((block, i) => `^${i+1}\n${block}`).join('\n\n')
  return lines.map(line => {
    if (/^\s*\^{2}/.test(line)) return line.trimStart()
    const marker = /^\s*\^\s*(.+?)\s*$/.exec(line)
    if (marker) return `^${songSectionMarker(marker[1]) || marker[1]}`
    if (/^\s*[-–—]{3,}\s*$/.test(line)) return '---'
    const heading = songSectionMarker(line)
    return heading ? `^${heading}` : line.trimEnd()
  }).join('\n')
}
