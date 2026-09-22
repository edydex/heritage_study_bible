/** Match the shared compiler's reading group when changing its font or alignment. */
export function typographyItemIds(project: any, selectedId: string): string[] {
  const item = project.items[selectedId]
  if (item?.kind !== 'bible') return [selectedId]
  const parent = (Object.values(project.items) as any[]).find(value => value.kind === 'group' && value.childIds.includes(selectedId))
  return parent ? parent.childIds.filter((id: string) => project.items[id].kind === 'bible' && project.items[id].presetId === item.presetId) : [selectedId]
}
