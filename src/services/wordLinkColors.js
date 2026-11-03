// Colors belong to checked correspondence groups. A translated phrase can
// contain several words; all its actual counterparts retain the same color.
const GOLDEN_ANGLE = 137.50776405
const cache = new Map()

export function wordLinkColor(index) {
  if (!cache.has(index)) {
    const hue = (210 + index * GOLDEN_ANGLE) % 360
    const band = index % 3
    const saturation = [68, 76, 58][band]
    const lightness = [91, 85, 94][band]
    cache.set(index, {
      index, hue, lightness,
      light: `hsl(${hue.toFixed(3)} ${saturation}% ${lightness}%)`,
      dark: `hsl(${hue.toFixed(3)} ${[58, 67, 74][band]}% ${[16, 20, 12][band]}%)`,
      edge: `hsl(${hue.toFixed(3)} 68% 44%)`,
      darkEdge: `hsl(${hue.toFixed(3)} 66% 64%)`,
    })
  }
  return cache.get(index)
}

const separation = (a, b) => {
  const hue = Math.abs(a.hue - b.hue)
  return .78 * Math.min(hue, 360 - hue) / 180 + .22 * Math.abs(a.lightness - b.lightness) / 9
}

export function assignWordLinkColors(result) {
  const groups = new Map(), rows = new Map()
  const addRow = (key, start, group) => {
    if (!rows.has(key)) rows.set(key, [])
    rows.get(key).push({ start, id: group.id })
    group.rows.add(key)
  }
  for (const side of ['primary', 'secondary']) for (const [ref, links] of result[side]) for (const link of links) {
    if (!groups.has(link.id)) groups.set(link.id, { id: link.id, links: [], rows: new Set(), neighbors: new Map(), first: link.sourceAnchors[0] })
    const group = groups.get(link.id)
    group.links.push(link)
    addRow(`${side}:${ref}`, link.startOffset, group)
  }
  for (const group of groups.values()) {
    const anchors = group.links[0].sourceAnchors
    for (const anchor of anchors) addRow(`original:${anchor.chapter}:${anchor.verse}`, anchor.startOffset, group)
  }
  let largestRow = 0
  for (const entries of rows.values()) {
    const ordered = entries.sort((a, b) => a.start - b.start).map(entry => entry.id)
      .filter((id, index, all) => index === 0 || all[index - 1] !== id)
    largestRow = Math.max(largestRow, new Set(ordered).size)
    for (let i = 0; i < ordered.length; i++) for (let distance = 1; distance <= 3 && i + distance < ordered.length; distance++) {
      const left = groups.get(ordered[i]), right = groups.get(ordered[i + distance])
      if (left === right) continue
      const weight = 1 / distance
      left.neighbors.set(right.id, Math.max(left.neighbors.get(right.id) || 0, weight))
      right.neighbors.set(left.id, Math.max(right.neighbors.get(left.id) || 0, weight))
    }
  }
  const used = new Map(), assigned = new Map(), textures = new Map(), textureUsage = new Map()
  const ordered = [...groups.values()].sort((a, b) => a.first.chapter - b.first.chapter || a.first.verse - b.first.verse || a.first.startOffset - b.first.startOffset)
  const poolSize = Math.max(48, largestRow * 2 + 12)
  for (const group of ordered) {
    const forbidden = new Set([...group.rows].flatMap(row => [...(used.get(row) || [])]))
    const neighbors = [...group.neighbors].filter(([id]) => assigned.has(id))
    let best, bestScore = -Infinity
    // The final extra candidates guarantee availability even when a phrase
    // spans several original/translated verse boundaries.
    const limit = Math.max(poolSize, forbidden.size + 1)
    for (let index = 0; index < limit; index++) {
      if (forbidden.has(index)) continue
      const color = wordLinkColor(index)
      const distances = neighbors.map(([id, weight]) => [separation(color, assigned.get(id)), weight])
      const score = distances.length
        ? Math.min(...distances.map(([distance, weight]) => distance / weight))
          + distances.reduce((sum, [distance, weight]) => sum + distance * weight, 0) / distances.reduce((sum, [, weight]) => sum + weight, 0) * .15
        : -index
      if (score > bestScore) { best = color; bestScore = score }
    }
    assigned.set(group.id, best)
    let texture = 0, texturePenalty = Infinity
    for (let offset = 0; offset < 8; offset++) {
      const candidate = (best.index + offset) % 8
      const penalty = [...group.neighbors].reduce((sum, [id, weight]) => sum + (textures.get(id) === candidate ? weight ** 2 : 0), 0)
        + [...group.rows].reduce((sum, row) => sum + (textureUsage.get(row)?.[candidate] || 0) * .015, 0)
      if (penalty < texturePenalty) { texture = candidate; texturePenalty = penalty }
    }
    textures.set(group.id, texture)
    for (const row of group.rows) {
      if (!used.has(row)) used.set(row, new Set())
      used.get(row).add(best.index)
      if (!textureUsage.has(row)) textureUsage.set(row, Array(8).fill(0))
      textureUsage.get(row)[texture]++
    }
    for (const link of group.links) { link.color = best; link.texture = texture }
  }
  return result
}
