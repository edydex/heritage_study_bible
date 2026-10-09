import { useEffect, useRef, useState } from 'react'
import { getStoredValue, setStoredValue, STORAGE_KEYS } from '../services/persistentStorage'

const TEXT_SIZE_CHANGED = 'heritage:reader-text-size-changed'

export function useReaderTextSize() {
  const changed = useRef(false)
  const [size, setSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEYS.bookTextSize))
      return saved >= 12 && saved <= 64 ? saved : 18
    } catch { return 18 }
  })
  useEffect(() => {
    let cancelled = false
    const receiveSize = value => {
      const saved = Number(value)
      if (saved >= 12 && saved <= 64) {
        changed.current = true
        setSize(saved)
      }
    }
    const onChange = event => receiveSize(event.detail)
    const onStorage = event => {
      if (event.key === STORAGE_KEYS.bookTextSize) receiveSize(event.newValue)
    }
    window.addEventListener(TEXT_SIZE_CHANGED, onChange)
    window.addEventListener('storage', onStorage)
    getStoredValue(STORAGE_KEYS.bookTextSize).then(value => {
      const saved = Number(value)
      if (!cancelled && !changed.current && saved >= 12 && saved <= 64) setSize(saved)
    }).catch(() => {})
    return () => {
      cancelled = true
      window.removeEventListener(TEXT_SIZE_CHANGED, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  const change = value => {
    changed.current = true
    if (!Number.isFinite(value)) return
    const next = Math.max(12, Math.min(64, Math.round(value)))
    setSize(next)
    setStoredValue(STORAGE_KEYS.bookTextSize, String(next)).catch(() => {})
    window.dispatchEvent(new CustomEvent(TEXT_SIZE_CHANGED, { detail: next }))
  }
  return [size, change]
}

export default function ReaderTextSize({ size, onChange, label = 'Reading', heading = 'Reading Text', defaultSize = 18 }) {
  const [input, setInput] = useState(String(size))
  useEffect(() => { setInput(String(size)) }, [size])
  const commit = () => {
    const next = Math.max(12, Math.min(64, parseInt(input, 10) || defaultSize))
    onChange(next)
    setInput(String(next))
  }
  const buttonClass = 'flex-1 h-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xl transition-colors disabled:opacity-40'
  return (
    <div role="group" aria-label={`${label} font controls`}>
      <h4 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{heading}</h4>
      <div className="flex items-center gap-1.5 mb-3">
        <button type="button" aria-label={`Decrease ${label.toLowerCase()} font size`} disabled={size <= 12} onClick={() => onChange(size - 1)} className={buttonClass}>−</button>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`${label} font size`}
          value={input}
          onChange={event => setInput(event.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }}
          className="w-14 flex-shrink-0 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-lg py-1.5 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary no-spinners"
        />
        <button type="button" aria-label={`Increase ${label.toLowerCase()} font size`} disabled={size >= 64} onClick={() => onChange(size + 1)} className={buttonClass}>+</button>
      </div>
    </div>
  )
}
