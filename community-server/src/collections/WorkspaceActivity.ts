import type { CollectionConfig } from 'payload'
import { manageCommunityContent } from '@/access'
import { WORKSPACE_SCREENS } from '@/lib/workspaceActivity'

export const WorkspaceActivity: CollectionConfig = {
  slug: 'workspace-activity',
  admin: { hidden: true },
  indexes: [{ fields: ['community', 'user'], unique: true }],
  access: { read: manageCommunityContent, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'community', type: 'relationship', relationTo: 'communities', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'screen', type: 'select', required: true, options: Object.entries(WORKSPACE_SCREENS).map(([value, label]) => ({ value, label })) },
    { name: 'lastNavigationAt', type: 'date', required: true },
    { name: 'lastActiveAt', type: 'date', required: true, index: true },
    { name: 'navigationCount', type: 'number', required: true, defaultValue: 1, min: 1 },
  ],
}
