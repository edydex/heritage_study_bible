'use client'

import { useMemo } from 'react'
import { allTimeZones, canonicalTimeZone, COMMON_TIME_ZONES, timeZoneLabel } from '../../packages/calendar-core/index.js'
import { useMounted } from './useMounted'
import { useWorkspaceText } from './useWorkspaceText'

/** A time zone picker with the usual church zones first, labelled like "Pacific Time — Los Angeles (UTC−8)". */
export default function TimeZoneSelect({ value, onChange, id, disabled, required }: {
  value: string; onChange: (zone: string) => void; id?: string; disabled?: boolean; required?: boolean
}) {
  const t = useWorkspaceText()
  // The server and each browser know slightly different zone lists, so the list is filled in after loading.
  const mounted = useMounted()
  const current = canonicalTimeZone(value) || ''
  const [common, rest] = useMemo(() => {
    const label = (zone: string) => ({ zone, label: timeZoneLabel(zone, t.language) })
    const commonZones = COMMON_TIME_ZONES.map(label)
    const others = allTimeZones().filter(zone => !COMMON_TIME_ZONES.includes(zone)).map(label)
      .sort((a, b) => a.zone.localeCompare(b.zone))
    return [commonZones, others]
  }, [t.language])
  const known = !current || COMMON_TIME_ZONES.includes(current) || rest.some(item => item.zone === current)
  if (!mounted) return <select id={id} value={current} disabled={disabled} required={required} onChange={event => onChange(event.target.value)}>
    <option value={current}>{current.replaceAll('_', ' ') || '…'}</option>
  </select>
  return <select id={id} value={current} disabled={disabled} required={required} onChange={event => onChange(event.target.value)}>
    {!current && <option value="">{t('Choose a time zone…')}</option>}
    {!known && <option value={current}>{current}</option>}
    <optgroup label={t('Common time zones')}>
      {common.map(item => <option key={item.zone} value={item.zone}>{item.label}</option>)}
    </optgroup>
    <optgroup label={t('All time zones')}>
      {rest.map(item => <option key={item.zone} value={item.zone}>{item.zone.replaceAll('_', ' ')} — {item.label}</option>)}
    </optgroup>
  </select>
}
