import { hash, parseOptions, verify } from '@node-rs/argon2'

export const STRICT_PASSWORD_PARAMS = Object.freeze({
  // @node-rs/argon2 declares Algorithm as an ambient const enum, which cannot
  // be read at runtime under isolatedModules. Value 2 is Argon2id.
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
})

export function validateStrictPassword(value: unknown) {
  if (typeof value !== 'string') return 'Enter a password.'
  if (value.length < 12) return 'Use at least 12 characters.'
  if (value.length > 1024) return 'Use a password no longer than 1,024 characters.'
  return ''
}

export async function hashStrictPassword(password: string) {
  const error = validateStrictPassword(password)
  if (error) throw new Error(error)
  const encoded = await hash(password, STRICT_PASSWORD_PARAMS)
  const parsed = parseOptions(encoded)
  return {
    encoded,
    algorithm: 'argon2id',
    params: {
      memoryCost: parsed.memoryCost,
      timeCost: parsed.timeCost,
      parallelism: parsed.parallelism,
      outputLen: parsed.outputLen,
      version: 19,
    },
  }
}

export async function verifyStrictPassword(encoded: unknown, password: unknown) {
  if (typeof encoded !== 'string' || typeof password !== 'string' || password.length > 1024) return false
  try {
    return await verify(encoded, password)
  } catch {
    return false
  }
}
