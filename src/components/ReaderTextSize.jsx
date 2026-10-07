import { useEffect, useRef, useState } from 'react'
import { getStoredValue, setStoredValue, STORAGE_KEYS } from '../services/persistentStorage'

export function useReaderTextSize() {
  const changed = useRef(false)
  const [size, setSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEYS.bookTextSize))
      return saved >= 12 && saved <= 36 ? saved : 18
    } catch { return 18 }
  })
  useEffect(() => {
    let cancelled = false
    getStoredValue(STORAGE_KEYS.bookTextSize).then(value => {
      const saved = Number(value)
      if (!cancelled && !changed.current && saved >= 12 && saved <= 36) setSize(saved)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  const change = value => {
    changed.current = true
    const next = Math.max(12, Math.min(36, value))
    setSize(next)
    setStoredValue(STORAGE_KEYS.bookTextSize, String(next)).catch(() => {})
  }
  return [size, change]
}

export default function ReaderTextSize({ size, onChange }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200" role="group" aria-label="Reading font size">
      <button type="button" aria-label="Decrease reading font size" disabled={size <= 12} onClick={() => onChange(size - 2)} className="min-h-11 min-w-11 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40">A−</button>
      <output aria-label="Reading font size">{size}px</output>
      <button type="button" aria-label="Increase reading font size" disabled={size >= 36} onClick={() => onChange(size + 2)} className="min-h-11 min-w-11 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40">A+</button>
    </div>
  )
}
