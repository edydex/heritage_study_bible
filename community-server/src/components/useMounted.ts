'use client'

import { useEffect, useState } from 'react'

/** False during server rendering and the first browser render, true afterwards. */
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
