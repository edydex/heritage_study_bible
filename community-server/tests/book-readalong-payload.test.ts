import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { getPayload, type PayloadRequest } from 'payload'
import test from 'node:test'
import config from '../src/payload.config.ts'
import { bookReadAlongEndpoints } from '../src/endpoints/bookReadAlong.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'
import { communityPublicConfig } from '../src/lib/publicConfig.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'
import { GET as bookContent } from '../src/app/content/[type]/[id]/route.ts'
import { GET as bookCatalog } from '../src/app/catalogs/[type]/route.ts'

test(
  'book audio attachment is atomic and every byte requires current church membership',
  { skip: !process.env.BOOK_TEST_DATABASE_URL },
  async () => {
    assertDisposableLiveDatabase({
      databaseUrl: process.env.BOOK_TEST_DATABASE_URL,
      expectedDatabase: 'book_ci',
      expectedMarker: 'heritage-book-readalong-ci',
      variableName: 'BOOK_TEST_DATABASE_URL',
    })
    const resolved = await config
    const payload = await getPayload({
      config: { ...resolved, onInit: async () => {} },
    })
    try {
      const church =
        (
          await payload.find({
            collection: 'communities',
            where: { slug: { equals: communityPublicConfig.id } },
            overrideAccess: true,
          })
        ).docs[0] ||
        (await payload.create({
          collection: 'communities',
          overrideAccess: true,
          data: {
            name: 'Book test',
            slug: communityPublicConfig.id,
            timeZone: 'UTC',
            joinPolicy: 'invite',
            calendarDefaultVisibility: 'members',
          },
        }))
      const users = await Promise.all(
        ['manager', 'member', 'outsider'].map((role) =>
          payload.create({
            collection: 'users',
            overrideAccess: true,
            data: {
              email: `${role}-${randomUUID()}@example.invalid`,
              password: randomUUID(),
              displayName: role,
              systemRole: 'member',
              accountProtection: 'email',
              syncGeneration: 1,
            },
          }),
        ),
      )
      const memberships = await Promise.all(
        users
          .slice(0, 2)
          .map((user, index) =>
            payload.create({
              collection: 'memberships',
              overrideAccess: true,
              data: {
                community: church.id,
                user: user.id,
                role: index ? 'member' : 'admin',
                joinedAt: new Date().toISOString(),
              },
            }),
          ),
      )
      const tokens = await Promise.all(
        users.map(async (user) => {
          const token = randomUUID()
          await payload.create({
            collection: 'community-sessions',
            overrideAccess: true,
            data: {
              user: user.id,
              tokenHash: hashOpaqueToken(token),
              syncGeneration: 1,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          })
          return token
        }),
      )
      const book = await payload.create({
        collection: 'books',
        overrideAccess: true,
        data: {
          community: church.id,
          title: 'Private fixture',
          slug: randomUUID(),
          author: 'Fixture',
          status: 'published',
          visibility: 'members',
        },
      })
      const bytes = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(512)])
      const sha = createHash('sha256').update(bytes).digest('hex')
      const readAlong = {
        schema: 'heritage-book-readalong/v1',
        language: 'en',
        synthetic: false,
        chapters: [
          {
            id: 'one',
            title: 'One',
            duration: 2,
            audioSha256: sha,
            audioSize: bytes.length,
            paragraphs: [{ id: 'p', kind: 'paragraph', text: 'Hello world.' }],
            words: [
              {
                paragraphId: 'p',
                start: 0,
                end: 1,
                sourceStart: 0,
                sourceEnd: 5,
              },
            ],
          },
        ],
      }
      const request = (
        method: string,
        routeParams: Record<string, string>,
        token?: string,
        body?: Buffer,
        type = 'application/json',
      ) => {
        const request = new Request(
          'http://localhost/api/community/books/test',
          {
            method,
            headers: {
              ...(token ? { authorization: `Community ${token}` } : {}),
              'content-type': type,
              'x-file-size': String(body?.length || 0),
            },
            ...(body ? { body, duplex: 'half' } : ({} as any)),
          },
        )
        return Object.assign(request, {
          payload,
          routeParams,
          context: {},
        }) as unknown as PayloadRequest & Request
      }
      const [upload, attach, audio] = bookReadAlongEndpoints
      const route = { id: String(book.id), sha256: sha }
      assert.equal(
        (
          await upload.handler(
            request('PUT', route, tokens[1], bytes, 'audio/mpeg'),
          )
        ).status,
        403,
      )
      assert.equal(
        (
          await upload.handler(
            request('PUT', route, tokens[0], bytes, 'audio/mpeg'),
          )
        ).status,
        201,
      )
      const response = await attach.handler(
        request(
          'PUT',
          { id: String(book.id) },
          tokens[0],
          Buffer.from(JSON.stringify(readAlong)),
        ),
      )
      assert.equal(response.status, 200, await response.clone().text())
      const stored = await payload.findByID({
        collection: 'books',
        id: book.id,
        overrideAccess: true,
        showHiddenFields: true,
      })
      const broken = JSON.parse(JSON.stringify(stored.readAlong))
      // A realistic timing payload must never round-trip through the ordinary
      // admin form, whose metadata save has a much smaller request limit.
      const largeReadAlong = {
        ...(stored.readAlong as Record<string, unknown>),
        testPadding: 'x'.repeat(2 * 1024 * 1024),
      }
      await payload.update({
        collection: 'books', id: book.id, overrideAccess: true,
        data: { readAlong: largeReadAlong, status: 'draft' } as never,
      })
      const editable = await payload.findByID({
        collection: 'books', id: book.id, overrideAccess: true,
      })
      assert.equal(editable.readAlong, undefined)
      assert.ok(Buffer.byteLength(JSON.stringify(editable)) < 100_000)
      await payload.update({
        collection: 'books', id: book.id, overrideAccess: false, user: users[0],
        data: { status: 'published', description: 'Edited after audio upload' },
      })
      const published = await payload.findByID({
        collection: 'books', id: book.id, overrideAccess: true, showHiddenFields: true,
      })
      assert.equal(published.status, 'published')
      assert.deepEqual(published.readAlong, largeReadAlong)
      await payload.update({
        collection: 'books', id: book.id, overrideAccess: true,
        data: { readAlong: stored.readAlong } as never,
      })
      const contentContext = { params: Promise.resolve({ type: 'books', id: String(book.id) }) }
      const catalogContext = { params: Promise.resolve({ type: 'books' }) }
      for (const token of [undefined, tokens[2]]) {
        assert.equal((await bookContent(request('GET', {}, token), contentContext)).status, 404)
        const catalog = await (await bookCatalog(request('GET', {}, token), catalogContext)).json()
        assert.ok(!catalog.items.some((item: any) => item.id === String(book.id)))
      }
      const content = await bookContent(request('GET', {}, tokens[1]), contentContext)
      assert.equal(content.status, 200)
      assert.equal(content.headers.get('cache-control'), 'private, no-store')
      assert.deepEqual((await content.json()).readAlong, stored.readAlong)
      const memberCatalog = await (await bookCatalog(request('GET', {}, tokens[1]), catalogContext)).json()
      assert.ok(memberCatalog.items.some((item: any) => item.id === String(book.id)))
      broken.chapters[0].audioSha256 = 'f'.repeat(64)
      assert.equal(
        (
          await attach.handler(
            request(
              'PUT',
              { id: String(book.id) },
              tokens[0],
              Buffer.from(JSON.stringify(broken)),
            ),
          )
        ).status,
        422,
      )
      assert.deepEqual(
        (
          await payload.findByID({
            collection: 'books',
            id: book.id,
            overrideAccess: true,
            showHiddenFields: true,
          })
        ).readAlong,
        stored.readAlong,
      )
      const audioRoute = { id: String(book.id), chapterId: 'one' }
      for (const token of [undefined, tokens[2]])
        assert.equal(
          (await audio.handler(request('GET', audioRoute, token))).status,
          404,
        )
      const playable = await audio.handler(
        request('GET', audioRoute, tokens[1]),
      )
      assert.equal(playable.status, 200)
      assert.equal(playable.headers.get('cache-control'), 'private, no-store')
      assert.deepEqual(Buffer.from(await playable.arrayBuffer()), bytes)
      const outsider = (
        await payload.auth({
          headers: new Headers({ authorization: `Community ${tokens[2]}` }),
        })
      ).user
      assert.equal(
        (
          await payload.find({
            collection: 'books',
            overrideAccess: false,
            user: outsider,
            where: { id: { equals: book.id } },
          })
        ).totalDocs,
        0,
      )
      await payload.delete({
        collection: 'memberships',
        id: memberships[1].id,
        overrideAccess: true,
      })
      assert.equal(
        (await audio.handler(request('GET', audioRoute, tokens[1]))).status,
        404,
      )
    } finally {
      const pool = (payload.db as any).pool
      if (pool) {
        const ending = pool.end()
        const timer = setTimeout(() => {
          for (const client of [...(pool._clients || [])]) {
            try {
              client.release?.(true)
            } catch {
              void client.end()
            }
          }
        }, 1000)
        await ending
        clearTimeout(timer)
      }
    }
  },
)
