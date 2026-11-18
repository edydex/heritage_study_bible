'use client'

import { Logout, useNav, useTranslation, useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { churchWorkspaceLinks, isWorkspaceLinkActive } from '@/lib/churchWorkspaceLinks'

export default function AdminNav() {
  const pathname = usePathname()
  const { i18n } = useTranslation()
  const { user } = useAuth()
  const ru = i18n.language === 'ru'
  const labels: Record<string, string> = {
    'Workspace home': 'Главная', 'Plan a service': 'Подготовить богослужение', 'Live translation': 'Перевод в прямом эфире',
    'Prepare a sermon': 'Подготовить проповедь', 'Publish sermons': 'Публикация проповедей', 'Song library': 'Песни',
    'Sermon library': 'Проповеди', 'Bible translations': 'Переводы Библии', 'Media library': 'Медиа',
  }
  const { hydrated, navOpen, navRef, setNavOpen, shouldAnimate } = useNav()
  const className = ['nav', 'heritage-admin-nav', navOpen && 'nav--nav-open',
    hydrated && 'nav--nav-hydrated', shouldAnimate && 'nav--nav-animate'].filter(Boolean).join(' ')
  const link = (href: string, label: string) => <Link key={href} href={href}
    aria-current={isWorkspaceLinkActive(pathname, href) || (href === '/admin/people'
      && ['/admin/collections/users', '/admin/collections/memberships', '/admin/collections/community-invites'].some(path => pathname.startsWith(path))) ? 'page' : undefined}>{label}</Link>

  return <aside className={className} inert={!navOpen || undefined}>
    <div className="nav__scroll" ref={navRef}>
      <nav className="heritage-admin-nav__content" aria-label={ru ? 'Рабочая область церкви' : 'Church workspace'}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setNavOpen(false)
            document.querySelector<HTMLButtonElement>('.template-default__nav-toggler')?.focus()
          }
        }}>
        <div className="heritage-admin-nav__heading">
          <Link href="/admin" className="heritage-admin-nav__brand">{ru ? 'Рабочая область церкви' : 'Church workspace'}</Link>
          <button type="button" aria-label={ru ? 'Закрыть меню' : 'Close workspace menu'} onClick={() => setNavOpen(false)}>×</button>
        </div>
        <div className="heritage-admin-nav__primary">
          {churchWorkspaceLinks.map(item => link(item.href, ru ? labels[item.label] : item.label))}
        </div>
        <div className="heritage-admin-nav__secondary">
          <p>{ru ? 'Управление церковью' : 'Church administration'}</p>
          {link('/admin/collections/events', ru ? 'События' : 'Events')}
          {user?.systemRole === 'system-admin' && link('/admin/people', ru ? 'Люди' : 'People')}
          {link('/admin/collections/reading-plans', ru ? 'Планы чтения' : 'Reading plans')}
          {link('/admin/collections/books', ru ? 'Книги' : 'Books')}
        </div>
        <div className="heritage-admin-nav__footer">
          <a href="/" target="_blank" rel="noreferrer">{ru ? 'Сайт церкви ↗' : 'Church website ↗'}</a>
          {link('/admin/account', ru ? 'Моя учётная запись' : 'My account')}
          <Logout />
        </div>
      </nav>
    </div>
  </aside>
}
