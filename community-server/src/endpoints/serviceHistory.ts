import type { Endpoint, Where } from 'payload'
import { managerContext, editorError, json, responseHeaders } from './serviceDocuments'
import { findServiceDocument, serviceDocumentResponse } from './syncShow'
import { SyncShowProtocolError } from '../lib/syncShowProtocol'
import serviceCore from '../../packages/service-core/node.js'
import { readServiceDocumentAsset, serviceDocumentAssetId, ServiceDocumentAssetError } from '../lib/syncshow/ServiceDocumentAssetStore'
import { groupServiceHistory, type ServiceHistoryEntry } from '../lib/serviceVersionHistory'

async function context(req: Parameters<NonNullable<Endpoint['handler']>>[0]) {
  const { communityId } = await managerContext(req)
  const syncId = String(req.routeParams?.syncId || '')
  const document = await findServiceDocument(req, communityId, syncId)
  if (!document) throw new SyncShowProtocolError('SERVICE_NOT_FOUND', 'Service not found.', 404)
  const scope: Where[] = [{ community: { equals: communityId } }, { serviceDocument: { equals: Number(document.id) } }]
  return { communityId, document, scope }
}

async function selectedVersion(req: Parameters<NonNullable<Endpoint['handler']>>[0]) {
  const { communityId, document, scope } = await context(req)
  const syncVersion = Number(req.routeParams?.syncVersion)
  if (!Number.isSafeInteger(syncVersion) || syncVersion < 1) throw new SyncShowProtocolError('INVALID_VERSION', 'Version is invalid.', 400)
  const found = await req.payload.find({ collection: 'syncshow-service-document-changes', req, overrideAccess: true, showHiddenFields: true, depth: 0, limit: 1,
    where: { and: [...scope, { syncVersion: { equals: syncVersion } }] } })
  const change = found.docs[0]
  if (!change) throw new SyncShowProtocolError('VERSION_NOT_FOUND', 'This version was not found.', 404)
  return { communityId, document: { ...document, ...change, syncId: document.syncId, id: document.id } }
}

export const serviceHistoryEndpoints: Endpoint[] = [
  { path: '/community/service-documents/:syncId/history', method: 'get', handler: async req => {
    try {
      const { document, scope } = await context(req)
      const page = Number(req.query?.page || 1)
      if (!Number.isSafeInteger(page) || page < 1) throw new SyncShowProtocolError('INVALID_PAGE', 'History page is invalid.', 400)
      const changes = await req.payload.find({ collection: 'syncshow-service-document-changes', req, overrideAccess: true, showHiddenFields: true,
        depth: 0, limit: 100, page, sort: '-syncVersion', where: { and: scope } })
      const versions = changes.docs.map(change => Number(change.syncVersion))
      if (!versions.length) return json(req, { groups: [], hasNextPage: false, page })
      const saves = await req.payload.find({ collection: 'service-document-saves', req, overrideAccess: true, depth: 0, limit: 2000, sort: '-savedAt',
        where: { and: [...scope, { syncVersion: { in: versions } }] } })
      const entries: ServiceHistoryEntry[] = saves.docs.map(save => ({ id: `save-${save.id}`, syncVersion: Number(save.syncVersion), revision: String(save.revision),
        savedAt: String(save.savedAt), saveKind: save.saveKind, savedBy: String(save.savedBy) }))
      const covered = new Set(entries.map(entry => entry.syncVersion))
      for (const change of changes.docs) if (!covered.has(Number(change.syncVersion))) entries.push({ id: `version-${change.syncVersion}`,
        syncVersion: Number(change.syncVersion), revision: String(change.revision), savedAt: String(change.changedAt), saveKind: 'legacy', savedBy: 'Church workspace' })
      return json(req, { groups: groupServiceHistory(entries), page, hasNextPage: changes.hasNextPage, currentVersion: document.syncVersion })
    } catch (error) { return editorError(req, error) }
  } },
  { path: '/community/service-documents/:syncId/history/:syncVersion', method: 'get', handler: async req => {
    try {
      const { document } = await selectedVersion(req)
      // Only the selected content envelope is returned. The internal journal
      // and other churches' history never reach the browser.
      return json(req, { serviceDocument: serviceDocumentResponse(document as any) })
    } catch (error) { return editorError(req, error) }
  } },
  { path: '/community/service-documents/:syncId/history/:syncVersion/assets/:assetId', method: 'get', handler: async req => {
    try {
      const { communityId, document } = await selectedVersion(req)
      const identity = serviceDocumentAssetId(req.routeParams?.assetId)
      const historical = serviceCore.parseHeritageServiceDocumentSource(String(document.documentSource || ''))
      const asset = historical.project.assets[identity.id]
      if (!asset || !['image','video'].includes(asset.kind)) throw new ServiceDocumentAssetError('SERVICE_ASSET_NOT_FOUND', 'That media file is not part of this saved version.', 404)
      const bytes = await readServiceDocumentAsset(communityId, asset)
      return new Response(new Uint8Array(bytes), { headers: responseHeaders(req, {
        'Content-Type': asset.mediaType, 'Content-Length': String(asset.size), ETag: `"${asset.sha256}"`,
      }) })
    } catch (error) { return editorError(req, error) }
  } },
]
