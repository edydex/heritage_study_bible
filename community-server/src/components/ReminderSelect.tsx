'use client'

import { REMINDER_CHOICES, reminderLabel } from './calendarDefaults'
import { useWorkspaceText } from './useWorkspaceText'

export default function ReminderSelect({ value, onChange, id, disabled }: {
  value: number | null; onChange: (minutes: number | null) => void; id?: string; disabled?: boolean
}) {
  const t = useWorkspaceText()
  const choices = REMINDER_CHOICES.includes(value) ? REMINDER_CHOICES : [...REMINDER_CHOICES, value]
  return <select id={id} value={value === null ? 'none' : String(value)} disabled={disabled}
    onChange={event => onChange(event.target.value === 'none' ? null : Number(event.target.value))}>
    {choices.map(minutes => <option key={String(minutes)} value={minutes === null ? 'none' : String(minutes)}>{reminderLabel(minutes, t)}</option>)}
  </select>
}
