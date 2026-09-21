import { loadLiveService } from '@/lib/loadLiveService'
import { publicJson } from '@/lib/publicConfig'

export const dynamic = 'force-dynamic'

export async function GET() {
  return publicJson({ schemaVersion: 1, ...(await loadLiveService()) }, { headers: { 'Cache-Control': 'no-store' } })
}
