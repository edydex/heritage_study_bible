'use client'

import { useRowLabel } from '@payloadcms/ui'
import { useWorkspaceText } from './useWorkspaceText'

/** Shows each team position by its name ("Vocals ×2") instead of "Position 01". */
export default function PositionRowLabel() {
  const t = useWorkspaceText()
  const { data, rowNumber } = useRowLabel<{ name?: string; needed?: number }>()
  const name = data?.name?.trim() || t('Position {number}', { number: String((rowNumber ?? 0) + 1).padStart(2, '0') })
  return <span>{Number(data?.needed) > 1 ? `${name} ×${data?.needed}` : name}</span>
}
