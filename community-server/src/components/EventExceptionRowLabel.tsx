'use client'

import { useRowLabel } from '@payloadcms/ui'
import { formatServiceDay } from '../lib/serving'
import { useWorkspaceText } from './useWorkspaceText'

/** "Sun, Dec 27 — cancelled" or "Thu, Dec 24 — 18:00 · Christmas Eve service". */
export default function EventExceptionRowLabel() {
  const t = useWorkspaceText()
  const { data } = useRowLabel<{ date?: string; cancelled?: boolean; startTime?: string; title?: string; note?: string }>()
  if (!data?.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return <span>{t('New date change')}</span>
  const what = data.cancelled ? t('cancelled') : [data.startTime, data.title || data.note].filter(Boolean).join(' · ') || t('changed')
  return <span>{formatServiceDay(data.date, t.language)} — {what}</span>
}
