import PublicEventPage from '@/components/PublicEventPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Event — Heritage Community', robots: { index: false, follow: false } }

export default async function EventPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const query = await searchParams
  return <main className="site-main"><PublicEventPage eventId={id} date={typeof query.date === 'string' ? query.date : undefined} /></main>
}
