export type LyricSection = { label: string; lines: string[] }
export function parseSongLyrics(value: unknown, options?: { language?: string; label?: string }): LyricSection[]
export function normalizeSongSections(sections: unknown, language?: string): LyricSection[]
export function firstSongSections(song: unknown, language?: string): (LyricSection & { language: string })[]
