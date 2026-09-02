import { communityPublicConfig } from '@/lib/publicConfig'

const actions = [
  {
    href: '/admin/plan-service',
    title: 'Plan Sunday’s service',
    text: 'Build the order with songs, Scripture, sermon slides, and media in one simple workspace.',
  },
  {
    href: '/admin/prepare-sermon',
    title: 'Prepare a sermon',
    text: 'Paste the pastor’s manuscript or slide notes, confirm the primary passage, and create one private Ready sermon for planning and SyncShow.',
  },
  {
    href: '/admin/sermon-publications',
    title: 'Publish a sermon',
    text: 'Review the exact sermon text, audio, and video before it appears on the public website.',
  },
]

export default function AdminWelcome() {
  return (
    <section className="heritage-admin-welcome">
      <p className="heritage-admin-eyebrow">Church workspace</p>
      <h1>What are you working on?</h1>
      <p className="heritage-admin-intro">
        Start with the Sunday service. The song and sermon libraries are always available from the small menu on the left.
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
        <a href="/" target="_blank">Open {communityPublicConfig.name} website</a>
        <a href="/songs">Browse public song titles</a>
        <a href="/sermons">Browse public sermons</a>
      </div>
    </section>
  )
}
