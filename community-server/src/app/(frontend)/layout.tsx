import type { ReactNode } from 'react'
import { PublicSiteHeader } from '@/components/PublicSiteHeader'
import { loadLiveService } from '@/lib/loadLiveService'
import './styles.css'

export async function generateMetadata() {
  const { churchName } = await loadLiveService()
  return {
    title: { default: churchName, template: `%s — ${churchName}` },
    description: `Sermons, songs, and live translated audio from ${churchName}.`,
  }
}

export default async function Layout({ children }: { children: ReactNode }) {
  const { churchName } = await loadLiveService()
  return (
    <html lang="en">
      <body>
        <PublicSiteHeader churchName={churchName} />
        {children}
        <footer className="site-footer">
          <p>{churchName}</p>
          <a href="/admin">Church admin</a>
        </footer>
      </body>
    </html>
  )
}
