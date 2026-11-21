'use client'

import { FieldDescription, FieldError, FieldLabel, useField } from '@payloadcms/ui'
import { mergeFieldStyles } from '@payloadcms/ui/shared'
import type { TextFieldClientProps } from 'payload'

/** A calendar date without a time of day, stored as YYYY-MM-DD so it never shifts between time zones. */
export default function DateOnlyField({ field, path, readOnly }: TextFieldClientProps) {
  const { value, setValue, showError, errorMessage, disabled } = useField<string | null>({ path })
  const locked = Boolean(readOnly || disabled)
  const id = `field-${path.replace(/\./g, '__')}`
  return <div className={['field-type', 'text', 'heritage-date-only', showError && 'error', locked && 'read-only'].filter(Boolean).join(' ')} style={mergeFieldStyles(field)}>
    <FieldLabel htmlFor={id} label={field.label} path={path} required={field.required} />
    <div className="field-type__wrap">
      <FieldError path={path} showError={showError} message={errorMessage} />
      <input id={id} type="date" min="1850-01-01" max="9999-12-31" value={value || ''} disabled={locked}
        onChange={event => setValue(event.target.value || null)} />
    </div>
    <FieldDescription description={field.admin?.description} path={path} />
  </div>
}
