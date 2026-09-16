import type { ComponentType, ReactNode } from 'react'
declare const EventDetails: ComponentType<{ eventId: string, date?: string | null, load?: (path: string) => Promise<any>, backHref?: string, renderActions?: (event: any) => ReactNode }>
export default EventDetails
