import Link from 'next/link'
import { LiveServiceClient } from '@/components/LiveServiceClient'
import { loadLiveService } from '@/lib/loadLiveService'

export const metadata = { title: 'Live translation' }
export const dynamic = 'force-dynamic'

export default async function TranslatePage() {
  const settings = await loadLiveService()
  return <main className="live-page">
    <header><div><p className="eyebrow">{settings.churchName}</p><h1>Read and listen in your language</h1>
      <p>Live text and optional translated audio, wherever you join the service.</p></div>
      <Link className="text-link" href="/live">Watch the video stream →</Link>
    </header>
    <LiveServiceClient settings={settings} />
  </main>
}
