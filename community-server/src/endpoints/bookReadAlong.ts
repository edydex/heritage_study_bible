import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import type { Endpoint, PayloadRequest } from 'payload'
import {
  normalizeReadAlong,
  canReadBook,
} from '../../packages/book-readalong/index.js'
import { managerContext, json, editorError } from './serviceDocuments'
import { getConfiguredCommunityId } from '../lib/configuredCommunity'
import { communityRequestAccess } from '../lib/communityMemberRequest'
import {
  privateAuthorizationJson,
  publicCorsHeaders,
} from '../lib/publicConfig'
import {
  storePrivateStreamObject,
  sermonMediaObjectKey,
  verifySermonMediaObject,
  openSermonMediaObjectForRead,
} from '../lib/syncshow/SermonMediaStorage'

export const bookNamespace = (communityId: number, bookId: number) =>
  createHash('sha256')
    .update(`heritage-book-audio/v1:${communityId}:${bookId}`)
    .digest('hex')
async function bookForManager(req: PayloadRequest) {
  const { communityId } = await managerContext(req, 'write'),
    id = Number(req.routeParams?.id)
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Book not found.')
  const book: any = await req.payload.findByID({
    collection: 'books',
    id,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
    req,
  })
  if (Number(book.community) !== communityId) throw new Error('Book not found.')
  return { book, id, communityId }
}
const upload: Endpoint = {
  path: '/community/books/:id/audio/:sha256',
  method: 'put',
  handler: async (req) => {
    try {
      const { id, communityId } = await bookForManager(req)
      if (req.headers.get('content-type') !== 'audio/mpeg')
        return json(
          req,
          { error: 'Upload MP3 chapter audio.' },
          { status: 415 },
        )
      const object = await storePrivateStreamObject({
        body: req.body!,
        communityNamespace: bookNamespace(communityId, id),
        expectedSha256: String(req.routeParams?.sha256),
        expectedSize: Number(req.headers.get('x-file-size')),
        maximumBytes: 100 * 1024 * 1024,
        validateHead: (head) =>
          head.length > 3 &&
          (String.fromCharCode(...head.slice(0, 3)) === 'ID3' ||
            (head[0] === 255 && (head[1] & 224) === 224)),
      })
      return json(
        req,
        { sha256: object.sha256, size: object.sizeBytes },
        { status: 201 },
      )
    } catch (error) {
      return editorError(req, error)
    }
  },
}
const attach: Endpoint = {
  path: '/community/books/:id/readalong',
  method: 'put',
  handler: async (req) => {
    try {
      const { id, communityId } = await bookForManager(req)
      if (!req.body)
        return json(
          req,
          { error: 'Read-along data is missing.' },
          { status: 400 },
        )
      const reader = req.body.getReader(),
        chunks: Uint8Array[] = []
      let size = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.length
          if (size > 32 * 1024 * 1024) {
            await reader.cancel()
            return json(
              req,
              { error: 'Book data is too large.' },
              { status: 413 },
            )
          }
          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }
      const readAlong = normalizeReadAlong(
        JSON.parse(Buffer.concat(chunks).toString('utf8')),
      )
      for (const ch of readAlong.chapters)
        await verifySermonMediaObject({
          storageKey: sermonMediaObjectKey(
            bookNamespace(communityId, id),
            ch.audioSha256,
          ),
          sha256: ch.audioSha256,
          sizeBytes: ch.audioSize,
        })
      await req.payload.update({
        collection: 'books',
        id,
        data: { readAlong } as never,
        overrideAccess: true,
        req,
      })
      return json(req, {
        chapters: readAlong.chapters.length,
        words: readAlong.chapters.reduce(
          (n: number, ch: any) => n + ch.words.length,
          0,
        ),
      })
    } catch (error) {
      return json(
        req,
        {
          error:
            error instanceof Error
              ? error.message
              : 'Could not attach this book.',
        },
        { status: 422 },
      )
    }
  },
}
const audio: Endpoint = {
  path: '/community/books/:id/audio/:chapterId',
  method: 'get',
  handler: async (req) => {
    try {
      const communityId = await getConfiguredCommunityId(req.payload),
        id = Number(req.routeParams?.id)
      if (communityId == null || !Number.isSafeInteger(id) || id < 1)
        return privateAuthorizationJson(
          { error: 'Not found.' },
          { status: 404 },
        )
      const book: any = await req.payload.findByID({
        collection: 'books',
        id,
        depth: 0,
        overrideAccess: true,
        showHiddenFields: true,
        req,
      })
      const access = await communityRequestAccess(
        req.payload,
        req.headers,
        communityId,
      )
      if (
        Number(book.community) !== Number(communityId) ||
        !canReadBook(book, access)
      )
        return privateAuthorizationJson(
          { error: 'Not found.' },
          { status: 404 },
        )
      const ch = book.readAlong?.chapters?.find(
        (v: any) => v.id === req.routeParams?.chapterId,
      )
      if (!ch)
        return privateAuthorizationJson(
          { error: 'Not found.' },
          { status: 404 },
        )
      const object = await openSermonMediaObjectForRead({
        storageKey: sermonMediaObjectKey(
          bookNamespace(Number(communityId), id),
          ch.audioSha256,
        ),
        sha256: ch.audioSha256,
        sizeBytes: ch.audioSize,
      })
      const headers = new Headers({
        ...publicCorsHeaders(),
        'Cache-Control': 'private, no-store',
        Vary: 'Authorization, Cookie',
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(ch.audioSize),
        'X-Content-Type-Options': 'nosniff',
        'Accept-Ranges': 'none',
      })
      return new Response(
        Readable.toWeb(object.createReadStream()) as ReadableStream,
        { headers },
      )
    } catch {
      return privateAuthorizationJson({ error: 'Not found.' }, { status: 404 })
    }
  },
}
export const bookReadAlongEndpoints = [upload, attach, audio]
