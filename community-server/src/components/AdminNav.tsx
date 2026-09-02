'use client'

import { Logout } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminNav() {
  const pathname = usePathname()
  const inPlanner = pathname.endsWith('/plan-service')
  return (
    <nav className="nav heritage-admin-nav" data-planner={inPlanner || undefined}>
      <Link className="heritage-admin-nav__brand" href="/admin">
        <span aria-hidden="true">W</span>
        <strong>WOTBC</strong>
      </Link>
      <div className="heritage-admin-nav__primary">
        <Link href="/admin/plan-service">Plan a service</Link>
        {!inPlanner ? <>
          <Link href="/admin/prepare-sermon">Prepare sermon</Link>
          <Link href="/admin/sermon-publications">Publish sermons</Link>
          <Link href="/admin/collections/songs">Song library</Link>
          <Link href="/admin/collections/sermons">Sermon library</Link>
        </> : null}
      </div>
      {!inPlanner ? <details>
        <summary>More church data</summary>
        <Link href="/admin/collections/media">Media</Link>
        <Link href="/admin/collections/events">Events</Link>
        <Link href="/admin/collections/memberships">People</Link>
        <Link href="/admin/collections/community-invites">Invitations</Link>
        <Link href="/admin/collections/reading-plans">Reading plans</Link>
      </details> : <p className="heritage-admin-nav__planner-note">The service tree is the navigation pane beside the editor.</p>}
      <div className="heritage-admin-nav__footer">
        <a href="/" target="_blank">View church website ↗</a>
        <Link href="/admin/account">My account</Link>
        <Logout />
      </div>
    </nav>
  )
}
