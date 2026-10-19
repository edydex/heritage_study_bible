import type { Payload } from 'payload'
import { synthesizeLegacySyncDocuments } from '@/lib/syncShowProtocol'

/**
 * The SQL migration deliberately leaves lyrics and rights fields untouched.
 * This one-time, idempotent pass converts legacy English/Russian lyrics into
 * canonical SyncShow documents after Payload is initialized. Title-only
 * listings remain metadata-only.
 */
export async function backfillSongSyncDocuments(payload: Payload) {
  let page = 1
  let scanned = 0
  let backfilled = 0
  let metadataOnly = 0
  let skipped = 0
  while (true) {
    const result = await payload.find({
      collection: 'songs',
      depth: 0,
      limit: 100,
      page,
      overrideAccess: true,
      sort: 'id',
    })
    for (const song of result.docs) {
      scanned += 1
      if (Array.isArray(song.syncDocuments) && song.syncDocuments.length) continue
      try {
        const documents = synthesizeLegacySyncDocuments(song as unknown as Record<string, unknown>)
        if (!documents.length) {
          metadataOnly += 1
          continue
        }
        await payload.update({
          collection: 'songs',
          id: song.id,
          overrideAccess: true,
          data: { syncDocuments: documents },
        })
        backfilled += 1
      } catch (error) {
        skipped += 1
        // A malformed legacy credit, URL, or oversized field must never keep
        // the entire Community server from starting. Leave that one song
        // untouched for a manager to repair and make the failure conspicuous.
        payload.logger.error({
          err: error,
          songId: song.id,
          slug: song.slug,
          syncId: song.syncId,
        }, 'Skipped malformed legacy song during SyncShow backfill')
      }
    }
    if (!result.hasNextPage) break
    page += 1
  }
  const report = { scanned, backfilled, metadataOnly, skipped }
  if (backfilled || skipped) {
    payload.logger.info(report, 'Completed legacy song SyncShow backfill')
  }
  return report
}
