import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  addressLines, ageOn, birthdayMonth, buildDirectory, formatDateOnly, peopleCsv, personFullName, personSearchText,
  splitDisplayName, validateDateOnly,
} from '../src/lib/peopleProfiles'
import { migrations } from '../src/migrations'

test('account names become first and last names; default names fall back to the email address', () => {
  assert.deepEqual(splitDisplayName('  Anna   Maria Petrova ', 'a@b.co'), { firstName: 'Anna Maria', lastName: 'Petrova' })
  assert.deepEqual(splitDisplayName('Иван Петров', 'ivan@b.co'), { firstName: 'Иван', lastName: 'Петров' })
  assert.deepEqual(splitDisplayName('Pastor', 'p@b.co'), { firstName: 'Pastor', lastName: null })
  assert.deepEqual(splitDisplayName('Reader', 'sasha.k@b.co'), { firstName: 'sasha.k', lastName: null })
  assert.deepEqual(splitDisplayName('', ''), { firstName: 'Unnamed', lastName: null })
  assert.equal(personFullName({ firstName: 'Alexander', preferredName: 'Sasha', lastName: 'Kim' }), 'Sasha Kim')
  assert.equal(personFullName({ firstName: ' Ann ', lastName: '' }), 'Ann')
})

test('dates without a time are real calendar dates, never in the future, and never shift a day', () => {
  const now = Date.parse('2026-11-19T12:00:00Z')
  assert.equal(validateDateOnly(null, now), true)
  assert.equal(validateDateOnly('', now), true)
  assert.equal(validateDateOnly('1985-03-24', now), true)
  assert.equal(validateDateOnly('2026-11-20', now), true, 'one day of time-zone slack')
  assert.match(String(validateDateOnly('2027-01-01', now)), /future/)
  assert.match(String(validateDateOnly('1985-02-30', now)), /full date/)
  assert.match(String(validateDateOnly('24.03.1985', now)), /full date/)
  assert.match(String(validateDateOnly('1700-01-01', now)), /full date/)
  assert.equal(ageOn('1985-03-24', new Date(2026, 2, 23)), 40)
  assert.equal(ageOn('1985-03-24', new Date(2026, 2, 24)), 41)
  assert.equal(ageOn('2030-01-01', new Date(2026, 0, 1)), null)
  assert.equal(formatDateOnly('1985-03-24', 'en', false), 'Mar 24')
  assert.equal(formatDateOnly('1985-01-01', 'en'), 'Jan 1, 1985')
  assert.equal(birthdayMonth({ birthDate: '1985-03-24' }), 3)
  assert.equal(birthdayMonth({ birthDate: null }), null)
})

test('the directory sorts by last name and lists each household adults first, then children oldest first', () => {
  const households = [
    { id: 2, name: 'The Petrov family', phone: '555-0100', address: { street: '1 Main St', unit: 'Apt 2', city: 'Seattle', region: 'WA', postalCode: '98101' } },
    { id: 1, name: 'Alone', address: null },
  ]
  const { people, households: grouped } = buildDirectory([
    { id: 1, firstName: 'Maria', lastName: 'Petrova', household: 2, householdRole: 'child', birthDate: '2015-01-01' },
    { id: 2, firstName: 'Ivan', lastName: 'Petrov', household: { id: 2 }, householdRole: 'head', user: 7 },
    { id: 3, firstName: 'Olga', lastName: 'Petrova', household: 2, householdRole: 'spouse', status: 'attender' },
    { id: 4, firstName: 'Anna', lastName: 'Adams', household: 99 },
    { id: 5, firstName: 'Petr', lastName: 'Petrova', household: 2, householdRole: 'child', birthDate: '2012-05-05' },
  ], households)
  assert.deepEqual(people.map(person => person.id), [4, 2, 1, 3, 5])
  assert.equal(people[0].householdId, null, 'a missing household is not shown')
  assert.equal(people[1].hasAccount, true)
  assert.equal(people[1].status, 'member')
  assert.equal(grouped[0].name, 'Alone')
  assert.deepEqual(grouped[1].members.map(person => person.firstName), ['Ivan', 'Olga', 'Petr', 'Maria'])
  assert.deepEqual(addressLines(households[0].address), ['1 Main St, Apt 2', 'Seattle, WA 98101'])
  assert.match(personSearchText(people[1]), /the petrov family/)
})

test('the CSV export has no private notes, blocks spreadsheet formulas and opens in Excel', () => {
  const { people } = buildDirectory([
    { id: 1, firstName: '=cmd()', lastName: 'Kim', email: 'k@b.co', notes: 'pastoral visit', household: 1, householdRole: 'head', birthDate: '1990-01-02' },
  ], [{ id: 1, name: 'Kim', address: { city: 'Tacoma' } }])
  const csv = peopleCsv(people, [{ id: 1, name: 'Kim', address: { city: 'Tacoma' } }])
  assert.ok(csv.startsWith('﻿'))
  assert.doesNotMatch(csv, /pastoral/)
  const [header, row] = csv.slice(1).trim().split('\r\n')
  assert.match(header, /^"First name","Last name"/)
  assert.match(row, /^"'=cmd\(\)","Kim"/)
  assert.match(row, /"Head of household"/)
  assert.match(row, /"Tacoma"/)
})

test('the migration is registered last, backfills members, and the notes field is private', () => {
  assert.equal(migrations.at(-1)?.name, '20261119_120000_people_households')
  const migration = readFileSync(new URL('../src/migrations/20261119_120000_people_households.ts', import.meta.url), 'utf8')
  assert.match(migration, /CREATE UNIQUE INDEX "people_community_user_idx"/)
  assert.match(migration, /"household_id" integer REFERENCES "households"\("id"\) ON DELETE SET NULL/)
  // Test and maintenance cleanups remove a church after its memberships; its directory must not block that.
  assert.equal(migration.match(/REFERENCES "communities"\("id"\) ON DELETE CASCADE/g)?.length, 2)
  assert.match(migration, /backfillPeopleFromMemberships\(db\)/)
  const collection = readFileSync(new URL('../src/collections/People.ts', import.meta.url), 'utf8')
  assert.match(collection, /name: 'notes'[\s\S]*access: \{ read: churchPeopleEditorField/)
  const memberships = readFileSync(new URL('../src/collections/Memberships.ts', import.meta.url), 'utf8')
  assert.match(memberships, /afterChange: \[createProfileForNewMember\]/)
})
