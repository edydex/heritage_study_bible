import CalendarBrowser from '../../../../packages/calendar-ui/CalendarBrowser.jsx'
import { feedLinks } from '@/lib/calendarFeeds'

export const metadata = { title: 'Calendar — Heritage Community' }
export const dynamic = 'force-dynamic'

export default function CalendarPage() {
  const links = feedLinks(0, null)
  return <main className="site-main">
    <CalendarBrowser showTimes />
    <section id="subscribe" className="calendar-subscribe">
      <h2>Get the church calendar on your phone</h2>
      <p>Subscribe once and new events, changed times and cancelled dates appear in your calendar app by themselves.</p>
      <div className="button-row">
        <a className="button button--primary" href={links.public.webcal}>Subscribe in my calendar app</a>
        <a className="button" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(links.public.webcal)}`} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
      </div>
      <p className="calendar-subscribe__note">Members-only events are in the members’ calendar link, which your church shares with members.</p>
    </section>
  </main>
}
