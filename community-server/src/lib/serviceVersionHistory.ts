export type SaveKind = 'automatic' | 'manual' | 'restore' | 'legacy'
export type ServiceHistoryEntry = {
  id: string; syncVersion: number | string; revision: string; savedAt: string;
  saveKind: SaveKind; savedBy: string;
}
export const AUTOMATIC_HISTORY_WINDOW_MS = 5 * 60_000

export function groupServiceHistory(entries: ServiceHistoryEntry[]) {
  const groups: { id: string; saveKind: SaveKind; savedBy: string; startedAt: string; savedAt: string; entries: ServiceHistoryEntry[] }[] = []
  for (const entry of [...entries].sort((a, b) => a.savedAt.localeCompare(b.savedAt) || a.id.localeCompare(b.id, undefined, { numeric: true }))) {
    const prior = groups.at(-1)
    if (entry.saveKind === 'automatic' && prior?.saveKind === 'automatic'
      && prior.savedBy === entry.savedBy
      && Date.parse(entry.savedAt) - Date.parse(prior.startedAt) < AUTOMATIC_HISTORY_WINDOW_MS) {
      prior.entries.push(entry)
      prior.savedAt = entry.savedAt
    } else groups.push({ id: entry.id, saveKind: entry.saveKind, savedBy: entry.savedBy, startedAt: entry.savedAt, savedAt: entry.savedAt, entries: [entry] })
  }
  return groups.reverse().map(group => ({ ...group, entries: group.entries.reverse() }))
}
