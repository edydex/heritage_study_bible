import { useEffect, useRef, useState } from 'react'
import { getHighlightHex, HIGHLIGHT_COLORS, normalizeHighlightColor } from '../utils/highlightColors'

export function HighlightColorPicker({ value, onChange, label = 'Highlight color' }) {
  const selectedColor = normalizeHighlightColor(value)

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {HIGHLIGHT_COLORS.map(color => (
          <button
            key={color.id}
            type="button"
            onClick={() => onChange?.(color.id)}
            aria-label={`${color.label} highlight`}
            aria-pressed={selectedColor === color.id}
            title={color.label}
            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform active:scale-95 ${
              selectedColor === color.id
                ? 'border-primary ring-2 ring-primary/25 dark:border-blue-300'
                : 'border-white shadow-sm dark:border-gray-600'
            }`}
          >
            <span
              className="h-7 w-7 rounded-full border border-black/10"
              style={{ backgroundColor: color.hex }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function HoldHighlightAction({
  highlighted = false,
  color,
  disabled = false,
  onClick,
  onChooseColor,
  renderButton,
}) {
  const [showColors, setShowColors] = useState(false)
  const rootRef = useRef(null)
  const holdTimerRef = useRef(null)
  const ignoreClickRef = useRef(false)

  const clearHoldTimer = () => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }

  useEffect(() => {
    if (!showColors) return undefined
    const closeOnOutsidePress = event => {
      if (!rootRef.current?.contains(event.target)) setShowColors(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress, true)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress, true)
  }, [showColors])

  useEffect(() => clearHoldTimer, [])

  const openColors = () => {
    if (disabled) return
    ignoreClickRef.current = true
    setShowColors(true)
  }

  const button = renderButton({
    disabled,
    onClick: event => {
      if (ignoreClickRef.current) {
        ignoreClickRef.current = false
        event?.preventDefault?.()
        return
      }
      onClick?.()
    },
    onPointerDown: event => {
      if (disabled || event.pointerType === 'mouse' && event.button !== 0) return
      clearHoldTimer()
      holdTimerRef.current = window.setTimeout(openColors, 500)
    },
    onPointerUp: clearHoldTimer,
    onPointerCancel: clearHoldTimer,
    onPointerLeave: clearHoldTimer,
    onContextMenu: event => {
      event.preventDefault()
      clearHoldTimer()
      openColors()
    },
  })

  return (
    <div ref={rootRef} className="relative min-w-0">
      {button}
      {showColors && (
        <div className="absolute bottom-full left-1/2 z-[70] mb-2 w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-600 dark:bg-gray-800">
          <HighlightColorPicker
            value={color}
            onChange={nextColor => {
              onChooseColor?.(nextColor)
              setShowColors(false)
            }}
            label="Choose highlight color"
          />
          <p className="mt-2 max-w-52 text-[11px] leading-4 text-gray-500 dark:text-gray-400">
            Tap Highlight next time to reuse {normalizeHighlightColor(color)}.
          </p>
        </div>
      )}
      <span
        className="pointer-events-none absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-black/10"
        style={{ backgroundColor: getHighlightHex(color) }}
        aria-hidden="true"
      />
    </div>
  )
}
