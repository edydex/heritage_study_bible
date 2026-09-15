'use client'

import { Logout, useNav } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { churchWorkspaceLinks, isWorkspaceLinkActive } from '@/lib/churchWorkspaceLinks'

export default function AdminNav() {
  const pathname = usePathname()
  const { hydrated, navOpen, navRef, setNavOpen, shouldAnimate } = useNav()
  const className = ['nav', 'heritage-admin-nav', navOpen && 'nav--nav-open',
    hydrated && 'nav--nav-hydrated', shouldAnimate && 'nav--nav-animate'].filter(Boolean).join(' ')
  const link = (href: string, label: string) => <Link key={href} href={href}
    aria-current={isWorkspaceLinkActive(pathname, href) ? 'page' : undefined}>{label}</Link>

  return <aside className={className} inert={!navOpen || undefined}>
    <div className="nav__scroll" ref={navRef}>
      <nav className="heritage-admin-nav__content" aria-label="Church workspace"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setNavOpen(false)
            document.querySelector<HTMLButtonElement>('.template-default__nav-toggler')?.focus()
          }
        }}>
        <div className="heritage-admin-nav__heading">
          <Link href="/admin" className="heritage-admin-nav__brand">Church workspace</Link>
          <button type="button" aria-label="Close workspace menu" onClick={() => setNavOpen(false)}>×</button>
        </div>
        <div className="heritage-admin-nav__primary">
          {churchWorkspaceLinks.map(item => link(item.href, item.label))}
        </div>
        <div className="heritage-admin-nav__secondary">
          <p>Church administration</p>
          {link('/admin/collections/events', 'Events')}
          {link('/admin/collections/memberships', 'People')}
          {link('/admin/collections/community-invites', 'Invitations')}
          {link('/admin/collections/reading-plans', 'Reading plans')}
        </div>
        <div className="heritage-admin-nav__footer">
          <a href="/" target="_blank" rel="noreferrer">Church website ↗</a>
          {link('/admin/account', 'My account')}
          <Logout />
        </div>
      </nav>
    </div>
  </aside>
}
