'use client'

import { FieldDescription, FieldError, FieldLabel, useField, useFormFields } from '@payloadcms/ui'
import { mergeFieldStyles } from '@payloadcms/ui/shared'
import type { TextFieldClientProps } from 'payload'
import { canonicalTimeZone, localDateTime, localToInstant } from '../../packages/calendar-core/index.js'
import TimeZoneSelect from './TimeZoneSelect'

/**
 * Choosing another time zone keeps the event at the same clock time
 * ("10:30 AM") in the new zone, the way calendar apps do.
 */
export default function TimeZoneField({ field, path, readOnly }: TextFieldClientProps) {
  const { value, setValue, showError, errorMessage, disabled } = useField<string | null>({ path })
  const prefix = path.includes('.') ? `${path.slice(0, path.lastIndexOf('.'))}.` : ''
  const startsAt = useFormFields(([fields]) => fields[`${prefix}startsAt`]?.value as string | undefined)
  const endsAt = useFormFields(([fields]) => fields[`${prefix}endsAt`]?.value as string | undefined)
  const dispatch = useFormFields(([, dispatchFields]) => dispatchFields)
  const locked = Boolean(readOnly || disabled)
  const id = `field-${path.replace(/\./g, '__')}`
  const change = (next: string) => {
    const before = canonicalTimeZone(value)
    if (before && next && before !== next) {
      for (const [name, instant] of [['startsAt', startsAt], ['endsAt', endsAt]] as const) {
        if (!instant || !Number.isFinite(Date.parse(instant))) continue
        try {
          dispatch({ type: 'UPDATE', path: `${prefix}${name}`, value: localToInstant(localDateTime(instant, before), next) })
        } catch { /* a clock-change gap keeps the original instant */ }
      }
    }
    setValue(next || null)
  }
  return <div className={['field-type', 'select', 'heritage-time-zone', showError && 'error', locked && 'read-only'].filter(Boolean).join(' ')} style={mergeFieldStyles(field)}>
    <FieldLabel htmlFor={id} label={field.label} path={path} required={field.required} />
    <div className="field-type__wrap">
      <FieldError path={path} showError={showError} message={errorMessage} />
      <TimeZoneSelect id={id} value={value || ''} onChange={change} disabled={locked} required={field.required} />
    </div>
    <FieldDescription description={field.admin?.description} path={path} />
  </div>
}
