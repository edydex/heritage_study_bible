import type { Endpoint } from 'payload'
import { randomUUID } from 'node:crypto'
import { createSermonRevision, parseSermonDocument } from '@/lib/syncshow/SermonDocument'
import { createCanonicalSermon, findCanonicalSermon } from '@/lib/syncshow/CanonicalSermonStore'
import { SyncShowProtocolError } from '@/lib/syncShowProtocol'
import { managerContext as sermonManager, assertLiveManager, boundedJson, endpointError } from './sermonPreparations'
import { managerContext, blankServiceDocument, editorError, json } from './serviceDocuments'
import { findServiceDocument, mutateServiceDocument, serviceDocumentResponse } from './syncShow'

export const sermonPresentationEndpoints: Endpoint[] = [
  { path: '/community/sermon-drafts', method: 'post', handler: async req => {
    try {
      const { communityId, userId } = await sermonManager(req)
      const input = await boundedJson(req)
      if (Object.keys(input).sort().join(',') !== 'language,requestId,serviceDate,speaker,title' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(String(input.requestId))) throw new SyncShowProtocolError('INVALID_DRAFT', 'Invalid sermon details or retry identity.', 400)
      if (typeof input.title !== 'string' || input.title.trim().length > 200) throw new SyncShowProtocolError('INVALID_DRAFT', 'Enter a title of at most 200 characters.', 400)
      let revision
      try {
        revision = createSermonRevision({ schemaVersion: 3, kind: 'syncshow-sermon', id: `sermon-${input.requestId}`, titles: { [String(input.language)]: input.title.trim() }, defaultLanguage: input.language,
          speaker: { id: null, name: input.speaker }, serviceDate: input.serviceDate, series: null, outline: [], sources: [], references: [], media: [], body: [],
          publication: { status: 'draft', visibility: 'private', publishedAt: null, canonicalUrl: null } })
      } catch (error) { throw new SyncShowProtocolError('INVALID_DRAFT', (error as Error).message, 400) }
      const result = await createCanonicalSermon(req, communityId, { syncId: revision.document.id, revision: revision.sha256, documentSource: revision.source }, `manager-draft-${input.requestId}`, { authorize: database => assertLiveManager(database, userId, communityId) })
      return json(req, { syncId: revision.document.id, recordId: result.sermon.id }, { status: result.created ? 201 : 200 })
    } catch (error) { return endpointError(req, error) }
  } },
  { path: '/community/sermon-presentations', method: 'get', handler: async req => {
    try {
      const { communityId } = await managerContext(req)
      const found = await req.payload.find({ collection: 'sermons', req, depth: 0, limit: 1000, sort: ['-createdAt', '-id'], overrideAccess: true,
        where: { and: [{ community: { equals: communityId } }, { syncId: { exists: true } }, { syncPublicationStatus: { not_equals: 'archived' } }] } })
      return json(req, { items: found.docs.map(doc => ({ syncId: doc.syncId, recordId: doc.id, title: doc.title, speaker: doc.speaker, serviceDate: String(doc.preachedAt || '').slice(0, 10), createdAt: doc.createdAt })) })
    } catch (error) { return editorError(req, error) }
  } },
  ...(['get', 'post'] as const).map(method => ({ path: '/community/sermon-presentations/:syncId', method, handler: async (req: Parameters<NonNullable<Endpoint['handler']>>[0]) => {
    try {
      const { communityId } = await managerContext(req, method === 'post' ? 'write' : 'read')
      const syncId = String(req.routeParams?.syncId || '')
      const sermon = await findCanonicalSermon(req, communityId, syncId)
      if (!sermon) throw new SyncShowProtocolError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
      const document = parseSermonDocument(String(sermon.syncCurrentDocumentSource))
      if (document.publication.status === 'archived') throw new SyncShowProtocolError('SERMON_ARCHIVED', 'This sermon is archived.', 409)
      const presentationId = `slides-${syncId}`
      let presentation = await findServiceDocument(req, communityId, presentationId)
      if (!presentation && method === 'post') {
        const write = blankServiceDocument({ schemaVersion: 1, requestId: randomUUID(), syncId: presentationId, title: document.titles[document.defaultLanguage].slice(0, 200), serviceDate: document.serviceDate })
        try { presentation = (await mutateServiceDocument(req, communityId, write.write, `presentation-${syncId}`, { sermonPresentationId: Number(sermon.id) })).document }
        catch (error) {
          if (!(error instanceof SyncShowProtocolError) || error.code !== 'SERVICE_DOCUMENT_EXISTS') throw error
          presentation = await findServiceDocument(req, communityId, presentationId)
        }
      }
      if (presentation && (presentation.purpose !== 'sermon' || Number(typeof presentation.sermon === 'object' ? (presentation.sermon as any)?.id : presentation.sermon) !== Number(sermon.id))) throw new SyncShowProtocolError('PRESENTATION_CONFLICT', 'This presentation identity is already in use.', 409)
      return json(req, { serviceDocument: presentation ? serviceDocumentResponse(presentation) : null, sermonDocument: document, sermonRevision: sermon.syncCurrentRevision })
    } catch (error) { return editorError(req, error) }
  } })),
]
