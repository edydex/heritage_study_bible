export type PassageReference = { book: string; startChapter: number; startVerse: number; endChapter: number; endVerse: number; invalidReason: string }
export function passageReferenceChoices(input: unknown): PassageReference[]
