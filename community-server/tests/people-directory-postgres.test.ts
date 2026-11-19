import assert from 'node:assert/strict'
import test from 'node:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'
import { migrations } from '../src/migrations/index.ts'
import { backfillPeopleFromMemberships, ensurePersonForAccount } from '../src/lib/peopleAccounts.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'

const url = process.env.PEOPLE_DIRECTORY_TEST_DATABASE_URL

test('church directory: migration, automatic member profiles, households and role-based privacy',
  { skip: !url, timeout: 180_000 }, async () => {
    assertDisposableLiveDatabase({ databaseUrl: url, expectedDatabase: 'heritage_people_directory_test',
      expectedMarker: 'heritage-people-directory-test-v1', variableName: 'PEOPLE_DIRECTORY_TEST_DATABASE_URL' })
    const pool = new Pool({ connectionString: url })
    const db = drizzle(pool)
    let payload: any
    try {
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
      for (const migration of migrations) await migration.up({ db } as never)
      const resolved = await config
      resolved.db = postgresAdapter({ pool: { connectionString: url }, push: false }) as typeof resolved.db
      resolved.typescript.autoGenerate = false
      payload = await getPayload({ config })

      const church = await payload.create({ collection: 'communities', overrideAccess: true, data: { name: 'Disposable church', slug: 'local-church',
        timeZone: 'America/Los_Angeles', joinPolicy: 'invite', calendarDefaultVisibility: 'members' } })
      const account = async (email: string, displayName: string) => payload.create({ collection: 'users', overrideAccess: true,
        data: { displayName, email, password: 'disposable-local-test-password', systemRole: 'member', accountProtection: 'email', syncGeneration: 1 } })
      const join = async (user: { id: number }, role: string) => payload.create({ collection: 'memberships', overrideAccess: true,
        data: { community: church.id, user: user.id, role, joinedAt: new Date().toISOString() } })

      // Joining the church creates a linked profile in the same transaction.
      const owner = await account('owner@example.invalid', 'Olga Maria Ivanova')
      const leader = await account('leader@example.invalid', 'Reader')
      const member = await account('member@example.invalid', 'Pavel')
      await join(owner, 'owner'); await join(leader, 'leader'); await join(member, 'member')
      const profiles = await pool.query('SELECT user_id, first_name, last_name, full_name, email, status FROM people ORDER BY user_id')
      assert.deepEqual(profiles.rows.map(row => [row.first_name, row.last_name, row.full_name, row.status]), [
        ['Olga Maria', 'Ivanova', 'Olga Maria Ivanova', 'member'], ['leader', null, 'leader', 'member'], ['Pavel', null, 'Pavel', 'member']])

      // Owners manage the directory; an existing profile with the same email is linked, not duplicated.
      const household = await payload.create({ collection: 'households', overrideAccess: false, user: owner,
        data: { name: '  The Late family ', phone: '555-0100', address: { street: '1 Main St', city: 'Seattle', region: 'WA', postalCode: '98101' } } })
      assert.equal(household.name, 'The Late family')
      assert.equal(household.community?.id ?? household.community, church.id, 'the configured church is the default')
      const premade = await payload.create({ collection: 'people', overrideAccess: false, user: owner, data: {
        firstName: 'Alexander', preferredName: 'Sasha', lastName: 'Late', email: ' Late@Example.invalid ', household: household.id,
        householdRole: 'head', birthDate: '1985-03-24', notes: 'Prefers phone calls' } })
      assert.equal(premade.fullName, 'Sasha Late')
      assert.equal(premade.email, 'late@example.invalid')
      const child = await payload.create({ collection: 'people', overrideAccess: false, user: owner, data: {
        firstName: 'Mila', lastName: 'Late', household: household.id, householdRole: 'child', status: 'attender', birthDate: '2016-06-01' } })
      const late = await account('late@example.invalid', 'Alex Late')
      await join(late, 'member')
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM people')).rows[0].n, 5)
      assert.equal((await pool.query('SELECT user_id FROM people WHERE id = $1', [premade.id])).rows[0].user_id, late.id)
      assert.equal(await ensurePersonForAccount(db as never, church.id, late.id), premade.id, 'repeating is harmless')

      // A partial update keeps the display name; changing a name part updates it.
      const updated = await payload.update({ collection: 'people', id: child.id, overrideAccess: false, user: owner, data: { status: 'member' } })
      assert.equal(updated.fullName, 'Mila Late')
      assert.equal((await payload.update({ collection: 'people', id: child.id, overrideAccess: false, user: owner, data: { preferredName: 'Milochka' } })).fullName, 'Milochka Late')
      await assert.rejects(payload.update({ collection: 'people', id: child.id, overrideAccess: false, user: owner, data: { birthDate: '2016-02-30' } }),
        (error: any) => /full date/.test(JSON.stringify(error.data?.errors ?? [])))
      // Church administrators cannot hand a profile someone else's account.
      const relinked = await payload.update({ collection: 'people', id: child.id, overrideAccess: false, user: owner, data: { user: member.id } })
      assert.equal(relinked.user ?? null, null)

      // The household shows its people.
      const withMembers = await payload.findByID({ collection: 'households', id: household.id, overrideAccess: false, user: owner, depth: 0 })
      assert.deepEqual(withMembers.members.docs.map((doc: any) => typeof doc === 'object' ? doc.id : doc).sort(), [premade.id, child.id].sort())

      // Leaders can look people up but never see private notes or change anything.
      const leaderView = await payload.find({ collection: 'people', overrideAccess: false, user: leader, limit: 100 })
      assert.equal(leaderView.totalDocs, 5)
      assert.ok(leaderView.docs.every((doc: any) => doc.notes === undefined))
      const ownerView = await payload.findByID({ collection: 'people', id: premade.id, overrideAccess: false, user: owner })
      assert.equal(ownerView.notes, 'Prefers phone calls')
      await assert.rejects(payload.create({ collection: 'people', overrideAccess: false, user: leader, data: { firstName: 'X' } }), /not allowed/)
      await assert.rejects(payload.update({ collection: 'people', id: child.id, overrideAccess: false, user: leader, data: { status: 'inactive' } }))
      await assert.rejects(payload.delete({ collection: 'households', id: household.id, overrideAccess: false, user: leader }))
      // Members and visitors without a church role see nothing.
      await assert.rejects(payload.find({ collection: 'people', overrideAccess: false, user: member }), /not allowed/)
      await assert.rejects(payload.find({ collection: 'households', overrideAccess: false, user: member }), /not allowed/)
      await assert.rejects(payload.find({ collection: 'people', overrideAccess: false }), /not allowed/)

      // Removing a household keeps its people.
      await payload.delete({ collection: 'households', id: household.id, overrideAccess: false, user: owner })
      assert.deepEqual((await pool.query('SELECT household_id FROM people WHERE id = ANY($1)', [[premade.id, child.id]])).rows, [{ household_id: null }, { household_id: null }])

      // Deleting an account keeps the directory entry; the backfill restores missing member profiles.
      await payload.delete({ collection: 'memberships', where: { user: { equals: member.id } }, overrideAccess: true })
      await payload.delete({ collection: 'users', id: member.id, overrideAccess: true })
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM people WHERE first_name = $1 AND user_id IS NULL', ['Pavel'])).rows[0].n, 1)
      await pool.query('DELETE FROM people WHERE user_id IS NOT NULL')
      assert.equal(await backfillPeopleFromMemberships(db as never), 3)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM people WHERE user_id IS NOT NULL')).rows[0].n, 3)
    } finally {
      if (payload) await payload.destroy()
      await pool.end()
    }
  })
