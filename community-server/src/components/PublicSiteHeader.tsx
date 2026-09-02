import Link from 'next/link'

export function PublicSiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/">
          <span className="site-brand__mark" aria-hidden="true">W</span>
          <span>
            <strong>Word of Truth Bible Church</strong>
            <small>WOTBC Heritage</small>
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
