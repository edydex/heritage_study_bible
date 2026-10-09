export default function VerseNumber({ number, bookmarked = false, selectionMode = false, onToggle, textSize = 18, testId }) {
  const style = { fontSize: `${Math.min(textSize, number > 99 ? 18 : 22)}px` }
  if (selectionMode) {
    return <span className="inline-flex min-w-[1.2em] flex-none select-none justify-center font-semibold text-gray-400 dark:text-gray-400/80" style={style}>{number}</span>
  }
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={`${bookmarked ? 'Remove bookmark from' : 'Bookmark'} verse ${number}`}
      aria-pressed={bookmarked}
      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      onClick={event => { event.stopPropagation(); onToggle?.() }}
      className="relative inline-flex h-[1.2em] min-w-[1.2em] flex-none select-none items-center justify-center px-[0.05em] align-baseline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={style}
    >
      <svg viewBox="0 0 48 48" className={`pointer-events-none absolute left-1/2 top-1/2 h-[1.2em] w-[1.2em] -translate-x-1/2 -translate-y-1/2 ${bookmarked ? 'fill-amber-200/40 stroke-amber-400/60 dark:fill-amber-900/40 dark:stroke-amber-500/60' : 'fill-gray-400/6 stroke-gray-400/20 dark:fill-gray-400/15 dark:stroke-gray-400/30'}`} strokeWidth="1.2" aria-hidden="true">
        <path d="m24 3 6.3 12.8 14.1 2-10.2 9.9 2.4 14L24 35.1l-12.6 6.6 2.4-14L3.6 17.8l14.1-2z" />
      </svg>
      <span className="relative font-semibold text-gray-400 dark:text-gray-400/80">{number}</span>
    </button>
  )
}
