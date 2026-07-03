function JournalTipsBanner({ onDismiss }) {
  return (
    <div
      role="status"
      data-testid="journal-tips-banner"
      className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-gray-200/80 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80"
    >
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">
        <span className="font-medium text-gray-700 dark:text-gray-300">Tip:</span>{' '}
        Double-tap <span className="font-medium text-gray-700 dark:text-gray-300">between verses</span> to add a margin note.
        Double-tap the <span className="font-medium text-gray-700 dark:text-gray-300">notes page</span> on the right to type there.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        data-testid="journal-tips-dismiss"
        className="flex-shrink-0 px-3 py-1 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        Got it
      </button>
    </div>
  )
}

export default JournalTipsBanner
