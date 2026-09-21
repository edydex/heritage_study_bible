import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'

export const SYNC_ENCRYPTION_KEY_ID = 'payload-secret-hkdf-aes256gcm-v1'

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]))
  }
  return value
}

export function canonicalSyncJson(value: unknown) {
  const serialized = JSON.stringify(canonicalize(value))
  if (typeof serialized !== 'string') throw new Error('The synchronized value is not valid JSON.')
  return serialized
}

function encryptionKey(secret: string, userId: string) {
  if (!secret || secret.length < 32) throw new Error('The Community server secret is not strong enough for sync encryption.')
  return Buffer.from(hkdfSync(
    'sha256',
    secret,
    'heritage-sync-at-rest-v1',
    `${SYNC_ENCRYPTION_KEY_ID}:user:${userId}`,
    32,
  ))
}

function contentHashKey(secret: string, userId: string) {
  if (!secret || secret.length < 32) throw new Error('The Community server secret is not strong enough for sync encryption.')
  return Buffer.from(hkdfSync(
    'sha256',
    secret,
    'heritage-sync-content-hash-v1',
    `heritage-sync-user:${userId}`,
    32,
  ))
}

function aad(userId: string, recordType: string, recordId: string, schemaVersion: number, deleted: boolean) {
  return Buffer.from(`${userId}\u0000${recordType}\u0000${recordId}\u0000${schemaVersion}\u0000${deleted ? 1 : 0}`)
}

export function encryptSyncPayload({
  secret,
  userId,
  recordType,
  recordId,
  schemaVersion,
  deleted,
  value,
}: {
  secret: string
  userId: string
  recordType: string
  recordId: string
  schemaVersion: number
  deleted: boolean
  value: unknown
}) {
  const plaintext = canonicalSyncJson(deleted ? null : value)
  const associatedData = aad(userId, recordType, recordId, schemaVersion, deleted)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret, userId), iv)
  cipher.setAAD(associatedData)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    keyId: SYNC_ENCRYPTION_KEY_ID,
    iv: iv.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    // This is deliberately a keyed digest. A database-only disclosure cannot
    // use hashes to confirm guesses about a reader's notes or highlights.
    contentHash: createHmac('sha256', contentHashKey(secret, userId))
      .update(associatedData)
      .update('\0')
      .update(plaintext, 'utf8')
      .digest('hex'),
  }
}

export function decryptSyncPayload({
  secret,
  userId,
  recordType,
  recordId,
  schemaVersion,
  deleted,
  keyId,
  iv,
  authTag,
  ciphertext,
}: {
  secret: string
  userId: string
  recordType: string
  recordId: string
  schemaVersion: number
  deleted: boolean
  keyId: string
  iv: string
  authTag: string
  ciphertext: string
}) {
  if (keyId !== SYNC_ENCRYPTION_KEY_ID) throw new Error('Unsupported synchronized-data encryption key.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret, userId), Buffer.from(iv, 'base64url'))
  decipher.setAAD(aad(userId, recordType, recordId, schemaVersion, deleted))
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
  return deleted ? null : JSON.parse(plaintext)
}
