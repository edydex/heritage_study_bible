import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { buildConfig, getPayload } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { Users } from '../src/collections/Users.ts'
import { Memberships } from '../src/collections/Memberships.ts'
import { CommunityInvites } from '../src/collections/CommunityInvites.ts'
import { CommunityAuthChallenges } from '../src/collections/CommunityAuthChallenges.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'

const databaseUrl = process.env.INVITATION_TEST_DATABASE_URL

test(
  'invitations survive real Payload saves, mail delivery and acceptance',
  {
    skip: !databaseUrl,
    timeout: 120_000,
  },
  async () => {
    assertDisposableLiveDatabase({
      databaseUrl,
      expectedDatabase: 'heritage_invitation_test',
      expectedMarker: 'heritage-invitation-test-v1',
      variableName: 'INVITATION_TEST_DATABASE_URL',
    })
    const messages: any[] = []
    let failMail = false
    const payload = await getPayload({
      config: buildConfig({
        secret: 'disposable-invitation-test-secret-not-for-production',
        telemetry: false,
        admin: { user: 'users' },
        db: postgresAdapter({
          pool: { connectionString: databaseUrl },
          push: true,
        }),
        email: () => ({
          name: 'captured-test-mail',
          defaultFromAddress: 'test@example.test',
          defaultFromName: 'Test church',
          sendEmail: async (message) => {
            if (failMail) throw new Error('private SMTP error')
            messages.push(message)
            return {}
          },
        }),
        collections: [
          Users,
          Memberships,
          CommunityInvites,
          CommunityAuthChallenges,
          {
            slug: 'communities',
            fields: [
              { name: 'slug', type: 'text' },
              { name: 'name', type: 'text' },
            ],
          },
        ],
      }),
    })
    try {
      const suffix = randomUUID()
      const admin = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email: `admin-${suffix}@example.test`,
          password: randomUUID(),
          displayName: 'Test administrator',
          systemRole: 'system-admin',
          accountProtection: 'email',
          syncGeneration: 1,
        },
      })
      const actor = { ...admin, collection: 'users' as const }
      const church = await payload.create({
        collection: 'communities',
        overrideAccess: true,
        data: { slug: suffix, name: 'Invitation test church' } as never,
      })
      const email = `member-${suffix}@example.test`
      const invitation = await payload.create({
        collection: 'community-invites',
        overrideAccess: false,
        user: actor,
        data: {
          community: church.id,
          email,
          role: 'member',
          active: true,
          sendEmailNow: true,
        },
      })
      assert.equal(invitation.email, email)
      assert.equal(invitation.sendEmailNow, false)
      assert.ok(invitation.emailSentAt)
      assert.equal(messages.length, 1)
      const saved = await payload.findByID({
        collection: 'community-invites',
        id: invitation.id,
        overrideAccess: true,
      })
      assert.equal(saved.email, email)
      await payload.update({
        collection: 'community-invites',
        id: invitation.id,
        overrideAccess: true,
        data: { active: false, acceptedAt: new Date().toISOString() },
      })
      assert.equal(messages.length, 1)

      const invite = (
        address: string,
        role: 'admin' | 'leader' | 'member' = 'admin',
      ) =>
        payload.create({
          collection: 'community-invites',
          overrideAccess: false,
          user: actor,
          data: {
            community: church.id,
            email: address,
            role,
            active: true,
            sendEmailNow: true,
          },
        })
      const account = async (address: string) =>
        (
          await payload.find({
            collection: 'users',
            overrideAccess: true,
            where: { email: { equals: address } },
            depth: 0,
          })
        ).docs[0]
      const members = (id: number) =>
        payload.find({
          collection: 'memberships',
          overrideAccess: true,
          where: {
            and: [
              { community: { equals: church.id } },
              { user: { equals: id } },
            ],
          },
          depth: 0,
        })
      const setupToken = () => {
        const message = messages.at(-1)
        assert.match(message.subject, /workspace/)
        assert.match(message.text, /24 hours/)
        assert.doesNotMatch(message.text, /community\/callback/)
        return message.text.match(/\/admin\/reset\/([a-f0-9]+)/)[1]
      }
      const managerEmail = `manager-${suffix}@example.test`
      const managerInvite = await invite(managerEmail)
      const manager = await account(managerEmail)
      assert.equal(
        manager.systemRole,
        'member',
        'invitation must not grant server administration',
      )
      assert.equal(
        (await members(manager.id)).totalDocs,
        0,
        'permissions wait for recipient sign-in',
      )
      const firstToken = setupToken()
      const password = randomUUID()
      await payload.update({
        collection: 'community-invites',
        id: managerInvite.id,
        overrideAccess: false,
        user: actor,
        data: { sendEmailNow: true },
      })
      const token = setupToken()
      assert.notEqual(token, firstToken)
      await assert.rejects(
        payload.resetPassword({
          collection: 'users',
          overrideAccess: false,
          data: { token: firstToken, password },
        }),
      )
      const signedIn = await payload.resetPassword({
        collection: 'users',
        overrideAccess: false,
        data: { token, password },
      })
      assert.equal(signedIn.user.systemRole, 'member')
      assert.equal((await members(manager.id)).docs[0].role, 'admin')
      const accepted = await payload.findByID({
        collection: 'community-invites',
        id: managerInvite.id,
      })
      assert.equal(accepted.active, false)
      assert.ok(accepted.acceptedAt)
      await assert.rejects(
        payload.resetPassword({
          collection: 'users',
          overrideAccess: false,
          data: { token, password: randomUUID() },
        }),
      )
      await payload.login({
        collection: 'users',
        data: { email: managerEmail, password },
      })
      assert.equal(
        (await members(manager.id)).totalDocs,
        1,
        'later sign-ins do not duplicate membership',
      )
      await assert.rejects(
        payload.create({
          collection: 'community-invites',
          overrideAccess: false,
          user: { ...manager, collection: 'users' },
          data: {
            community: church.id,
            email: `unauthorized-${suffix}@example.test`,
            role: 'admin',
            active: true,
          },
        }),
      )

      const expiredEmail = `expired-${suffix}@example.test`
      await invite(expiredEmail)
      const expiredToken = await payload.forgotPassword({
        collection: 'users',
        data: { email: expiredEmail },
        disableEmail: true,
        expiration: -1,
      })
      await assert.rejects(
        payload.resetPassword({
          collection: 'users',
          overrideAccess: false,
          data: { token: expiredToken!, password: randomUUID() },
        }),
      )
      assert.equal(
        (await members((await account(expiredEmail)).id)).totalDocs,
        0,
      )
      const foreignChurch = await payload.create({
        collection: 'communities',
        overrideAccess: true,
        data: { slug: `foreign-${suffix}`, name: 'Other church' } as never,
      })
      assert.equal(
        (
          await payload.find({
            collection: 'memberships',
            overrideAccess: true,
            where: {
              and: [
                { user: { equals: manager.id } },
                { community: { equals: foreignChurch.id } },
              ],
            },
          })
        ).totalDocs,
        0,
      )

      const revokedEmail = `revoked-${suffix}@example.test`
      const revoked = await invite(revokedEmail, 'leader')
      const revokedToken = setupToken()
      await payload.update({
        collection: 'community-invites',
        id: revoked.id,
        user: actor,
        overrideAccess: false,
        data: { active: false },
      })
      await payload.resetPassword({
        collection: 'users',
        overrideAccess: false,
        data: { token: revokedToken, password: randomUUID() },
      })
      assert.equal(
        (await members((await account(revokedEmail)).id)).totalDocs,
        0,
        'revocation prevents access even with a valid setup link',
      )

      const memberAccount = await account(email)
      await payload.create({
        collection: 'memberships',
        overrideAccess: true,
        data: {
          community: church.id,
          user: memberAccount.id,
          role: 'member',
          joinedAt: new Date().toISOString(),
        },
      })
      await payload.update({
        collection: 'community-invites',
        id: invitation.id,
        overrideAccess: false,
        user: actor,
        data: { active: true, role: 'admin', sendEmailNow: true },
      })
      await payload.resetPassword({
        collection: 'users',
        overrideAccess: false,
        data: { token: setupToken(), password: randomUUID() },
      })
      assert.equal(
        (await members(memberAccount.id)).docs[0].role,
        'admin',
        'existing readers can accept workspace invitations',
      )

      const ownerPassword = randomUUID()
      await payload.update({
        collection: 'users',
        id: admin.id,
        overrideAccess: true,
        data: { password: ownerPassword },
      })
      await payload.create({
        collection: 'memberships',
        overrideAccess: true,
        data: {
          community: church.id,
          user: admin.id,
          role: 'owner',
          joinedAt: new Date().toISOString(),
        },
      })
      await invite(admin.email, 'leader')
      await payload.login({
        collection: 'users',
        data: { email: admin.email, password: ownerPassword },
      })
      assert.equal(
        (await members(admin.id)).docs[0].role,
        'owner',
        'invitation cannot downgrade owner',
      )
      assert.equal(
        (await account(admin.email)).systemRole,
        'system-admin',
        'existing system role is preserved',
      )

      failMail = true
      const failedEmail = `failure-${suffix}@example.test`
      await assert.rejects(invite(failedEmail), (error: any) => {
        assert.equal(error.isPublic, true)
        assert.match(error.message, /invitation could not be sent/)
        assert.doesNotMatch(error.message, /private SMTP/)
        return true
      })
      assert.equal(
        (
          await payload.find({
            collection: 'community-invites',
            where: { email: { equals: failedEmail } },
          })
        ).totalDocs,
        0,
      )
      assert.equal(
        await account(failedEmail),
        undefined,
        'SMTP failure rolls back new workspace account and setup token',
      )
      failMail = false
      await invite(failedEmail)
      assert.ok(await account(failedEmail), 'failed invitation can be retried')
    } finally {
      await payload.destroy()
    }
  },
)
