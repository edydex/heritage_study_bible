export type PassageReference = { book: string; startChapter: number; startVerse: number; endChapter: number; endVerse: number; invalidReason: string; verseNumbers?: number[] }
export function passageReferenceChoices(input: unknown): PassageReference[]
export function passageSelectionChoices(input: unknown): PassageReference[]
