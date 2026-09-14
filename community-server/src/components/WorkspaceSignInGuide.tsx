import { communityPublicConfig } from '@/lib/publicConfig'

export default function WorkspaceSignInGuide() {
  return <section style={{ marginBottom: '24px', textAlign: 'center' }} aria-label="Church workspace sign-in">
    <h1 style={{ fontSize: '26px', marginBottom: '12px' }}>{communityPublicConfig.name} workspace</h1>
    <p>Sign in with your church manager account to prepare services, manage resources and control live translation.</p>
    <p style={{ opacity: 0.75 }}>Heritage reading sync has a separate sign-in. If you need workspace access, contact your church administrator.</p>
    <a href="/">Back to the church website</a>
  </section>
}
