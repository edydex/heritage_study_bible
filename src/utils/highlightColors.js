export const DEFAULT_HIGHLIGHT_COLOR = 'yellow'

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Yellow', hex: '#fde047' },
  { id: 'green', label: 'Green', hex: '#86efac' },
  { id: 'blue', label: 'Blue', hex: '#93c5fd' },
  { id: 'pink', label: 'Pink', hex: '#f9a8d4' },
  { id: 'purple', label: 'Purple', hex: '#d8b4fe' },
]

const TEXT_CLASSES = {
  yellow: 'bg-yellow-200 dark:bg-yellow-700/70 dark:text-yellow-50',
  green: 'bg-green-200 dark:bg-green-700/70 dark:text-green-50',
  blue: 'bg-blue-200 dark:bg-blue-700/70 dark:text-blue-50',
  pink: 'bg-pink-200 dark:bg-pink-700/70 dark:text-pink-50',
  purple: 'bg-purple-200 dark:bg-purple-700/70 dark:text-purple-50',
}

const VERSE_CLASSES = {
  yellow: 'bg-yellow-100 dark:bg-yellow-900/35 ring-1 ring-yellow-300 dark:ring-yellow-700',
  green: 'bg-green-100 dark:bg-green-900/35 ring-1 ring-green-300 dark:ring-green-700',
  blue: 'bg-blue-100 dark:bg-blue-900/35 ring-1 ring-blue-300 dark:ring-blue-700',
  pink: 'bg-pink-100 dark:bg-pink-900/35 ring-1 ring-pink-300 dark:ring-pink-700',
  purple: 'bg-purple-100 dark:bg-purple-900/35 ring-1 ring-purple-300 dark:ring-purple-700',
}

const PARALLEL_VERSE_CLASSES = {
  yellow: 'bg-yellow-100 dark:bg-yellow-900/35 border-yellow-300 dark:border-yellow-700',
  green: 'bg-green-100 dark:bg-green-900/35 border-green-300 dark:border-green-700',
  blue: 'bg-blue-100 dark:bg-blue-900/35 border-blue-300 dark:border-blue-700',
  pink: 'bg-pink-100 dark:bg-pink-900/35 border-pink-300 dark:border-pink-700',
  purple: 'bg-purple-100 dark:bg-purple-900/35 border-purple-300 dark:border-purple-700',
}

export function normalizeHighlightColor(color) {
  return HIGHLIGHT_COLORS.some(option => option.id === color) ? color : DEFAULT_HIGHLIGHT_COLOR
}

export function getHighlightHex(color) {
  return HIGHLIGHT_COLORS.find(option => option.id === normalizeHighlightColor(color))?.hex
    || HIGHLIGHT_COLORS[0].hex
}

export function getTextHighlightClasses(color) {
  return TEXT_CLASSES[normalizeHighlightColor(color)]
}

export function getVerseHighlightClasses(color) {
  return color ? VERSE_CLASSES[normalizeHighlightColor(color)] : ''
}

export function getParallelVerseHighlightClasses(color) {
  return color ? PARALLEL_VERSE_CLASSES[normalizeHighlightColor(color)] : ''
}
