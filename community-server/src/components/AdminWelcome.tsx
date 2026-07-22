import { communityPublicConfig } from '@/lib/publicConfig'

const actions = [
  {
    href: '/admin/collections/sermons/create',
    title: 'Add a sermon',
    text: 'Publish a message, transcript, Scripture references, and recordings.',
  },
  {
    href: '/admin/collections/reading-plans/create',
    title: 'Build a Bible plan',
    text: 'Arrange passages and short notes into ordered reading days.',
  },
  {
    href: '/admin/collections/community-invites/create',
    title: 'Invite a person',
    text: 'Allow an email address to join the church in Heritage.',
  },
  {
    href: '/admin/collections/events/create',
    title: 'Create an event',
    text: 'Add the time, place, reminder, and RSVP choice members will see.',
  },
]

export default function AdminWelcome() {
  return (
    <section className="heritage-admin-welcome">
      <p className="heritage-admin-eyebrow">Heritage Community</p>
      <h1>{communityPublicConfig.name} admin</h1>
      <p className="heritage-admin-intro">
        Start with one ordinary task. Draft content stays private until its status is changed to Published.
      </p>
      <div className="heritage-admin-actions">
        {actions.map(action => (
          <a href={action.href} key={action.href}>
            <strong>{action.title}</strong>
            <span>{action.text}</span>
          </a>
        ))}
      </div>
      <div className="heritage-admin-links">
        <a href="/" target="_blank">Open server home</a>
        <a href="/heritage-content.json" target="_blank">Check public content feed</a>
        <span>Server health and backups: <code>sudo heritage-community status</code></span>
      </div>
    </section>
  )
}
