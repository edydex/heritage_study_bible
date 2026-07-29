import { Fragment } from 'react'

const CERTAINTY_LABELS = {
  anchored: 'Dated',
  approximate: 'Approx.',
  broad: 'Broad range',
  traditional: 'Traditional',
}

const CERTAINTY_STYLES = {
  anchored: {
    badge: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    bar: 'bg-amber-600 dark:bg-amber-400',
  },
  approximate: {
    badge: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
    bar: 'border-2 border-dashed border-sky-600 bg-sky-100 dark:border-sky-400 dark:bg-sky-900/50',
  },
  broad: {
    badge: 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200',
    bar: 'border border-violet-500 bg-violet-200/80 dark:border-violet-400 dark:bg-violet-900/60',
  },
  traditional: {
    badge: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    bar: 'border-2 border-dotted border-gray-500 bg-gray-100 dark:border-gray-400 dark:bg-gray-700',
  },
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function timelinePosition(year, startYear, endYear) {
  const yearValue = Number(year)
  const span = Number(endYear) - Number(startYear)
  if (!Number.isFinite(yearValue) || !Number.isFinite(span) || span === 0) return 0
  return clamp(((yearValue - Number(startYear)) / span) * 100, 0, 100)
}

export function timelineBarGeometry(context, startYear, endYear) {
  const first = timelinePosition(context.startYear, startYear, endYear)
  const last = timelinePosition(context.endYear ?? context.startYear, startYear, endYear)
  const rawLeft = Math.min(first, last)
  const rawWidth = Math.abs(last - first)
  const width = Math.max(rawWidth, 2.25)
  return {
    left: clamp(rawLeft, 0, 100 - width),
    width: clamp(width, 2.25, 100),
  }
}

function ChronologyTimeline({ timeline }) {
  const contexts = Array.isArray(timeline?.contexts)
    ? timeline.contexts.filter(context =>
        context &&
        context.label &&
        context.dateLabel &&
        Number.isFinite(Number(context.startYear)) &&
        Number.isFinite(Number(context.endYear ?? context.startYear))
      )
    : []

  if (
    !timeline ||
    !Number.isFinite(Number(timeline.startYear)) ||
    !Number.isFinite(Number(timeline.endYear)) ||
    contexts.length === 0
  ) {
    return null
  }

  const ticks = Array.isArray(timeline.ticks)
    ? timeline.ticks.filter(tick => tick && Number.isFinite(Number(tick.year)))
    : []

  return (
    <section
      aria-label={timeline.heading || 'Passage chronology'}
      className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/70 dark:bg-amber-950/20 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Where this passage fits
          </p>
          <h3 className="mt-1 text-base font-bold text-gray-950 dark:text-gray-100">
            {timeline.heading || timeline.rangeLabel || 'Historical setting'}
          </h3>
        </div>
        <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">
          Setting, not fulfillment
        </span>
      </div>

      {timeline.rangeLabel && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {timeline.rangeLabel}
        </p>
      )}

      <div className="mt-5 grid grid-cols-[minmax(7.75rem,10.5rem)_minmax(0,1fr)] gap-x-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-4">
        <div className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Attributed context
        </div>
        <div className="relative h-11" aria-hidden="true">
          <div className="absolute left-0 right-0 top-4 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
          <span className="absolute left-0 top-0 text-[10px] font-bold text-gray-700 dark:text-gray-200">
            {timeline.startLabel || timeline.startYear}
          </span>
          <span className="absolute right-0 top-0 text-[10px] font-bold text-gray-700 dark:text-gray-200">
            {timeline.endLabel || timeline.endYear}
          </span>
          {ticks.map((tick, index) => {
            const left = timelinePosition(tick.year, timeline.startYear, timeline.endYear)
            return (
              <span
                key={`${tick.year}-${tick.label || index}`}
                className="absolute top-3 h-3 w-px bg-gray-600 dark:bg-gray-300"
                style={{ left: `${left}%` }}
                title={tick.label || String(tick.year)}
              >
                <span
                  className="absolute top-4 whitespace-nowrap text-[9px] font-medium text-gray-500 dark:text-gray-400"
                  style={{
                    transform: left < 12
                      ? 'translateX(0)'
                      : left > 88
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                  }}
                >
                  {tick.shortLabel || tick.label}
                </span>
              </span>
            )
          })}
        </div>

        <ul className="col-span-2 contents">
          {contexts.map((context, index) => {
            const certainty = CERTAINTY_STYLES[context.certainty] ? context.certainty : 'broad'
            const styles = CERTAINTY_STYLES[certainty]
            const geometry = timelineBarGeometry(context, timeline.startYear, timeline.endYear)
            const startsGroup = context.group && context.group !== contexts[index - 1]?.group

            return (
              <Fragment key={`${context.label}-${context.dateLabel || index}`}>
                {startsGroup && (
                  <li
                    className={`col-span-2 mt-2 rounded-lg bg-amber-100/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-900/35 dark:text-amber-200 ${index === 0 ? '' : 'border-t border-amber-200 dark:border-amber-800'}`}
                    data-timeline-group={context.group}
                  >
                    {context.group}
                  </li>
                )}
                <li
                  className={`col-span-2 grid grid-cols-[minmax(7.75rem,10.5rem)_minmax(0,1fr)] gap-x-3 border-t border-amber-200/70 py-3 dark:border-amber-900/50 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-4 ${context.group ? 'border-l-2 border-l-amber-400 pl-2 dark:border-l-amber-600' : ''}`}
                >
                  <div
                    className="min-w-0"
                  >
                    <p className="text-xs font-bold leading-snug text-gray-900 dark:text-gray-100">
                      {context.label}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-gray-600 dark:text-gray-300">
                      {context.dateLabel}
                    </p>
                    <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${styles.badge}`}>
                      {CERTAINTY_LABELS[certainty]}
                    </span>
                  </div>
                  <div
                    className="relative min-h-12"
                    aria-label={`${context.label}: ${context.dateLabel}; ${CERTAINTY_LABELS[certainty]}`}
                  >
                    <div className="absolute left-0 right-0 top-5 h-px bg-gray-300 dark:bg-gray-600" />
                    <div
                      className={`absolute top-[1.0625rem] h-2.5 rounded-full shadow-sm ${styles.bar}`}
                      data-timeline-bar={context.label}
                      style={{
                        left: `${geometry.left}%`,
                        width: `${geometry.width}%`,
                      }}
                    />
                  </div>
                </li>
              </Fragment>
            )
          })}
        </ul>
      </div>

      <p className="mt-1 border-t border-amber-200/70 pt-3 text-xs leading-relaxed text-gray-600 dark:border-amber-900/50 dark:text-gray-300">
        {timeline.caption || 'Bars show the passage’s attributed historical setting. Dashed or lighter bars mark approximate, broad, or traditional placement.'}
      </p>
    </section>
  )
}

export default ChronologyTimeline
