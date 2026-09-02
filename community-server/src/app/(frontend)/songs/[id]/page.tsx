import { notFound } from 'next/navigation'
import { loadPublicSong } from '@/lib/publicSite'

export const dynamic = 'force-dynamic'

export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await loadPublicSong(id).catch(() => null)
  if (!result) notFound()
  const { song, snapshot } = result
  return (
    <main className="site-main song-detail">
      <header className="page-heading">
        <p className="eyebrow">Song library</p>
        <h1>{song.title}</h1>
        {song.russianTitle && song.russianTitle !== song.title ? <p className="song-detail__translation">{song.russianTitle}</p> : null}
        {song.authors.length ? <p>{song.authors.join(', ')}</p> : null}
      </header>

      {snapshot ? <div className="lyrics-languages">
        {snapshot.documents.map(document => <article key={document.id}>
          <header><span>{document.language.toUpperCase()}</span><h2>{document.title}</h2></header>
          {document.sections.map((section, index) => <section key={`${section.marker}-${index}`}>
            <h3>{section.label || section.marker}</h3>
            {section.slides.map((slide, slideIndex) => <p key={slideIndex}>{slide.lines.map((line, lineIndex) => <span key={lineIndex}>{line}<br /></span>)}</p>)}
          </section>)}
          {document.attribution ? <footer>{document.attribution}</footer> : null}
        </article>)}
      </div> : <section className="rights-notice">
        <h2>Lyrics are not public for this song</h2>
        <p>The title remains searchable, but the church has not approved an anonymous lyrics copy. Church leaders can still use the reviewed private copy while planning services.</p>
      </section>}
    </main>
  )
}
