import assert from 'node:assert/strict'
import test from 'node:test'
import type { CollectionConfig } from 'payload'
import {
  createCommunityContent,
  createMemberCommunityContent,
} from '../src/access.ts'
import { Books } from '../src/collections/Books.ts'
import { Commentaries } from '../src/collections/Commentaries.ts'
import { EventRsvps } from '../src/collections/EventRsvps.ts'
import { Events } from '../src/collections/Events.ts'
import { Media } from '../src/collections/Media.ts'
import { PlanCohorts } from '../src/collections/PlanCohorts.ts'
import { PlanNotes } from '../src/collections/PlanNotes.ts'
import { ReadingPlans } from '../src/collections/ReadingPlans.ts'
import { Sermons } from '../src/collections/Sermons.ts'
import { ServicePlans } from '../src/collections/ServicePlans.ts'
import { Songs } from '../src/collections/Songs.ts'

type Membership = {
  community: string | { id: string }
  role: string
  user: string
}

function requestFor(memberships: Membership[], user: Record<string, unknown> | null = {
  id: 'user-1',
  systemRole: 'user',
}) {
  return {
    user,
    payload: {
      find: async (args: Record<string, any>) => {
        assert.equal(args.collection, 'memberships')
        assert.equal(args.overrideAccess, true)
        const clauses = args.where.and as Array<Record<string, any>>
        const expectedUser = clauses.find(clause => clause.user)?.user.equals
        const roles = clauses.find(clause => clause.role)?.role.in as string[] | undefined
        return {
          docs: memberships.filter(membership => (
            membership.user === expectedUser
            && (!roles || roles.includes(membership.role))
          )),
        }
      },
    },
  }
}

async function allowed(
  access: typeof createCommunityContent,
  req: ReturnType<typeof requestFor>,
  data?: Record<string, unknown>,
) {
  return access({ req, data } as never)
}

test('manager create access permits the data-less form probe but keeps supplied communities tenant-bound', async () => {
  const req = requestFor([
    { community: { id: 'church-1' }, role: 'leader', user: 'user-1' },
    { community: 'church-member-only', role: 'member', user: 'user-1' },
  ])

  assert.equal(await allowed(createCommunityContent, req), true)
  assert.equal(await allowed(createCommunityContent, req, {}), true)
  assert.equal(await allowed(createCommunityContent, req, { community: 'church-1' }), true)
  assert.equal(await allowed(createCommunityContent, req, {
    community: { id: 'church-1' },
  }), true)
  assert.equal(await allowed(createCommunityContent, req, {
    community: 'church-member-only',
  }), false)
  assert.equal(await allowed(createCommunityContent, req, {
    community: 'church-elsewhere',
  }), false)
})

test('manager create-form access remains closed without an eligible manager membership', async () => {
  const member = requestFor([
    { community: 'church-1', role: 'member', user: 'user-1' },
  ])
  assert.equal(await allowed(createCommunityContent, member), false)
  assert.equal(await allowed(createCommunityContent, requestFor([], null)), false)
})

test('member create access uses the same probe behavior and rejects a supplied cross-tenant ID', async () => {
  const req = requestFor([
    { community: 'church-1', role: 'member', user: 'user-1' },
  ])

  assert.equal(await allowed(createMemberCommunityContent, req), true)
  assert.equal(await allowed(createMemberCommunityContent, req, {}), true)
  assert.equal(await allowed(createMemberCommunityContent, req, {
    community: 'church-1',
  }), true)
  assert.equal(await allowed(createMemberCommunityContent, req, {
    community: 'church-elsewhere',
  }), false)
  assert.equal(await allowed(createMemberCommunityContent, requestFor([], null)), false)
})

test('system administrators retain create access without a membership lookup', async () => {
  const req = {
    user: { id: 'system-1', systemRole: 'system-admin' },
    payload: {
      find: async () => {
        throw new Error('system administrator access must not query memberships')
      },
    },
  }

  assert.equal(await allowed(createCommunityContent, req as never), true)
  assert.equal(await allowed(createMemberCommunityContent, req as never, {
    community: 'church-elsewhere',
  }), true)
})

test('every collection using the probe fallback still requires community validation', () => {
  const managerCollections: CollectionConfig[] = [
    Books,
    Commentaries,
    Events,
    Media,
    PlanCohorts,
    ReadingPlans,
    Sermons,
    ServicePlans,
    Songs,
  ]
  const memberCollections: CollectionConfig[] = [EventRsvps, PlanNotes]

  for (const [access, collections] of [
    [createCommunityContent, managerCollections],
    [createMemberCommunityContent, memberCollections],
  ] as const) {
    for (const collection of collections) {
      assert.equal(collection.access?.create, access, `${collection.slug} create access`)
      const community = collection.fields.find(field => (
        'name' in field && field.name === 'community'
      ))
      assert.ok(community && 'required' in community && community.required === true,
        `${collection.slug}.community must stay required`)
    }
  }
})
