import { scriptureTranslationScope } from './plannerScriptureTranslations'
/** Match the passage rather than every unrelated reference in its sermon. */
export function typographyItemIds(project: any, selectedId: string): string[] {
  const item = project.items[selectedId]
  if (item?.kind !== 'bible') return [selectedId]
  return scriptureTranslationScope(project,selectedId)?.itemIds || [selectedId]
}
