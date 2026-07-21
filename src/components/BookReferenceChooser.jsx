import { useEffect, useRef, useState } from 'react'

function formatChoice(choice) {
  return `${choice.book} ${choice.chapter}${choice.verse != null ? `:${choice.verse}` : ''}`
}

export default function BookReferenceChooser({ choices, onChoose, onCancel }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const optionRefs = useRef([])

  useEffect(() => {
    setSelectedIndex(0)
    optionRefs.current[0]?.focus()
  }, [choices])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const direction = event.key === 'ArrowDown' ? 1 : -1
        const nextIndex = (selectedIndex + direction + choices.length) % choices.length
        setSelectedIndex(nextIndex)
        optionRefs.current[nextIndex]?.focus()
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        onChoose(choices[selectedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [choices, onCancel, onChoose, selectedIndex])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 px-4 pt-20 sm:pt-24"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-reference-chooser-title"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <h2 id="book-reference-chooser-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Which book did you mean?
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            The first choice is selected. Press Enter to continue.
          </p>
        </div>

        <div className="p-2" role="listbox" aria-label="Matching Bible books">
          {choices.map((choice, index) => {
            const label = formatChoice(choice)
            const selected = index === selectedIndex
            return (
              <button
                key={`${choice.book}-${choice.chapter}-${choice.verse ?? ''}`}
                ref={element => { optionRefs.current[index] = element }}
                type="button"
                role="option"
                aria-selected={selected}
                onFocus={() => setSelectedIndex(index)}
                onPointerMove={() => setSelectedIndex(index)}
                onClick={() => onChoose(choice)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 ${
                  selected
                    ? 'bg-primary/10 text-primary dark:bg-blue-500/20 dark:text-blue-300'
                    : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                  selected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {index + 1}
                </span>
                <span className="font-medium">{label}</span>
                {selected && <span className="ml-auto text-xs font-semibold uppercase tracking-wide">Selected</span>}
              </button>
            )
          })}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 text-right dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
