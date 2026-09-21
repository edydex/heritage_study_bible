import type { Payload } from 'payload'

export async function recordAccountSecurityEvent({
  payload,
  userId,
  email,
  eventType,
  deviceId,
  deviceName,
}: {
  payload: Payload
  userId: number
  email?: string | null
  eventType: 'device-connected' | 'protection-changed' | 'device-revoked'
  deviceId?: string
  deviceName?: string
}) {
  const occurredAt = new Date().toISOString()
  try {
    await payload.create({
      collection: 'sync-account-events',
      overrideAccess: true,
      data: { user: userId, eventType, deviceId: deviceId || null, occurredAt },
    })
  } catch {
    // Authentication and protection changes have already committed when this
    // helper is called. A notification-system outage must not turn a committed
    // transition into a client-visible failure that encourages unsafe retries.
    payload.logger.warn('A Heritage account security event could not be recorded.')
  }

  if (!email) return
  const action = eventType === 'device-connected'
    ? `A new device (${deviceName || 'Heritage device'}) signed in to your Heritage synchronized account.`
    : eventType === 'device-revoked'
      ? `A device (${deviceName || 'Heritage device'}) was revoked from your Heritage synchronized account.`
      : 'Your Heritage account-protection setting changed.'
  try {
    await payload.sendEmail({
      to: email,
      subject: 'Heritage account security notice',
      text: `${action}\n\nIf you did not do this, open Heritage on a trusted device and revoke unfamiliar devices.`,
      html: `<p>${action.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p><p>If you did not do this, open Heritage on a trusted device and revoke unfamiliar devices.</p>`,
    })
  } catch {
    payload.logger.warn('A Heritage account security notification email could not be delivered.')
  }
}
