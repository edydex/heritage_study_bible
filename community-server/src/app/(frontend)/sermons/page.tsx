import Link from 'next/link'
import { formatBibleRange, formatServiceDate, loadPublicSermons } from '@/lib/publicSite'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sermons' }

export default async function SermonsPage() {
  const sermons = await loadPublicSermons().catch(() => [])
  return (
    <main className="site-main page-stack">
      <header className="page-heading">
        <p className="eyebrow">Public library</p>
        <h1>Sermons</h1>
        <p>Messages preached at Word of Truth Bible Church.</p>
      </header>
      {sermons.length ? <div className="sermon-list">
        {sermons.map(sermon => <article key={sermon.id}>
          <div>
            <p className="sermon-list__date">{formatServiceDate(sermon.serviceDate)}</p>
            <h2><Link href={`/sermons/${encodeURIComponent(sermon.id)}`}>{sermon.title}</Link></h2>
            <p>{sermon.speaker.name}</p>
            {sermon.references.length ? <div className="tag-row">
              {sermon.references.slice(0, 3).map((reference, index) => <span key={index}>{formatBibleRange(reference.range)}</span>)}
            </div> : null}
          </div>
          <Link className="text-link" href={`/sermons/${encodeURIComponent(sermon.id)}`}>Open sermon <span aria-hidden="true">→</span></Link>
        </article>)}
      </div> : <div className="empty-state"><h2>No public sermons yet</h2><p>Approved sermons will appear here.</p></div>}
    </main>
  )
}
