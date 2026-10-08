import { useEffect, useRef, useState } from 'react'
import { getStoredValue, setStoredValue, STORAGE_KEYS } from '../services/persistentStorage'

const MODE_CHANGED = 'heritage:reader-verse-mode-changed'
const parseMode = value => value === 'true' || value === true ? true
  : value === 'false' || value === false ? false : null

export default function useReaderVerseMode() {
  const changed = useRef(false)
  const [enabled, setEnabled] = useState(() => {
    try { return parseMode(localStorage.getItem(STORAGE_KEYS.readerVerseMode)) ?? true }
    catch { return true }
  })
  useEffect(() => {
    let cancelled = false
    const receive = value => {
      const saved = parseMode(value)
      if (saved != null) {
        changed.current = true
        setEnabled(saved)
      }
    }
    const onChange = event => receive(event.detail)
    const onStorage = event => {
      if (event.key === STORAGE_KEYS.readerVerseMode) receive(event.newValue)
    }
    window.addEventListener(MODE_CHANGED, onChange)
    window.addEventListener('storage', onStorage)
    getStoredValue(STORAGE_KEYS.readerVerseMode).then(value => {
      const saved = parseMode(value)
      if (!cancelled && !changed.current && saved != null) setEnabled(saved)
    }).catch(() => {})
    return () => {
      cancelled = true
      window.removeEventListener(MODE_CHANGED, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  const change = value => {
    changed.current = true
    setEnabled(Boolean(value))
    setStoredValue(STORAGE_KEYS.readerVerseMode, String(Boolean(value))).catch(() => {})
    window.dispatchEvent(new CustomEvent(MODE_CHANGED, { detail: Boolean(value) }))
  }
  return [enabled, change]
}
