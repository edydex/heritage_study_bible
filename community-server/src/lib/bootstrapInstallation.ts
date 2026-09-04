import type { Payload } from 'payload'

function configuredBootstrap() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD

  if (!email && !password) return null
  if (!email || !password) {
    throw new Error('Both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required')
  }
  if (password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters')
  }

  return { email, password }
}

/**
 * Seeds only a completely new installation. The installer removes the two
 * BOOTSTRAP_ADMIN_* variables after it verifies the first login, so normal
 * restarts never carry an administrator password.
 */
export async function bootstrapInstallation(payload: Payload) {
  const bootstrap = configuredBootstrap()
  if (!bootstrap) return

  const existingUsers = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 2,
    overrideAccess: true,
    where: { email: { equals: bootstrap.email } },
  })

  let user = existingUsers.docs[0]
  if (user && user.systemRole !== 'system-admin') {
    throw new Error('The bootstrap email already belongs to a non-administrator account; refusing to elevate it')
  }
  if (!user) {
    const userCount = await payload.count({ collection: 'users', overrideAccess: true })
    if (userCount.totalDocs > 0) {
      throw new Error('This installation already has users and no matching bootstrap administrator')
    }
    user = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        displayName: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Administrator',
        email: bootstrap.email,
        password: bootstrap.password,
        systemRole: 'system-admin',
        accountProtection: 'email',
        syncGeneration: 1,
      },
    })
  }

  const communitySlug = process.env.COMMUNITY_ID || 'local-church'
  let community = (await payload.find({
    collection: 'communities',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { slug: { equals: communitySlug } },
  })).docs[0]
  if (!community) {
    community = await payload.create({
      collection: 'communities',
      draft: false,
      overrideAccess: true,
      data: {
        contentServerEnabled: true,
        description: process.env.COMMUNITY_DESCRIPTION || 'A Heritage church community.',
        joinPolicy: 'invite',
        name: process.env.COMMUNITY_NAME || 'Local Church',
        slug: communitySlug,
        timeZone: process.env.COMMUNITY_TIME_ZONE || 'UTC',
        website: process.env.COMMUNITY_PUBLIC_URL,
      },
    })
  }

  const membership = (await payload.find({
    collection: 'memberships',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { community: { equals: community.id } },
        { user: { equals: user.id } },
      ],
    },
  })).docs[0]
  if (!membership) {
    await payload.create({
      collection: 'memberships',
      draft: false,
      overrideAccess: true,
      data: {
        community: community.id,
        joinedAt: new Date().toISOString(),
        role: 'owner',
        user: user.id,
      },
    })
  }

  payload.logger.info(`Created the initial administrator and community "${communitySlug}"`)
}
