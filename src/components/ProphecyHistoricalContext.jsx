import { Link } from 'react-router-dom'
import { bookToSlug } from '../services/readingPlanProgress'

function ScriptureLinks({ passages }) {
  return <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
    {passages.map(passage => <li key={passage.label}>
      <Link to={`/${bookToSlug(passage.book)}/${passage.chapter}`}
        state={{ scrollToVerse: { book: passage.book, chapter: passage.chapter, verse: passage.verse } }}
        className="text-primary dark:text-blue-300 underline underline-offset-2">
        {passage.label}
      </Link>
    </li>)}
  </ul>
}

export default function ProphecyHistoricalContext({ context }) {
  if (!context?.entries?.length) return null
  const sources = new Map(context.sources.map(source => [source.id, source]))
  return <details className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4" data-prophecy-context>
    <summary className="cursor-pointer py-2 font-semibold text-gray-950 dark:text-gray-100">
      {context.title}
      <span className="block mt-1 text-xs font-normal text-gray-600 dark:text-gray-300">Historical comparisons, with evidence and uncertainties</span>
    </summary>
    <div className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
      <p>{context.introduction}</p>
      <p className="mt-2 text-xs">{context.preparedBy} · Sources checked {context.sourceCheckedOn} · {context.reviewStatus}</p>
      <table role="table" className="mt-4 w-full table-fixed border-collapse block md:table" aria-label="Egypt prophecies and proposed historical connections">
        <caption className="sr-only">Prophecy dates, proposed events, biblical context, historical evidence and limits</caption>
        <thead role="rowgroup" className="sr-only md:not-sr-only md:table-header-group">
          <tr role="row" className="text-left">
            {['Prophecy & its date', 'Proposed event & placement', 'Evidence & limits'].map(label => <th role="columnheader" scope="col" key={label} className="p-3 border-b border-gray-300 dark:border-gray-600">{label}</th>)}
          </tr>
        </thead>
        <tbody role="rowgroup" className="block md:table-row-group">
          {context.entries.map(entry => <tr role="row" key={entry.id} data-prophecy-entry={entry.id} className="block mb-5 rounded-lg border border-gray-300 dark:border-gray-600 md:table-row md:border-x-0 md:rounded-none">
            <th role="rowheader" scope="row" className="block md:table-cell align-top text-left font-normal p-3 md:w-1/4">
              <h3 className="font-semibold text-gray-950 dark:text-gray-100">{entry.title}</h3>
              <ScriptureLinks passages={entry.passages} />
              <p className="mt-2"><span className="font-semibold">Oracle date: </span>{entry.oracleDate}</p>
              <p className="mt-3 text-xs font-semibold border-l-4 border-gray-500 pl-2">{entry.assessment}</p>
            </th>
            <td role="cell" className="block md:table-cell align-top p-3">
              <p className="font-semibold">{entry.eventDate || 'Fulfillment date not established'}</p>
              <p className="mt-2">{entry.event}</p>
              <p className="mt-3"><span className="font-semibold">Where it fits: </span>{entry.placement}</p>
              <ScriptureLinks passages={entry.contextPassages} />
            </td>
            <td role="cell" className="block md:table-cell align-top p-3">
              <p><span className="font-semibold">Why compare them: </span>{entry.connection}</p>
              <p className="mt-3"><span className="font-semibold">Evidence: </span>{entry.evidence}</p>
              <p className="mt-3"><span className="font-semibold">Limits: </span>{entry.limits}</p>
              {entry.sourceIds.length > 0 && <ul className="mt-3 space-y-2">
                {entry.sourceIds.map(id => {
                  const source = sources.get(id)
                  return source ? <li key={id}><a href={source.url} target="_blank" rel="noreferrer" className="text-primary dark:text-blue-300 underline underline-offset-2">{source.title}</a><span className="block text-xs mt-1">{source.kind}</span></li> : null
                })}
              </ul>}
            </td>
          </tr>)}
        </tbody>
      </table>
      <details className="mt-4">
        <summary className="cursor-pointer py-2 font-semibold">About the historical sources</summary>
        <ul className="mt-2 space-y-4">{context.sources.map(source => <li key={source.id}>
          <a href={source.url} target="_blank" rel="noreferrer" className="text-primary dark:text-blue-300 underline underline-offset-2">{source.title}</a>
          <p className="text-xs mt-1">{source.kind}</p>
          <p className="mt-1">{source.note}</p>
        </li>)}</ul>
      </details>
    </div>
  </details>
}
