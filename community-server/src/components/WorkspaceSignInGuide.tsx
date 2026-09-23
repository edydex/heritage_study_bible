import { communityPublicConfig } from '@/lib/publicConfig'

export default function WorkspaceSignInGuide() {
  return <section style={{ marginBottom: '24px', textAlign: 'center' }} aria-label="Church workspace sign-in">
    <h1 style={{ fontSize: '26px', marginBottom: '12px' }}>{communityPublicConfig.name} workspace</h1>
    <p>Sign in with your church manager account to prepare services, manage resources and control live translation.</p>
    <p style={{ opacity: 0.75 }}>Invited as a leader or administrator? Open the workspace invitation email to set your password, or use Forgot Password below. Heritage reading sync has a separate sign-in.</p>
    <a href="/">Back to the church website</a>
  </section>
}
