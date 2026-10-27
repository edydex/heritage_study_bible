import serviceCore from '../../packages/service-core/index.js'

export type ConflictDraft = { project: Record<string, any>; status: string }
export type ConflictSavedVersion = {
  syncId: string; syncVersion: number; revision: string; documentSource: string;
  status: 'planning' | 'ready' | 'archived' | 'cancelled'; changedAt: string; project: Record<string, any>
}

/** Conflict choices apply only to the exact document and version previewed. */
export function conflictSavedVersion(value: any, syncId: string): ConflictSavedVersion {
  if (!value || value.syncId !== syncId || !Number.isSafeInteger(value.syncVersion) || value.syncVersion < 1
    || typeof value.revision !== 'string' || !value.revision || typeof value.documentSource !== 'string'
    || !['planning','ready','archived','cancelled'].includes(value.status)) {
    throw new Error('Community returned a saved version for an unexpected document.')
  }
  return { ...value, project: serviceCore.parseHeritageServiceDocumentSource(value.documentSource).project }
}

export function sameConflictSavedVersion(left: ConflictSavedVersion, right: ConflictSavedVersion) {
  return left.syncId === right.syncId && left.syncVersion === right.syncVersion
    && left.revision === right.revision && left.documentSource === right.documentSource && left.status === right.status
}

export function conflictDraftSignature(draft: ConflictDraft) {
  return JSON.stringify({ project: draft.project, status: draft.status })
}
