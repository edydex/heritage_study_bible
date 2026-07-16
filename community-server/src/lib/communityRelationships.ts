import type { CollectionSlug, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'

type CommunityScopedCollection = 'events' | 'plan-cohorts' | 'reading-plans'

type RelationshipValidationArgs = {
  currentCollection: CollectionSlug
  data?: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  relatedCollection: CommunityScopedCollection
  relationField: string
  req: PayloadRequest
}

export function relationshipId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: unknown }).id)
  }
  return value == null ? '' : String(value)
}

function validationError(
  args: RelationshipValidationArgs,
  message: string,
): ValidationError {
  return new ValidationError({
    collection: args.currentCollection,
    errors: [{ path: args.relationField, message }],
    req: args.req,
  })
}

/**
 * Ensures a related document belongs to the same community as the document
 * being written. Member updates intentionally use the original community:
 * community fields are immutable for them, and submitted values must not be
 * able to influence this check before field access removes the attempted edit.
 */
export async function validateRelatedCommunity(args: RelationshipValidationArgs): Promise<void> {
  const { data = {}, originalDoc = {}, relatedCollection, relationField, req } = args
  const canMoveCommunity = req.user?.systemRole === 'system-admin'
  const communityValue = originalDoc.community && !canMoveCommunity
    ? originalDoc.community
    : (data.community ?? originalDoc.community)
  const relationValue = data[relationField] ?? originalDoc[relationField]
  const communityId = relationshipId(communityValue)
  const relatedId = relationshipId(relationValue)

  // Required-field validation supplies the more useful missing-value error.
  if (!communityId || !relatedId) return

  let related: Record<string, unknown>
  try {
    related = await req.payload.findByID({
      collection: relatedCollection,
      id: relatedId,
      depth: 0,
      overrideAccess: true,
    }) as unknown as Record<string, unknown>
  } catch {
    throw validationError(args, `The selected ${relationField} does not exist.`)
  }

  if (relationshipId(related.community) !== communityId) {
    throw validationError(args, `The selected ${relationField} belongs to a different community.`)
  }
}
