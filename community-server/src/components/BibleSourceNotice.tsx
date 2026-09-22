import { onlineBibleSource } from '../lib/bible/OnlineBibleSources'

export default function BibleSourceNotice({translationIds}: {translationIds: string[]}) {
  const sources = [...new Set(translationIds)].flatMap(id => {const source = onlineBibleSource(id); return source ? [source] : []})
  if (!sources.length) return null
  return <details className="heritage-bible-source-notice"><summary>Scripture sources &amp; copyright</summary>
    {sources.map(source => <p key={source.id}>{source.copyright} <a href={source.publisherUrl} target="_blank" rel="noopener noreferrer">{source.publisherUrl.replace('https://','')}</a>{source.id === 'LSB' && <> · <a href="https://316publishing.com" target="_blank" rel="noopener noreferrer">316publishing.com</a></>}</p>)}
  </details>
}
