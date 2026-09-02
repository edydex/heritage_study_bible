import serviceCore from '../../packages/service-core/index.js'

type UnknownRecord = Record<string, any>

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
