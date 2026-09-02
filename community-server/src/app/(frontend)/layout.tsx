import type { ReactNode } from 'react'
import { PublicSiteHeader } from '@/components/PublicSiteHeader'
import './styles.css'

export const metadata = {
  title: {
    default: 'Word of Truth Bible Church',
    template: '%s — Word of Truth Bible Church',
  },
  description: 'Sermons, songs, and live translated audio from Word of Truth Bible Church.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PublicSiteHeader />
        {children}
        <footer className="site-footer">
          <p>Word of Truth Bible Church</p>
          <a href="/admin">Church admin</a>
        </footer>
      </body>
    </html>
  )
}
