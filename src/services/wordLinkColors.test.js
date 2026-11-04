import { expect, it } from 'vitest'
import { assignWordLinkColors, wordLinkColor } from './wordLinkColors'

function comparison(count, permutation = [...Array(count).keys()]) {
  const links = index => ({ id: `1:1:${index}`, startOffset: index * 3, endOffset: index * 3 + 2,
    sourceAnchors: [{ chapter: 1, verse: 1, startOffset: index * 3, endOffset: index * 3 + 2 }] })
  const primary = Array.from({ length: count }, (_, index) => links(index))
  const secondary = permutation.map((index, position) => ({ ...links(index), startOffset: position * 3, endOffset: position * 3 + 2 }))
  return { primary: new Map([['1:1', primary]]), secondary: new Map([['1:1', secondary]]) }
}

it('gives forty-eight distinct pairs their own color and preserves it across reordered translations', () => {
  const reordered = [...Array(48).keys()].sort((a, b) => a % 7 - b % 7 || a - b)
  const result = assignWordLinkColors(comparison(48, reordered))
  const primary = result.primary.get('1:1'), secondary = result.secondary.get('1:1')
  expect(new Set(primary.map(link => link.color.index)).size).toBe(48)
  expect(new Set(primary.map(link => link.color.light)).size).toBe(48)
  for (const link of primary) expect(secondary.find(other => other.id === link.id).color).toEqual(link.color)
  expect(new Set(primary.map(link => link.texture)).size).toBe(8)
  for (const link of primary) expect(secondary.find(other => other.id === link.id).texture).toBe(link.texture)
  for (const row of [primary, secondary]) for (let index = 1; index < row.length; index++) {
    const a = row[index - 1].color, b = row[index].color
    const hue = Math.min(Math.abs(a.hue - b.hue), 360 - Math.abs(a.hue - b.hue))
    expect(hue >= 30 || Math.abs(a.lightness - b.lightness) >= 6).toBe(true)
    expect(row[index].texture).not.toBe(row[index - 1].texture)
  }
  expect(assignWordLinkColors(comparison(48, reordered))).toEqual(result)
})

it('keeps colors distinct in both rows of a moved clause', () => {
  const result = comparison(16)
  const moved = { id: '1:2:0', startOffset: 50, endOffset: 55, sourceAnchors: [{ chapter: 1, verse: 2, startOffset: 0, endOffset: 5 }] }
  result.primary.get('1:1').push(moved)
  result.secondary.set('1:2', [{ ...moved, startOffset: 0, endOffset: 5 }])
  assignWordLinkColors(result)
  expect(new Set(result.primary.get('1:1').map(link => link.color.index)).size).toBe(17)
  expect(moved.color).toEqual(result.secondary.get('1:2')[0].color)
})

it('provides separate readable light and dark fills for the extended palette', () => {
  const rgb = value => {
    const [, h, s, l] = value.match(/hsl\(([\d.]+) (\d+)% (\d+)%\)/).map(Number)
    const saturation = s / 100, lightness = l / 100
    const a = saturation * Math.min(lightness, 1 - lightness)
    return [0, 8, 4].map(n => { const k = (n + h / 30) % 12; return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) })
  }
  const luminance = channels => channels.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
  const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  for (let index = 0; index < 200; index++) {
    const color = wordLinkColor(index)
    expect(contrast(luminance(rgb(color.light)), luminance([55, 65, 81].map(v => v / 255)))).toBeGreaterThan(4.5)
    expect(contrast(luminance(rgb(color.light).map(v => v * .9025)), luminance([55, 65, 81].map(v => v / 255)))).toBeGreaterThan(4.5)
    expect(contrast(luminance(rgb(color.dark)), luminance([209, 213, 219].map(v => v / 255)))).toBeGreaterThan(4.5)
  }
})
