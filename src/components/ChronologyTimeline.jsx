import { Fragment, useState } from 'react'

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

const PASSAGE_TEXTURES = {
  diagonal: {
    label: 'diagonal stripes',
    backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.3) 0 1px, transparent 1px 7px)',
  },
  vertical: {
    label: 'vertical stripes',
    backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.28) 0 1px, transparent 1px 8px)',
  },
  dotted: {
    label: 'dots',
    backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.42) 0 0.75px, transparent 1px)',
    backgroundPosition: 'center',
    backgroundSize: '7px 100%',
  },
  horizontal: {
    label: 'horizontal stripes',
    backgroundImage: 'linear-gradient(to bottom, transparent 44%, rgba(255,255,255,0.3) 44% 56%, transparent 56%)',
  },
  reverseDiagonal: {
    label: 'reverse diagonal stripes',
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0 1px, transparent 1px 7px)',
  },
  crosshatch: {
    label: 'crosshatch',
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 1px, transparent 1px 8px), repeating-linear-gradient(135deg, rgba(255,255,255,0.22) 0 1px, transparent 1px 8px)',
  },
  wideDiagonal: {
    label: 'wide diagonal stripes',
    backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.28) 0 1px, transparent 1px 10px)',
  },
  dash: {
    label: 'short dashes',
    backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.3) 0 3px, transparent 3px 10px)',
  },
  sparseDots: {
    label: 'sparse dots',
    backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.36) 0 0.75px, transparent 1px)',
    backgroundPosition: 'center',
    backgroundSize: '10px 100%',
  },
}

const PASSAGE_STYLES = {
  jeremiah: {
    dot: 'bg-amber-600 dark:bg-amber-400',
    bar: 'bg-amber-600 dark:bg-amber-400',
    text: 'text-amber-900 dark:text-amber-200',
    texture: PASSAGE_TEXTURES.diagonal,
  },
  kings: {
    dot: 'bg-sky-600 dark:bg-sky-400',
    bar: 'bg-sky-600 dark:bg-sky-400',
    text: 'text-sky-900 dark:text-sky-200',
    texture: PASSAGE_TEXTURES.vertical,
  },
  chronicles: {
    dot: 'bg-violet-600 dark:bg-violet-400',
    bar: 'bg-violet-600 dark:bg-violet-400',
    text: 'text-violet-900 dark:text-violet-200',
    texture: PASSAGE_TEXTURES.dotted,
  },
  wisdom: {
    dot: 'bg-teal-600 dark:bg-teal-400',
    bar: 'bg-teal-600 dark:bg-teal-400',
    text: 'text-teal-900 dark:text-teal-200',
    texture: PASSAGE_TEXTURES.horizontal,
  },
  prophet: {
    dot: 'bg-orange-600 dark:bg-orange-400',
    bar: 'bg-orange-600 dark:bg-orange-400',
    text: 'text-orange-900 dark:text-orange-200',
    texture: PASSAGE_TEXTURES.reverseDiagonal,
  },
  history: {
    dot: 'bg-blue-600 dark:bg-blue-400',
    bar: 'bg-blue-600 dark:bg-blue-400',
    text: 'text-blue-900 dark:text-blue-200',
    texture: PASSAGE_TEXTURES.crosshatch,
  },
  psalm: {
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    bar: 'bg-emerald-600 dark:bg-emerald-400',
    text: 'text-emerald-900 dark:text-emerald-200',
    texture: PASSAGE_TEXTURES.wideDiagonal,
  },
  acts: {
    dot: 'bg-cyan-600 dark:bg-cyan-400',
    bar: 'bg-cyan-600 dark:bg-cyan-400',
    text: 'text-cyan-900 dark:text-cyan-200',
    texture: PASSAGE_TEXTURES.dash,
  },
  letter: {
    dot: 'bg-rose-600 dark:bg-rose-400',
    bar: 'bg-rose-600 dark:bg-rose-400',
    text: 'text-rose-900 dark:text-rose-200',
    texture: PASSAGE_TEXTURES.sparseDots,
  },
  other: {
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    bar: 'bg-emerald-600 dark:bg-emerald-400',
    text: 'text-emerald-900 dark:text-emerald-200',
    texture: PASSAGE_TEXTURES.sparseDots,
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

export function situationalBarGeometry(passage, phases) {
  const phaseIds = phases.map(phase => phase.id)
  const first = phaseIds.indexOf(passage.start)
  const last = phaseIds.indexOf(passage.end || passage.start)
  if (first < 0 || last < 0 || phases.length === 0) return null

  const start = Math.min(first, last)
  const end = Math.max(first, last)
  return {
    left: (start / phases.length) * 100,
    width: ((end - start + 1) / phases.length) * 100,
  }
}

function TimelineDetails({ heading, text, sources, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-6"
      role="presentation"
    >
      <section
        aria-labelledby="timeline-details-title"
        aria-modal="true"
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:max-w-xl sm:rounded-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Timeline details
            </p>
            <h3 id="timeline-details-title" className="mt-1 text-xl font-bold text-gray-950 dark:text-gray-100">
              {heading}
            </h3>
          </div>
          <button
            aria-label="Close timeline details"
            className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {text && (
          <p className="mt-4 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
            {text}
          </p>
        )}

        {sources.length > 0 && (
          <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sources</h4>
            <ul className="mt-2 space-y-2">
              {sources.map(source => (
                <li key={source.key} className="text-sm text-gray-600 dark:text-gray-300">
                  {source.url ? (
                    <a
                      className="text-primary underline underline-offset-2 dark:text-blue-300"
                      href={source.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.title}
                    </a>
                  ) : (
                    source.title
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

function SituationalTimeline({ timeline, detailsText, sources }) {
  const [showDetails, setShowDetails] = useState(false)
  const [activePhaseId, setActivePhaseId] = useState(null)
  const phases = Array.isArray(timeline?.phases)
    ? timeline.phases
      .filter(phase => phase?.id && phase?.label)
      .map(phase => ({
        ...phase,
        anchor: phase?.anchor?.dateLabel && phase?.anchor?.summary
          ? phase.anchor
          : null,
      }))
    : []
  const passages = Array.isArray(timeline?.passages)
    ? timeline.passages
      .map(passage => ({
        ...passage,
        geometry: situationalBarGeometry(passage, phases),
      }))
      .filter(passage => passage?.label && passage.geometry)
    : []

  if (phases.length === 0 || passages.length === 0) return null

  const hasDetails = Boolean(detailsText || sources.length)
  const phaseGridStyle = {
    gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))`,
  }
  const activePhase = phases.find(phase => phase.id === activePhaseId && phase.anchor)
  const activeTooltipId = activePhase ? `timeline-anchor-${activePhase.id}` : undefined

  return (
    <>
      <section
        aria-label={timeline.heading || 'Historical situation'}
        className="mt-2"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Historical situation
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-950 dark:text-gray-100">
              {timeline.heading}
            </h2>
          </div>
          {hasDetails && (
            <button
              className="shrink-0 text-sm font-semibold text-primary underline underline-offset-4 dark:text-blue-300"
              onClick={() => setShowDetails(true)}
              type="button"
            >
              More
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-[6.75rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <div
            className="flex min-h-16 items-center rounded-l-lg border border-gray-300 bg-gray-100 px-2 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            data-passage-column-header
          >
            Passage
          </div>
          <div
            aria-label="Situation phases"
            className="grid overflow-hidden rounded-r-lg border border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
            style={phaseGridStyle}
          >
            {phases.map((phase, index) => (
              <div
                className={`flex min-h-16 items-center justify-center px-0.5 py-2 text-center text-[8px] font-semibold leading-tight tracking-[-0.02em] text-gray-800 dark:text-gray-100 sm:px-1 sm:text-[10px] sm:font-bold sm:tracking-normal ${index > 0 ? 'border-l border-gray-300 dark:border-gray-700' : ''}`}
                key={phase.id}
              >
                {phase.anchor ? (
                  <button
                    aria-describedby={activePhaseId === phase.id ? activeTooltipId : undefined}
                    aria-expanded={activePhaseId === phase.id}
                    className="flex min-h-12 min-w-0 w-full cursor-help items-center justify-center text-[7px] [overflow-wrap:anywhere] underline decoration-dotted underline-offset-2 sm:text-[10px]"
                    data-timeline-anchor={phase.id}
                    onClick={() => setActivePhaseId(current => current === phase.id ? null : phase.id)}
                    type="button"
                  >
                    {phase.label}
                  </button>
                ) : phase.label}
              </div>
            ))}
          </div>
        </div>

        {activePhase && (
          <div className="mt-2 grid grid-cols-[6.75rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
            <div aria-hidden="true" />
            <div
              className="relative rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 pr-9 text-left shadow-sm dark:border-amber-700 dark:bg-amber-950/40"
              id={activeTooltipId}
              role="tooltip"
            >
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {activePhase.anchor.dateLabel}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-gray-700 dark:text-gray-200">
                {activePhase.anchor.summary}
              </p>
              <button
                aria-label="Close timeline anchor"
                className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-sm font-bold text-gray-500 dark:text-gray-300"
                onClick={() => setActivePhaseId(null)}
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <ul className="mt-3 space-y-1.5">
          {passages.map(passage => {
            const styles = PASSAGE_STYLES[passage.source] || PASSAGE_STYLES.other
            return (
              <li
                className="grid min-h-8 grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]"
                key={passage.label}
              >
                <div
                  className={`flex h-full min-w-0 items-center gap-1.5 border-r border-gray-200 pr-2 text-[11px] font-bold leading-tight dark:border-gray-700 ${styles.text}`}
                  data-passage-column={passage.label}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                  <span>{passage.label}</span>
                </div>
                <div className="relative h-6">
                  <div className="absolute inset-0 grid" style={phaseGridStyle}>
                    {phases.map((phase, index) => (
                      <span
                        className={index > 0 ? 'border-l border-gray-200 dark:border-gray-700/70' : ''}
                        key={phase.id}
                      />
                    ))}
                  </div>
                  <div
                    aria-label={`${passage.label}, ${styles.texture.label} pattern, spans ${passage.start} through ${passage.end || passage.start}`}
                    className={`absolute top-2 h-2 rounded-full shadow-sm ${styles.bar}`}
                    data-situation-bar={passage.label}
                    data-timeline-texture={styles.texture.label}
                    style={{
                      backgroundImage: styles.texture.backgroundImage,
                      backgroundPosition: styles.texture.backgroundPosition,
                      backgroundSize: styles.texture.backgroundSize,
                      left: `${passage.geometry.left}%`,
                      width: `${passage.geometry.width}%`,
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {showDetails && (
        <TimelineDetails
          heading={timeline.heading}
          onClose={() => setShowDetails(false)}
          sources={sources}
          text={detailsText}
        />
      )}
    </>
  )
}

function ChronologyTimeline({ timeline, detailsText = '', sources = [] }) {
  if (timeline?.presentation === 'situational') {
    return (
      <SituationalTimeline
        detailsText={detailsText}
        sources={Array.isArray(sources) ? sources : []}
        timeline={timeline}
      />
    )
  }

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
