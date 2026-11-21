// Church people and households, shared by the admin directory, the server
// hooks, the migration backfill and tests. Pure: no Node or database imports.

import { csvFile } from './csv'

export const PERSON_STATUSES = ['member', 'attender', 'visitor', 'inactive'] as const
export type PersonStatus = typeof PERSON_STATUSES[number]
export const PERSON_STATUS_LABELS: Record<PersonStatus, string> = {
  member: 'Member', attender: 'Regular attender', visitor: 'Visitor', inactive: 'Inactive',
}

export const HOUSEHOLD_ROLES = ['head', 'spouse', 'child', 'other'] as const
export type HouseholdRole = typeof HOUSEHOLD_ROLES[number]
export const HOUSEHOLD_ROLE_LABELS: Record<HouseholdRole, string> = {
  head: 'Head of household', spouse: 'Spouse', child: 'Child', other: 'Other',
}

export const GENDERS = ['male', 'female'] as const
export type Gender = typeof GENDERS[number]
export const GENDER_LABELS: Record<Gender, string> = { male: 'Male', female: 'Female' }

export const NAME_LIMIT = 80

const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''

/**
 * Account names to first and last name: "Anna Maria Petrova" → "Anna Maria" +
 * "Petrova". Accounts that still have the default name use the email address.
 */
export function splitDisplayName(displayName: unknown, email: unknown): { firstName: string; lastName: string | null } {
  const name = clean(displayName).slice(0, NAME_LIMIT * 2)
  if (!name || name === 'Reader') {
    const local = typeof email === 'string' ? email.split('@')[0].trim() : ''
    return { firstName: (local || 'Unnamed').slice(0, NAME_LIMIT), lastName: null }
  }
  const space = name.lastIndexOf(' ')
  if (space <= 0) return { firstName: name.slice(0, NAME_LIMIT), lastName: null }
  return { firstName: name.slice(0, space).slice(0, NAME_LIMIT), lastName: name.slice(space + 1).slice(0, NAME_LIMIT) }
}

/** The name shown everywhere: the name a person goes by, then the last name. */
export function personFullName(person: { firstName?: unknown; lastName?: unknown; preferredName?: unknown }) {
  return [clean(person.preferredName) || clean(person.firstName), clean(person.lastName)].filter(Boolean).join(' ') || 'Unnamed'
}

// Dates without a time of day (birthdays, membership, baptism) are stored as
// YYYY-MM-DD text, so a birthday never moves a day in another time zone.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDateOnly(value: unknown) {
  if (typeof value !== 'string') return null
  const match = DATE_ONLY.exec(value)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const time = Date.UTC(year, month - 1, day)
  const date = new Date(time)
  if (year < 1850 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, month, day, time }
}

export function validateDateOnly(value: unknown, now = Date.now()): true | string {
  if (value === null || value === undefined || value === '') return true
  const date = parseDateOnly(value)
  if (!date) return 'Enter a full date, for example 1985-03-24.'
  // One day of slack: "today" differs between time zones.
  if (date.time > now + 86_400_000) return 'This date is in the future.'
  return true
}

export function ageOn(birthDate: unknown, now = new Date()) {
  const date = parseDateOnly(birthDate)
  if (!date) return null
  const month = now.getMonth() + 1
  const day = now.getDate()
  let age = now.getFullYear() - date.year
  if (month < date.month || (month === date.month && day < date.day)) age -= 1
  return age >= 0 ? age : null
}

export function formatDateOnly(value: unknown, language = 'en', withYear = true) {
  const date = parseDateOnly(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(language, { timeZone: 'UTC', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
    .format(new Date(date.time))
}

export type Address = {
  street?: string | null; unit?: string | null; city?: string | null
  region?: string | null; postalCode?: string | null; country?: string | null
}

export function addressLines(address: Address | null | undefined) {
  if (!address) return []
  const street = [clean(address.street), clean(address.unit)].filter(Boolean).join(', ')
  const place = [clean(address.city), [clean(address.region), clean(address.postalCode)].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [street, place, clean(address.country)].filter(Boolean)
}

type Relation = number | string | { id: number | string } | null | undefined
export const relationId = (value: Relation) => value && typeof value === 'object' ? Number(value.id) : value == null || value === '' ? null : Number(value)

export type PersonRecord = {
  id: number
  firstName: string
  lastName?: string | null
  preferredName?: string | null
  fullName?: string | null
  status?: PersonStatus | null
  gender?: Gender | null
  household?: Relation
  householdRole?: HouseholdRole | null
  email?: string | null
  phone?: string | null
  birthDate?: string | null
  memberSince?: string | null
  baptismDate?: string | null
  user?: Relation
  notes?: string | null
}

export type HouseholdRecord = { id: number; name: string; phone?: string | null; address?: Address | null }

export type DirectoryPerson = Omit<PersonRecord, 'household' | 'user'> & {
  fullName: string
  status: PersonStatus
  householdId: number | null
  householdName: string | null
  hasAccount: boolean
}

export type DirectoryHousehold = HouseholdRecord & { members: DirectoryPerson[] }

const ROLE_ORDER: Record<string, number> = { head: 0, spouse: 1, other: 2, child: 3 }

function sortKey(person: { lastName?: string | null; firstName?: string | null; preferredName?: string | null }) {
  return `${clean(person.lastName)} ${clean(person.preferredName) || clean(person.firstName)}`.trim()
}

/** People sorted by last name, households with their members (adults first, then children oldest first). */
export function buildDirectory(people: PersonRecord[], households: HouseholdRecord[], language = 'en') {
  const byId = new Map(households.map(household => [household.id, household]))
  const collator = new Intl.Collator(language, { sensitivity: 'base', numeric: true })
  const rows: DirectoryPerson[] = people.map(({ household, user, ...person }) => {
    const householdId = relationId(household)
    return {
      ...person,
      fullName: person.fullName || personFullName(person),
      status: person.status && PERSON_STATUSES.includes(person.status) ? person.status : 'member',
      householdId: householdId && byId.has(householdId) ? householdId : null,
      householdName: householdId ? byId.get(householdId)?.name ?? null : null,
      hasAccount: relationId(user) != null,
    }
  }).sort((a, b) => collator.compare(sortKey(a), sortKey(b)) || a.id - b.id)
  const memberOrder = (a: DirectoryPerson, b: DirectoryPerson) =>
    (ROLE_ORDER[a.householdRole || 'other'] - ROLE_ORDER[b.householdRole || 'other'])
    || (a.householdRole === 'child' ? (a.birthDate || '9999').localeCompare(b.birthDate || '9999') : 0)
    || collator.compare(sortKey(a), sortKey(b))
  const directoryHouseholds: DirectoryHousehold[] = households.map(household => ({
    ...household, members: rows.filter(row => row.householdId === household.id).sort(memberOrder),
  })).sort((a, b) => collator.compare(a.name, b.name) || a.id - b.id)
  return { people: rows, households: directoryHouseholds }
}

/** Text a search box matches against: names, contact details and household. */
export function personSearchText(person: DirectoryPerson) {
  return [person.fullName, person.firstName, person.lastName, person.preferredName, person.email, person.phone, person.householdName]
    .filter(Boolean).join(' ').toLocaleLowerCase()
}

export function birthdayMonth(person: { birthDate?: string | null }) {
  return parseDateOnly(person.birthDate)?.month ?? null
}

/** Directory export for church administrators. Private notes are never exported. */
export function peopleCsv(people: DirectoryPerson[], households: HouseholdRecord[]) {
  const byId = new Map(households.map(household => [household.id, household]))
  const rows: unknown[][] = [[
    'First name', 'Last name', 'Goes by', 'Status', 'Household', 'Household role', 'Email', 'Phone',
    'Birth date', 'Gender', 'Member since', 'Baptism date', 'Household phone', 'Address', 'Has an account',
  ]]
  for (const person of people) {
    const household = person.householdId ? byId.get(person.householdId) : null
    rows.push([
      person.firstName, person.lastName, person.preferredName, PERSON_STATUS_LABELS[person.status], household?.name,
      household && person.householdRole ? HOUSEHOLD_ROLE_LABELS[person.householdRole] : '', person.email, person.phone,
      person.birthDate, person.gender ? GENDER_LABELS[person.gender] : '', person.memberSince, person.baptismDate,
      household?.phone, addressLines(household?.address).join(', '), person.hasAccount ? 'Yes' : 'No',
    ])
  }
  return csvFile(rows)
}
