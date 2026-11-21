'use client'

import { FieldError, FieldLabel, useField } from '@payloadcms/ui'
import { mergeFieldStyles } from '@payloadcms/ui/shared'
import type { NumberFieldClientProps } from 'payload'
import ReminderSelect from './ReminderSelect'
import { useWorkspaceText } from './useWorkspaceText'

export default function ReminderField({ field, path, readOnly }: NumberFieldClientProps) {
  const t = useWorkspaceText()
  const { value, setValue, showError, errorMessage, disabled } = useField<number | null>({ path })
  const locked = Boolean(readOnly || disabled)
  const id = `field-${path.replace(/\./g, '__')}`
  return <div className={['field-type', 'select', showError && 'error', locked && 'read-only'].filter(Boolean).join(' ')} style={mergeFieldStyles(field)}>
    <FieldLabel htmlFor={id} label={field.label} path={path} />
    <div className="field-type__wrap">
      <FieldError path={path} showError={showError} message={errorMessage} />
      <ReminderSelect id={id} value={value ?? null} onChange={setValue} disabled={locked} />
    </div>
    <div className="field-description">{t('When members add this event to their phone calendar, or subscribe to the church calendar, their calendar app alerts them this long before. The church server itself does not send reminders.')}</div>
  </div>
}
