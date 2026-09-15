import type { ComponentType } from 'react'
declare const CalendarGrid: ComponentType<{ month: string; onMonthChange: (month: string) => void; events?: Array<Record<string, any>>; timeZone?: string; onDateSelect?: (date: string) => void; onEventSelect?: (event: Record<string, any>) => void; selectedDate?: string; busy?: boolean; defaultRecurring?: boolean; showEmpty?: boolean; onFilterChange?: (filters: { events: boolean; recurring: boolean }) => void; create?: boolean }>
export default CalendarGrid
