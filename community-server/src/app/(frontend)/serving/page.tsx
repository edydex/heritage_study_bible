import ServingResponse from '@/components/ServingResponse'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your serving schedule', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function ServingPage() {
  return <main className="site-main"><ServingResponse /></main>
}
