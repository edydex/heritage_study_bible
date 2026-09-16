export function canonicalTimeZone(zone: unknown): string
export function formatEventTime(value: string, zone?: string): string
export function eventPagePath(event: Record<string, any>): string
export function validTimeZone(zone: unknown): boolean
export function zonedParts(value: string | number | Date, zone?: string): Record<string, string>
export function localDate(value: string | number | Date, zone?: string): string
export function localDateTime(value: string | number | Date, zone?: string): string
export function validDate(value: unknown): boolean
export function addDays(date: string, days: number): string
export function localToInstant(value: string, zone?: string): string
export function shiftMonth(month: string, amount: number): string
export function monthDays(month: string): string[]
export function eventDateRange(event: Record<string, any>, zone?: string): { start: string; end: string } | null
export function eventIncludesDate(event: Record<string, any>, date: string, zone?: string): boolean
export function calendarWeeks(month: string, events: Array<Record<string, any>>, zone?: string): Array<{ dates: string[]; lanes: number; entries: Array<{ event: Record<string, any>; start: number; end: number; lane: number; continuesBefore: boolean; continuesAfter: boolean }> }>
export function eventIsPublic(event: Record<string, any>, defaultVisibility?: string): boolean
export function eventOccurrences(event: Record<string, any>, from: string, to: string): Array<Record<string, any>>
export function safeEventUrl(value: unknown): string
