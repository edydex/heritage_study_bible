'use client'

import Link from 'next/link'
import { SetStepNav } from '@payloadcms/ui'
import { useMemo, useState } from 'react'
import type { PersonDirectoryRow } from '../lib/peopleDirectory'
import {
  addressLines, ageOn, birthdayMonth, buildDirectory, formatDateOnly, HOUSEHOLD_ROLE_LABELS, PERSON_STATUS_LABELS, PERSON_STATUSES,
  peopleCsv, personSearchText, type DirectoryPerson, type HouseholdRecord, type PersonRecord, type PersonStatus,
} from '../lib/peopleProfiles'
import PeopleClient from './PeopleClient'
import { useWorkspaceText } from './useWorkspaceText'

type Tab = 'people' | 'households' | 'accounts'

export default function PeopleDirectory({ people, households, accounts, canView, canEdit, systemAdmin, churchConfigured, initialTab = 'people' }: {
  people: PersonRecord[]; households: HouseholdRecord[]; accounts: PersonDirectoryRow[]
  canView: boolean; canEdit: boolean; systemAdmin: boolean; churchConfigured: boolean; initialTab?: Tab
}) {
  const t = useWorkspaceText()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | PersonStatus>('all')
  const [month, setMonth] = useState(0)
  const directory = useMemo(() => buildDirectory(people, households, t.language), [people, households, t.language])

  const choose = (value: Tab) => {
    setTab(value)
    const url = new URL(window.location.href)
    if (value === 'people') url.searchParams.delete('tab')
    else url.searchParams.set('tab', value)
    window.history.replaceState(null, '', url)
  }

  if (!canView) return <section className="heritage-people">
    <SetStepNav nav={[{ label: t('People') }]} />
    <h1>{t('People')}</h1>
    <p>{t('Church owners, administrators and leaders can see the church directory. Ask your church administrator for access.')}</p>
  </section>

  const query = search.trim().toLocaleLowerCase()
  const shownPeople = directory.people.filter(person => (!query || personSearchText(person).includes(query))
    && (status === 'all' || person.status === status) && (!month || birthdayMonth(person) === month))
  const shownHouseholds = directory.households.filter(household => !query || [household.name, household.phone,
    ...addressLines(household.address), ...household.members.map(personSearchText)].join(' ').toLocaleLowerCase().includes(query))
  const count = (value: PersonStatus) => directory.people.filter(person => person.status === value).length
  const monthName = (value: number) => new Intl.DateTimeFormat(t.language, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, value - 1, 1)))

  const download = () => {
    const blob = new Blob([peopleCsv(shownPeople, households)], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `people-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  const birthday = (person: DirectoryPerson) => {
    if (!person.birthDate) return '—'
    const age = ageOn(person.birthDate)
    return `${formatDateOnly(person.birthDate, t.language, false)}${age != null ? ` (${age})` : ''}`
  }

  const tabs: Array<[Tab, string]> = [['people', t('People')], ['households', t('Households')],
    ...(systemAdmin ? [['accounts', t('Accounts & invitations')] as [Tab, string]] : [])]

  return <section className="heritage-people heritage-directory">
    <SetStepNav nav={[{ label: t('People') }]} />
    <div className="heritage-people__heading">
      <div>
        <h1>{t('People')}</h1>
        <p>{t('People: {people} · Households: {households} · Members: {members} · Regular attenders: {attenders} · Visitors: {visitors}', {
          people: directory.people.length, households: directory.households.length,
          members: count('member'), attenders: count('attender'), visitors: count('visitor') })}</p>
      </div>
      {canEdit && <div className="heritage-directory__actions">
        <Link className="heritage-people__invite" href="/admin/collections/people/create">{t('Add person')}</Link>
        <Link className="heritage-directory__secondary" href="/admin/collections/households/create">{t('Add household')}</Link>
      </div>}
    </div>
    {!churchConfigured && <p role="alert">{t('Set up the church before adding people.')}</p>}
    <div className="heritage-directory__tabs" role="tablist" aria-label={t('People')}>
      {tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value}
        onClick={() => choose(value)}>{label}</button>)}
    </div>

    {tab !== 'accounts' && <div className="heritage-people__filters">
      <label>{t('Search')}<input type="search" value={search} onChange={event => setSearch(event.target.value)}
        placeholder={t('Name, email, phone or household')} /></label>
      {tab === 'people' && <>
        <label>{t('Status')}<select value={status} onChange={event => setStatus(event.target.value as typeof status)}>
          <option value="all">{t('Everyone')} ({directory.people.length})</option>
          {PERSON_STATUSES.map(value => <option key={value} value={value}>{t(PERSON_STATUS_LABELS[value])} ({count(value)})</option>)}
        </select></label>
        <label>{t('Birthdays in')}<select value={month} onChange={event => setMonth(Number(event.target.value))}>
          <option value={0}>{t('Any month')}</option>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{monthName(index + 1)}</option>)}
        </select></label>
        {canEdit && <button type="button" className="heritage-directory__secondary" onClick={download} disabled={!shownPeople.length}>
          {t('Export {count} to CSV', { count: shownPeople.length })}</button>}
      </>}
    </div>}

    {tab === 'people' && <>
      {shownPeople.length > 0 && <div className="heritage-people__table"><table><thead><tr>
        <th>{t('Name')}</th><th>{t('Status')}</th><th>{t('Household')}</th><th>{t('Contact')}</th><th>{t('Birthday')}</th><th>{t('Account')}</th>
      </tr></thead><tbody>{shownPeople.map(person => <tr key={person.id}>
        <td><Link href={`/admin/collections/people/${person.id}`}><strong>{person.fullName}</strong></Link>
          {person.preferredName && <small>{[person.firstName, person.lastName].filter(Boolean).join(' ')}</small>}</td>
        <td><span className={`heritage-people__status heritage-directory__status--${person.status}`}>{t(PERSON_STATUS_LABELS[person.status])}</span></td>
        <td>{person.householdId ? <>
          <Link href={`/admin/collections/households/${person.householdId}`}>{person.householdName}</Link>
          {person.householdRole && <small>{t(HOUSEHOLD_ROLE_LABELS[person.householdRole])}</small>}</> : '—'}</td>
        <td>{person.email && <a href={`mailto:${person.email}`}>{person.email}</a>}
          {person.phone && <a href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}>{person.phone}</a>}
          {!person.email && !person.phone && '—'}</td>
        <td>{birthday(person)}</td>
        <td>{person.hasAccount ? t('Signs in') : '—'}</td>
      </tr>)}</tbody></table></div>}
      {!directory.people.length && <p>{canEdit ? t('No one is in the directory yet. Add a person or a household to start.') : t('No one is in the directory yet.')}</p>}
      {directory.people.length > 0 && !shownPeople.length && <p>{t('No people match your search.')}</p>}
    </>}

    {tab === 'households' && <>
      {shownHouseholds.length > 0 && <div className="heritage-directory__households">{shownHouseholds.map(household => <article key={household.id}>
        <h2><Link href={`/admin/collections/households/${household.id}`}>{household.name}</Link></h2>
        {addressLines(household.address).map(line => <p key={line}>{line}</p>)}
        {household.phone && <p><a href={`tel:${household.phone.replace(/[^\d+]/g, '')}`}>{household.phone}</a></p>}
        {household.members.length ? <ul>{household.members.map(member => <li key={member.id}>
          <Link href={`/admin/collections/people/${member.id}`}>{member.fullName}</Link>
          {member.householdRole && <small> · {t(HOUSEHOLD_ROLE_LABELS[member.householdRole])}</small>}
          {member.householdRole === 'child' && ageOn(member.birthDate) != null && <small> · {t('age {age}', { age: ageOn(member.birthDate)! })}</small>}
        </li>)}</ul> : <p className="heritage-directory__empty">{t('No one in this household yet.')}</p>}
      </article>)}</div>}
      {!directory.households.length && <p>{t('No households yet. A household keeps a family together with one address and home phone.')}</p>}
      {directory.households.length > 0 && !shownHouseholds.length && <p>{t('No households match your search.')}</p>}
    </>}

    {tab === 'accounts' && systemAdmin && <PeopleClient rows={accounts} permitted churchConfigured={churchConfigured} />}
  </section>
}
