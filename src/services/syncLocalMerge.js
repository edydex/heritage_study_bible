// Apply only the server's changes, retaining edits made locally during a request.
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function mergeMap(before = {}, current = {}, incoming = {}) {
  const result = { ...current }
  for (const key of new Set([...Object.keys(before), ...Object.keys(incoming)])) {
    if (equal(before[key], incoming[key]) || !equal(before[key], current[key])) continue
    if (key in incoming) result[key] = incoming[key]
    else delete result[key]
  }
  return result
}

export function mergeSyncList(before, current, incoming) {
  const byId = items => Object.fromEntries((items || []).map(item => [item.id, item]))
  return Object.values(mergeMap(byId(before), byId(current), byId(incoming)))
}

const keepLocalEdit = (before, current, incoming) => equal(before, current) ? incoming : current

export function mergeSyncPosition(before = {}, current = {}, incoming = {}) {
  // resourceId belongs to the wire record, not the stored position itself.
  const positions = resources => Object.fromEntries(Object.entries(resources || {}).map(([id, value]) => {
    const { resourceId: _resourceId, ...position } = value
    return [id, position]
  }))
  return {
    ...current,
    bible: keepLocalEdit(before.bible, current.bible, incoming.bible),
    resources: mergeMap(positions(before.resources), positions(current.resources), positions(incoming.resources)),
  }
}

function planEntries(plan = {}) {
  const entries = {}
  for (const [day, ids] of Object.entries(plan.completedItems || {})) {
    for (const id of ids) entries[JSON.stringify(['item', day, id])] = true
  }
  for (const day of plan.completedDays || []) entries[JSON.stringify(['day', String(day)])] = true
  for (const [day, note] of Object.entries(plan.dayNotes || {})) {
    if (String(note || '').trim()) entries[JSON.stringify(['note', day])] = note
  }
  return entries
}

export function mergeSyncPlan(before, current, incoming) {
  const entries = mergeMap(planEntries(before), planEntries(current), planEntries(incoming))
  if (equal(entries, planEntries(current))) return current
  const result = { ...current, completedItems: {}, completedDays: [], dayNotes: {}, updatedAt: new Date().toISOString() }
  for (const [key, value] of Object.entries(entries)) {
    const [kind, day, id] = JSON.parse(key)
    if (kind === 'item') (result.completedItems[day] ||= []).push(id)
    if (kind === 'day') result.completedDays.push(Number(day))
    if (kind === 'note') result.dayNotes[day] = value
  }
  return result
}

export { keepLocalEdit, equal as sameSyncValue }
