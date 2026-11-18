'use client'

import Link from 'next/link'
import { SetStepNav, useTranslation } from '@payloadcms/ui'
import { useMemo, useState } from 'react'
import type { PersonDirectoryRow } from '@/lib/peopleDirectory'

export default function PeopleClient({ rows, permitted, churchConfigured }: {
  rows: PersonDirectoryRow[]; permitted: boolean; churchConfigured: boolean
}) {
  const { i18n } = useTranslation()
  const ru = i18n.language === 'ru'
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const pending = rows.filter(row => row.invitationActive).length
  const filtered = useMemo(() => rows.filter(row => (
    `${row.name} ${row.email}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())
    && (filter === 'all' || (filter === 'pending' ? row.invitationActive : row.invitationStatus === filter))
  )), [rows, search, filter])
  const status = { pending: ru ? 'Ожидает принятия' : 'Awaiting acceptance', 'not-sent': ru ? 'Не отправлено' : 'Not sent',
    accepted: ru ? 'Принято' : 'Accepted', revoked: ru ? 'Отозвано' : 'Revoked', none: ru ? 'Без приглашения' : 'No invitation' }
  const roles = { owner: ru ? 'Владелец' : 'Owner', admin: ru ? 'Администратор церкви' : 'Church administrator',
    leader: ru ? 'Руководитель церкви' : 'Church leader', member: ru ? 'Участник' : 'Member' }
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(ru ? 'ru' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
  if (!permitted) return <section className="heritage-people"><h1>{ru ? 'Люди' : 'People'}</h1>
    <p>{ru ? 'Управление людьми доступно администратору сервера. Попросите его отправить приглашение.' : 'A server administrator manages people. Ask them to send an invitation.'}</p></section>
  return <section className="heritage-people">
    <SetStepNav nav={[{ label: ru ? 'Люди' : 'People' }]} />
    <div className="heritage-people__heading"><div><h1>{ru ? 'Люди' : 'People'}</h1>
      <p>{ru ? 'Пригласите по электронной почте. Руководители сами создадут пароль для рабочей области.' : 'Invite by email. Church managers choose their own workspace password.'}</p></div>
      <Link className="heritage-people__invite" href="/admin/collections/community-invites/create">{ru ? 'Пригласить человека' : 'Invite person'}</Link></div>
    {!churchConfigured && <p role="alert">{ru ? 'Настройте церковь перед отправкой приглашений.' : 'Set up the church before inviting people.'}</p>}
    <div className="heritage-people__filters"><label>{ru ? 'Найти человека' : 'Find a person'}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={ru ? 'Имя или почта' : 'Name or email'} /></label>
      <label>{ru ? 'Приглашения' : 'Invitations'}<select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">{ru ? 'Все люди' : 'All people'} ({rows.length})</option>
        <option value="pending">{ru ? 'Ожидают принятия' : 'Awaiting acceptance'} ({pending})</option>
        <option value="accepted">{ru ? 'Принятые' : 'Accepted'}</option><option value="revoked">{ru ? 'Отозванные' : 'Revoked'}</option>
      </select></label></div>
    <p className="heritage-people__mail-note">{ru ? '«Письмо отправлено» означает, что почтовый сервис принял письмо. Получение письма подтверждается после принятия приглашения.' : 'Email sent means the mail service accepted the message. Acceptance confirms that the person used their invitation.'}</p>
    <div className="heritage-people__table"><table><thead><tr>
      <th>{ru ? 'Человек' : 'Person'}</th><th>{ru ? 'Роль в церкви' : 'Church role'}</th><th>{ru ? 'Приглашение' : 'Invitation'}</th>
      <th>{ru ? 'Действует' : 'Invitation active'}</th><th>{ru ? 'Письмо отправлено' : 'Email sent'}</th><th>{ru ? 'Принято' : 'Accepted'}</th>
      <th>{ru ? 'Язык' : 'Language'}</th><th>{ru ? 'Действия' : 'Actions'}</th>
    </tr></thead><tbody>{filtered.map(row => <tr key={row.key}>
      <td><strong>{row.name}</strong><span>{row.email}</span>{row.serverAdmin && <small>{ru ? 'Администратор сервера' : 'Server administrator'}</small>}</td>
      <td>{row.role ? roles[row.role] : (ru ? 'Роль не назначена' : 'No church role')}</td>
      <td><span className={`heritage-people__status heritage-people__status--${row.invitationStatus}`}>{status[row.invitationStatus]}</span></td>
      <td>{row.invitationActive == null ? '—' : row.invitationActive ? (ru ? 'Да' : 'Yes') : (ru ? 'Нет' : 'No')}</td>
      <td>{date(row.emailSentAt)}</td><td>{date(row.acceptedAt)}</td><td>{row.language === 'ru' ? 'Русский' : 'English'}</td>
      <td className="heritage-people__actions">{row.invitationId && <Link href={`/admin/collections/community-invites/${row.invitationId}`}>{ru ? 'Приглашение' : 'Manage invitation'}</Link>}
        {row.membershipId && <Link href={`/admin/collections/memberships/${row.membershipId}`}>{ru ? 'Изменить роль' : 'Change role'}</Link>}
        {!row.invitationId && <Link href={`/admin/collections/community-invites/create?email=${encodeURIComponent(row.email)}`}>{ru ? 'Пригласить' : 'Invite'}</Link>}
        {row.accountId && <Link href={`/admin/collections/users/${row.accountId}`}>{ru ? 'Учётная запись' : 'Account details'}</Link>}</td>
    </tr>)}</tbody></table></div>
    {!filtered.length && <p>{ru ? 'Люди не найдены.' : 'No people match your search.'}</p>}
  </section>
}
