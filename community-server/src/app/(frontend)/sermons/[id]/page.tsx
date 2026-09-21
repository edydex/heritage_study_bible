import { notFound } from 'next/navigation'
import { formatBibleRange, formatServiceDate, loadPublicSermon } from '@/lib/publicSite'

export const dynamic = 'force-dynamic'

export default async function SermonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sermon = await loadPublicSermon(id).catch(() => null)
  if (!sermon) notFound()
  const playable = sermon.media.filter(item => item.kind === 'audio' || item.kind === 'video')
  return (
    <main className="site-main sermon-detail">
      <header className="sermon-detail__heading">
        <p className="eyebrow">Sermon</p>
        <h1>{sermon.titles[sermon.defaultLanguage] || Object.values(sermon.titles)[0]}</h1>
        <p>{sermon.speaker.name} · {formatServiceDate(sermon.serviceDate)}</p>
        {sermon.references.length ? <div className="tag-row">
          {sermon.references.map((reference, index) => <span key={index}>{formatBibleRange(reference.range)}</span>)}
        </div> : null}
      </header>

      {playable.length ? <section className="media-stack" aria-label="Sermon recordings">
        {playable.map((item, index) => <article key={`${item.url}-${index}`}>
          <h2>{item.title}</h2>
          <p>{item.language.toUpperCase()}</p>
          {item.kind === 'video'
            ? <video controls preload="metadata" src={item.url} />
            : <audio controls preload="metadata" src={item.url} />}
        </article>)}
      </section> : null}

      {sermon.body.length ? <section className="sermon-body">
        {sermon.body.map((entry, index) => <article key={`${entry.language}-${entry.kind}-${index}`}>
          <p className="eyebrow">{entry.language} · {entry.kind.replace('-', ' ')}</p>
          <div className="prose">{entry.text.split(/\n\n+/u).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</div>
        </article>)}
      </section> : null}
    </main>
  )
}
