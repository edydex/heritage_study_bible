import Link from 'next/link'
import { LiveServiceClient } from '@/components/LiveServiceClient'
import { loadLiveService } from '@/lib/loadLiveService'

export const metadata = { title: 'Live service' }
export const dynamic = 'force-dynamic'

export default async function LivePage() {
  const settings = await loadLiveService()
  return <main className="live-page">
    <header><div><p className="eyebrow">{settings.churchName}</p><h1>Join the live service</h1>
      <p>Watch the service, choose your audio, and read along in your language.</p></div>
      <Link className="text-link" href="/translate">Translation without video →</Link>
    </header>
    <LiveServiceClient settings={settings} video />
  </main>
}
