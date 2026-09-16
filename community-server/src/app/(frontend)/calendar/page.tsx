import CalendarBrowser from '../../../../packages/calendar-ui/CalendarBrowser.jsx'

export const metadata = { title: 'Calendar — Heritage Community' }
export const dynamic = 'force-dynamic'

export default function CalendarPage() {
  return <main className="site-main"><CalendarBrowser /></main>
}
