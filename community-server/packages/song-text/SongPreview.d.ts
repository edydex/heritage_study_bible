import type { ReactNode } from 'react'
export type SongPreviewSection = { label?: string; lines: string[]; language?: string }
export default function SongPreview(props: { children: ReactNode; title: string; sections?: SongPreviewSection[]; loadSections?: (signal: AbortSignal) => Promise<SongPreviewSection[]>; block?: boolean }): ReactNode
