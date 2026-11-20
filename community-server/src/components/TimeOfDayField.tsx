'use client'

import { FieldError, FieldLabel, useField } from '@payloadcms/ui'
import { mergeFieldStyles } from '@payloadcms/ui/shared'
import type { TextFieldClientProps } from 'payload'

/** A clock time (HH:mm) for one date of a repeating event, in the event's time zone. */
export default function TimeOfDayField({ field, path, readOnly }: TextFieldClientProps) {
  const { value, setValue, showError, errorMessage, disabled } = useField<string | null>({ path })
  const locked = Boolean(readOnly || disabled)
  const id = `field-${path.replace(/\./g, '__')}`
  return <div className={['field-type', 'text', showError && 'error', locked && 'read-only'].filter(Boolean).join(' ')} style={mergeFieldStyles(field)}>
    <FieldLabel htmlFor={id} label={field.label} path={path} />
    <div className="field-type__wrap">
      <FieldError path={path} showError={showError} message={errorMessage} />
      <input id={id} type="time" step={300} value={value || ''} disabled={locked} onChange={event => setValue(event.target.value || null)} />
    </div>
  </div>
}
