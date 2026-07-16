import type { ReactNode } from 'react'
import './styles.css'

export const metadata = {
  title: 'Heritage Community Server',
  description: 'A self-hosted church community and content server for Heritage Study Bible.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
