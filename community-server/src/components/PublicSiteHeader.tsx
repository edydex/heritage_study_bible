import Link from 'next/link'

export function PublicSiteHeader({ churchName }: { churchName: string }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/">
          <span className="site-brand__mark" aria-hidden="true">{Array.from(churchName.trim())[0]?.toLocaleUpperCase() || 'H'}</span>
          <span>
            <strong>{churchName}</strong>
            <small>Heritage Community</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/sermons">Sermons</Link>
          <Link href="/songs">Songs</Link>
          <Link className="site-header__live" href="/live"><span aria-hidden="true">●</span> Listen live</Link>
        </nav>
      </div>
    </header>
  )
}
