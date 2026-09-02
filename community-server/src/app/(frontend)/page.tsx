import Link from 'next/link'
import { formatServiceDate, loadPublicSermons } from '@/lib/publicSite'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const sermons = await loadPublicSermons().catch(() => [])
  const latest = sermons[0]
  return (
    <main className="site-main">
      <section className="home-hero">
        <div>
          <p className="eyebrow">Welcome</p>
          <h1>The Word of God,<br />shared faithfully.</h1>
          <p className="home-hero__lead">Listen to recent sermons, find songs our church sings, or join the live service with translated audio.</p>
          <div className="button-row">
            <Link className="button button--primary" href="/live">Listen live</Link>
            <Link className="button" href="/sermons">Browse sermons</Link>
          </div>
        </div>
        <aside className="home-hero__card">
          <span>Sunday worship</span>
          <strong>Word of Truth Bible Church</strong>
          <p>Join us as we read, sing, and hear God’s Word together.</p>
        </aside>
      </section>

      <section className="home-links" aria-label="Church resources">
        <Link href="/sermons"><span>01</span><strong>Sermons</strong><p>Watch, listen, and read along with public messages.</p></Link>
        <Link href="/songs"><span>02</span><strong>Song library</strong><p>Find the songs we sing in English and Russian.</p></Link>
        <Link href="/live"><span>03</span><strong>Live translation</strong><p>Hear the sermon live in the language you need.</p></Link>
      </section>

      {latest ? <section className="latest-sermon">
        <div>
          <p className="eyebrow">Latest sermon</p>
          <h2>{latest.title}</h2>
          <p>{latest.speaker.name} · {formatServiceDate(latest.serviceDate)}</p>
        </div>
        <Link className="button" href={`/sermons/${encodeURIComponent(latest.id)}`}>Open sermon</Link>
      </section> : null}
    </main>
  )
}
