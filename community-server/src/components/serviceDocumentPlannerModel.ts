import { songDocumentBody } from '../lib/songSourceSyntax'
import serviceCore from '../../packages/service-core/index.js'

type UnknownRecord = Record<string, any>

type PlannerSongDocument = {
  document: UnknownRecord
  arrangementSectionIds: string[]
}

export function parsePlannerLibrarySongDocument(source: string, options: { fileName: string }): PlannerSongDocument {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const front = /^---\n[\s\S]*?\n---(?:\n|$)/.exec(normalized)?.[0] || ''
  const body = songDocumentBody(normalized.slice(front.length))
  // Retain repeated occurrences, including changed words/capitalization. Unique
  // canonical IDs keep them editable without discarding a later chorus.
  const counts = new Map<string, number>()
  // Old Community imports wrapped unrecognized headings in numbered sections.
  // Remove only those empty wrappers; keep all actual lyric lines.
  const clean = body.replace(/^\^[^\n]+\n(?:[ \t]*\n)*(?=\^)/gm, '')
  const repaired = clean.split('\n').map(line => {
    const marker = /^\^([^\^].*)$/.exec(line)?.[1]
    if (!marker) return line
    const key = marker.toLowerCase().replace(/[ _]+/g, '-')
    const count = (counts.get(key) || 0) + 1
    counts.set(key, count)
    return `^${marker}${count > 1 ? `-repeat-${count}` : ''}`
  }).join('\n')
  const document = serviceCore.parseSongDocument(front + repaired, options)
  return { document, arrangementSectionIds: document.sections.map((section: UnknownRecord) => section.id) }
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
