import { communityPublicConfig } from '@/lib/publicConfig'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main>
      <section className="card">
        <p>Heritage Community</p>
        <h1>{communityPublicConfig.name}</h1>
        <p>{communityPublicConfig.description}</p>
        <p>This server provides church resources, member sign-in, events, and RSVPs to compatible Heritage apps.</p>
        <div className="actions">
          <a href="/admin">Open admin</a>
          <a href="/.well-known/heritage-community.json">Community manifest</a>
          <a href="/heritage-content.json">Content manifest</a>
        </div>
      </section>
    </main>
  )
}
