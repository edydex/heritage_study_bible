import type { CollectionAfterChangeHook } from 'payload'
import { sendCommunityMagicLinkEmail } from '@/lib/communityMagicLinkEmail'

export const sendInvitationEmail: CollectionAfterChangeHook = async ({
  context,
  doc,
  req,
}) => {
  if (context.skipInvitationEmail || !doc.active || !doc.sendEmailNow) return doc

  const email = String(doc.email || '').trim().toLowerCase()
  if (!email) throw new Error('The invitation was not saved because its email address is invalid.')

  try {
    await sendCommunityMagicLinkEmail({
      payload: req.payload,
      email,
      displayName: doc.displayName,
      invitation: true,
    })
  } catch {
    throw new Error(
      'The invitation email could not be sent. Check the SMTP settings, then save the invitation again.',
    )
  }

  const emailSentAt = new Date().toISOString()
  await req.payload.update({
    collection: 'community-invites',
    id: doc.id,
    overrideAccess: true,
    req,
    context: { skipInvitationEmail: true },
    data: {
      emailSentAt,
      sendEmailNow: false,
    },
  })

  return { ...doc, emailSentAt, sendEmailNow: false }
}
