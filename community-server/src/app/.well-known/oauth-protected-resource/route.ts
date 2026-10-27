import { resourceMetadata, privateJson, calendarMcpEnabled } from '@/lib/calendarMcp/config'
export const dynamic = 'force-dynamic'
export function GET() {
  if (!calendarMcpEnabled()) return privateJson({ error:'not_found' },404)
  try { return privateJson(resourceMetadata()) } catch { return privateJson({ error:'configuration_unavailable' },503) }
}
