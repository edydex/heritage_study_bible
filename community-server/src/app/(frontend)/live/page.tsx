export const metadata = { title: 'Listen live' }

export default function LivePage() {
  return (
    <main className="live-page">
      <header>
        <div>
          <p className="eyebrow"><span className="live-dot" aria-hidden="true" /> Live service</p>
          <h1>Listen with live translation</h1>
          <p>Choose a language below. Audio becomes available when the church starts the live service.</p>
        </div>
        <a className="text-link" href="https://translate.mayos.dev" target="_blank" rel="noreferrer">Open in a new window ↗</a>
      </header>
      <div className="live-frame">
        <iframe
          allow="autoplay"
          src="https://translate.mayos.dev/?embed=1"
          title="WOTBC live translated audio"
        />
      </div>
      <p className="live-page__help">If audio does not begin, press the play button inside the listener. Headphones are recommended.</p>
    </main>
  )
}
