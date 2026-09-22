/** Tolerate labels pasted from service decks without changing the lyric words. */
export function songSectionMarker(line: string): string | null {
  const label = line.trim().replace(/^#{1,4}\s+/, '').replace(/^\[([^\]]+)\]$/, '$1').replace(/:$/, '').trim()
  const match = /^(verse|stanza|куплет|chorus|refrain|рефрен|припев|pre[ -]?chorus|bridge|бридж|tag|intro|вступление|outro|ending|окончание)(?:\s*(\d+))?(?:\s*\(?([a-zа-я])\)?)?$/iu.exec(label)
  if (!match) return null
  const kind = match[1].toLowerCase(), number = match[2] || '', part = (match[3] || '').toLowerCase()
  const base = /^(verse|stanza|куплет)$/.test(kind) ? (number || 'verse')
    : /^(chorus|припев)$/.test(kind) ? 'chorus' : /^(refrain|рефрен)$/.test(kind) ? 'refrain-section'
    : /^pre/.test(kind) ? 'pre-chorus' : /^(bridge|бридж)$/.test(kind) ? 'bridge'
    : /^(intro|вступление)$/.test(kind) ? 'intro' : /^(outro|ending|окончание)$/.test(kind) ? 'outro' : 'tag'
  return base + (!/^(verse|stanza|куплет)$/.test(kind) && number ? `-${number}` : '') + (part ? `-${part}` : '')
}

function repeatSuffix(text: string) {
  const match = /\s*\(?\s*(?:[xх×]\s*(\d+)|(\d+)\s*(?:times|раза?|раз))\s*\)?\s*:?$/iu.exec(text)
  if (!match) return {label:text,repeat:1}
  const repeat = Number(match[1] || match[2])
  if (repeat < 1 || repeat > 16) throw new Error('Song repeats must be between 1 and 16.')
  return {label:text.slice(0,match.index).trim(),repeat}
}

export function songDocumentBody(lyrics: unknown): string {
  const body = String(lyrics || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/^[ \t]*[-–—]{3,}[ \t]*$/gm, '---').trim()
  if (!body) return ''
  const heading = (line: string) => {
    if (/^\s*\^{2}/.test(line)) return null // lyric parser's explicit slide marker
    const explicit = /^\s*\^\s*(.+?)\s*$/.exec(line)
    const {label,repeat} = repeatSuffix((explicit?.[1] || line.trim()).replace(/^repeat\s+/i,''))
    const id = songSectionMarker(label) || (explicit ? label : null)
    return id ? {id,repeat,explicit:Boolean(explicit)} : null
  }
  const lines = body.split('\n')
  if (!lines.some(line=>heading(line))) return body.split(/\n\s*\n/).filter(block=>block.trim()).map((block,i)=>`^${i+1}\n${block}`).join('\n\n')
  type Section = {id:string; repeat:number; explicit:boolean; lines:string[]}
  const sections: Section[] = []; let current: Section | null = null
  for (const line of lines) {
    const label = heading(line)
    if (label) { current={...label,lines:[]}; sections.push(current); continue }
    const repeat = repeatSuffix(line.trim())
    if (current && repeat.label === '' && repeat.repeat > 1) { current.repeat=repeat.repeat; continue }
    if (!current) { if (!line.trim()) continue; current={id:'intro',repeat:1,explicit:false,lines:[]}; sections.push(current) }
    current.lines.push(line.trimEnd())
  }
  // Some pasted songs label a whole verse '1a' even though no '1b' exists.
  // Normalize that unambiguous single part so EN/RU retain matching sections.
  const originalIds = sections.map(section => section.id)
  for (const section of sections) {
    const single = /^(\d+)-[aа]$/iu.exec(section.id)
    if (single && !originalIds.some(other => other !== section.id && (other === single[1] || other.startsWith(`${single[1]}-`)))) section.id = single[1]
  }
  const definitions = new Map<string,string[]>()
  const output: string[] = []
  for (const section of sections) {
    const key = section.id.toLowerCase().replace(/-repeat-\d+$/, '')
    let content = section.lines.join('\n').trim()
    if (content) definitions.set(key, [content])
    else {
      // Earlier imports put empty numbered wrappers before real headings.
      if (section.explicit && /^\d+$/.test(section.id) && !definitions.has(key)) continue
      const exact = definitions.get(key)
      const parts = exact || [...definitions.entries()].filter(([id])=>new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}-[a-zа-я]$`,'u').test(id)).flatMap(([,values])=>values)
      if (!parts.length) throw new Error(`The song refers to “${section.id}” before its words are defined. Add that section's lyrics first.`)
      content=parts.join('\n---\n')
    }
    for (let count=0;count<section.repeat;count++) output.push(`^${section.id}\n${content}`)
    if (output.length > 1000) throw new Error('The expanded song has too many sections.')
  }
  return output.join('\n\n')
}
