import serviceCore from '../../packages/service-core/index.js'

type UnknownRecord = Record<string, any>

type PlannerSongDocument = {
  document: UnknownRecord
  arrangementSectionIds: string[]
}

function duplicateMarkerKey(value: string) {
  const normalized = value.trim().normalize('NFKC').toLowerCase()
  const numeric = /^(?:v(?:erse)?\s*)?(\d{1,3})$/.exec(normalized)
  if (numeric) return `verse-${Number.parseInt(numeric[1], 10)}`
  const compact = normalized.replace(/[\s_-]+/g, ' ').trim()
  if (['chorus', 'refrain'].includes(compact)) return 'chorus'
  if (['prechorus', 'pre chorus'].includes(compact)) return 'pre-chorus'
  return compact
}

function duplicateSectionBody(lines: string[]) {
  return lines
    .slice(1)
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim()
}

function collapseIdenticalRepeatedSections(source: string) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  let bodyStart = 0
  if (lines[0]?.trim() === '---') {
    const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
    if (closing > 0) bodyStart = closing + 1
  }

  const preamble: string[] = []
  const blocks: Array<{ marker: string; lines: string[] }> = []
  let current: { marker: string; lines: string[] } | null = null
  for (const line of lines.slice(bodyStart)) {
    const marker = !line.startsWith('^^') ? /^\^([^\s].{0,63})\s*$/.exec(line)?.[1] : null
    if (marker) {
      current = { marker, lines: [line] }
      blocks.push(current)
    } else if (current) {
      current.lines.push(line)
    } else {
      preamble.push(line)
    }
  }

  const firstByMarker = new Map<string, { marker: string; lines: string[] }>()
  const unique: Array<{ marker: string; lines: string[] }> = []
  const arrangementMarkers: string[] = []
  let repeated = false
  for (const block of blocks) {
    const key = duplicateMarkerKey(block.marker)
    const first = firstByMarker.get(key)
    arrangementMarkers.push(block.marker)
    if (!first) {
      firstByMarker.set(key, block)
      unique.push(block)
      continue
    }
    if (duplicateSectionBody(first.lines) !== duplicateSectionBody(block.lines)) return null
    repeated = true
  }
  if (!repeated) return null

  const repairedLines = [
    ...lines.slice(0, bodyStart),
    ...preamble,
    ...unique.flatMap(block => block.lines),
  ]
  return {
    source: repairedLines.join('\n'),
    arrangementMarkers,
  }
}

export function parsePlannerLibrarySongDocument(
  source: string,
  options: { fileName: string },
): PlannerSongDocument {
  try {
    const document = serviceCore.parseSongDocument(source, options)
    return {
      document,
      arrangementSectionIds: document.sections.map((section: UnknownRecord) => section.id),
    }
  } catch (error) {
    const repaired = collapseIdenticalRepeatedSections(source)
    if (!repaired) throw error
    const document = serviceCore.parseSongDocument(repaired.source, options)
    return {
      document,
      arrangementSectionIds: repaired.arrangementMarkers.map(marker => {
        const markerKey = duplicateMarkerKey(marker)
        const section = (document.sections as UnknownRecord[]).find(candidate => (
          [candidate.id, candidate.marker, candidate.label]
            .some(alias => duplicateMarkerKey(String(alias || '')) === markerKey)
        ))
        if (!section) throw error
        return String(section.id)
      }),
    }
  }
}

export function projectFromServiceEnvelope(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Community returned an invalid service response.')
  }
  const envelope = value as UnknownRecord
  const embedded = envelope.project || envelope.document?.project
  if (embedded) return embedded
  if (typeof envelope.documentSource !== 'string' || !envelope.documentSource) {
    throw new Error('Community returned a service without its canonical document.')
  }
  return serviceCore.parseHeritageServiceDocumentSource(envelope.documentSource).project
}
