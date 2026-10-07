export default function VerseNumber({ number, bookmarked = false, selectionMode = false, onToggle, textSize = 18, testId }) {
  const style = { fontSize: `${Math.max(16, Math.min(textSize, number > 99 ? 18 : 22))}px` }
  if (selectionMode) {
    return <span className="inline-flex min-w-8 flex-none select-none justify-center font-semibold text-gray-500 dark:text-gray-400" style={style}>{number}</span>
  }
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={`${bookmarked ? 'Remove bookmark from' : 'Bookmark'} verse ${number}`}
      aria-pressed={bookmarked}
      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      onClick={event => { event.stopPropagation(); onToggle?.() }}
      className="relative inline-flex h-11 w-11 flex-none select-none items-center justify-center align-middle rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <svg viewBox="0 0 48 48" className={`absolute inset-0 h-full w-full ${bookmarked ? 'fill-amber-200 stroke-amber-500 dark:fill-amber-900 dark:stroke-amber-400' : 'fill-none stroke-gray-400 dark:stroke-gray-500'}`} strokeWidth="1.5" aria-hidden="true">
        <path d="m24 3 6.3 12.8 14.1 2-10.2 9.9 2.4 14L24 35.1l-12.6 6.6 2.4-14L3.6 17.8l14.1-2z" />
      </svg>
      <span className={`relative pt-0.5 font-semibold ${bookmarked ? 'text-amber-950 dark:text-amber-100' : 'text-gray-600 dark:text-gray-300'}`} style={style}>{number}</span>
    </button>
  )
}
