import { sql } from 'drizzle-orm'
import type { PayloadRequest } from 'payload'

type QueryResult = { rows?: Array<Record<string, unknown>> }
type TransactionDatabase = { execute: (query: unknown) => Promise<QueryResult> }
type TransactionAdapter = {
  beginTransaction: () => Promise<null | number | string>
  commitTransaction: (id: number | string) => Promise<void>
  rollbackTransaction: (id: number | string) => Promise<void>
  sessions: Record<string, { db: TransactionDatabase }>
}

function database(req: PayloadRequest) {
  const adapter = req.payload.db as unknown as TransactionAdapter
  if (req.transactionID == null) {
    return (req.payload.db as unknown as { drizzle: TransactionDatabase }).drizzle
  }
  const session = adapter.sessions[String(req.transactionID)]
  if (!session) throw new Error('The synchronized transaction is no longer available.')
  return session.db
}

export async function withSyncTransaction<T>(req: PayloadRequest, operation: () => Promise<T>) {
  const adapter = req.payload.db as unknown as TransactionAdapter
  const transactionId = await adapter.beginTransaction()
  if (transactionId == null) throw new Error('Could not start synchronized update transaction.')
  const previous = req.transactionID
  req.transactionID = transactionId
  try {
    const result = await operation()
    await adapter.commitTransaction(transactionId)
    return result
  } catch (error) {
    await adapter.rollbackTransaction(transactionId)
    throw error
  } finally {
    req.transactionID = previous
  }
}

export async function lockSyncUser(req: PayloadRequest, userId: number) {
  // Every mutation touching a reader's synchronized account takes this first.
  // It makes account erasure mutually exclusive with device pushes.
  await database(req).execute(sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`heritage-sync-user:${userId}`}, 0)
    )
  `)
}

export function orderedRecordLockKeys(
  userId: number,
  records: Array<{ recordType: string; recordId: string }>,
) {
  return records
    .map(record => `heritage-sync-record:${userId}:${record.recordType}\0${record.recordId}`)
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
}

export async function lockSyncRecords(
  req: PayloadRequest,
  userId: number,
  records: Array<{ recordType: string; recordId: string }>,
) {
  for (const key of orderedRecordLockKeys(userId, records)) {
    await database(req).execute(sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
    `)
  }
}

export async function nextSyncRevision(req: PayloadRequest) {
  const result = await database(req).execute(sql`
    SELECT nextval('sync_records_server_revision_seq') AS revision
  `)
  const revision = Number(result.rows?.[0]?.revision)
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('Could not allocate a synchronized revision.')
  }
  return revision
}
