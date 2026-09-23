import { APIError, type CollectionAfterChangeHook } from 'payload'
import { sendWorkspaceInvitation } from './workspaceInvitation'
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
    if (doc.role === 'admin' || doc.role === 'leader') {
      await sendWorkspaceInvitation(req, doc)
    } else await sendCommunityMagicLinkEmail({
      payload: req.payload,
      email,
      displayName: doc.displayName,
      invitation: true,
    })
  } catch {
    req.payload.logger.warn('An invitation could not be sent; the invitation save was rolled back.')
    throw new APIError('The invitation could not be sent. Check the email settings, then save the invitation again.', 503, undefined, true)
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
