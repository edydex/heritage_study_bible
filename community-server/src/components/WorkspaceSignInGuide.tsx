import { communityPublicConfig } from '@/lib/publicConfig'
import WorkspaceSignInGuideClient from './WorkspaceSignInGuideClient'

export default function WorkspaceSignInGuide() {
  return <WorkspaceSignInGuideClient name={communityPublicConfig.name} />
}
