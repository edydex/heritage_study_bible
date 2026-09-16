import './lyrics.css'

export default function SongLyrics({ sections, language = 'en' }) {
  return <div className="song-lyrics" lang={language}>
    {sections.map((section, index) => <section className="song-lyrics__section" key={index}>
      {section.label && <h3>{section.label}</h3>}
      {section.lines.join('\n').split(/\n{2,}/).filter(Boolean).map((paragraph, number) => <p key={number}>{paragraph}</p>)}
    </section>)}
  </div>
}
