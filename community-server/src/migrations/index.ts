import * as migration_20260711_075027_initial_schema from './20260711_075027_initial_schema';
import * as migration_20260722_175750_community_admin_invitations from './20260722_175750_community_admin_invitations';

export const migrations = [
  {
    up: migration_20260711_075027_initial_schema.up,
    down: migration_20260711_075027_initial_schema.down,
    name: '20260711_075027_initial_schema',
  },
  {
    up: migration_20260722_175750_community_admin_invitations.up,
    down: migration_20260722_175750_community_admin_invitations.down,
    name: '20260722_175750_community_admin_invitations'
  },
];
