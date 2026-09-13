import { SyncShowProtocolError } from './syncShowProtocol.ts'

export interface TranslationSettings {
  sourceLanguage: 'en' | 'ru'
  translationProfile: 'quality' | 'economy'
  speechEnabled: boolean
  contextDocumentIds: string[]
}
export interface TranslationPlan {
  schemaVersion: 1
  revision: number
  serviceRevision: string
  settings: TranslationSettings
}
export interface ServiceTranslationPlan {
  id: string
  communityId: string
  title: string
  serviceDate: string
  serviceRevision: string
  revision: number
  settings: TranslationSettings | null
  stale: boolean
}
export const serviceIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const hashPattern = /^[a-f0-9]{64}$/
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
function fail(message = 'Invalid translation settings.'): never {
  throw new SyncShowProtocolError('TRANSLATION_PLAN_INVALID', message)
}
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const object = value as Record<string, unknown>
  if (Object.keys(object).length !== keys.length || keys.some(key => !Object.hasOwn(object, key))) return fail()
  return object
}
export function parseTranslationSettings(value: unknown): TranslationSettings {
  const item = exact(value, ['sourceLanguage', 'translationProfile', 'speechEnabled', 'contextDocumentIds'])
  if (typeof item.sourceLanguage !== 'string' || !['en', 'ru'].includes(item.sourceLanguage)
    || typeof item.translationProfile !== 'string' || !['quality', 'economy'].includes(item.translationProfile)
    || typeof item.speechEnabled !== 'boolean' || !Array.isArray(item.contextDocumentIds)
    || item.contextDocumentIds.length > 8 || item.contextDocumentIds.some(id => typeof id !== 'string' || !uuidPattern.test(id))
    || new Set(item.contextDocumentIds).size !== item.contextDocumentIds.length) return fail()
  return { sourceLanguage: item.sourceLanguage as 'en' | 'ru', translationProfile: item.translationProfile as 'quality' | 'economy',
    speechEnabled: item.speechEnabled, contextDocumentIds: [...item.contextDocumentIds].sort() }
}
export function parseTranslationPlanWrite(value: unknown) {
  const item = exact(value, ['serviceId', 'serviceRevision', 'baseRevision', 'settings'])
  if (typeof item.serviceId !== 'string' || !serviceIdPattern.test(item.serviceId)
    || typeof item.serviceRevision !== 'string' || !hashPattern.test(item.serviceRevision)
    || !Number.isSafeInteger(item.baseRevision) || Number(item.baseRevision) < 0 || Number(item.baseRevision) >= Number.MAX_SAFE_INTEGER) return fail()
  return { serviceId: item.serviceId, serviceRevision: item.serviceRevision, baseRevision: Number(item.baseRevision), settings: parseTranslationSettings(item.settings) }
}
export function serviceTranslationPlan(document: Record<string, unknown>, communityId: number): ServiceTranslationPlan {
  let plan: TranslationPlan | null = null
  if (document.translationPlan != null) {
    const stored = exact(document.translationPlan, ['schemaVersion', 'revision', 'serviceRevision', 'settings'])
    if (stored.schemaVersion !== 1 || !Number.isSafeInteger(stored.revision) || Number(stored.revision) < 1
      || typeof stored.serviceRevision !== 'string' || !hashPattern.test(stored.serviceRevision)) return fail('Stored translation settings need repair.')
    plan = { schemaVersion: 1, revision: Number(stored.revision), serviceRevision: stored.serviceRevision, settings: parseTranslationSettings(stored.settings) }
  }
  return { id: String(document.syncId), communityId: String(communityId), title: String(document.title), serviceDate: String(document.serviceDate).slice(0, 10),
    serviceRevision: String(document.revision), revision: plan?.revision ?? 0, settings: plan?.settings ?? null,
    stale: Boolean(plan && plan.serviceRevision !== document.revision) }
}
