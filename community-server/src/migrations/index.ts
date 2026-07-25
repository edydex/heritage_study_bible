import * as migration_20260711_075027_initial_schema from './20260711_075027_initial_schema';
import * as migration_20260722_175750_community_admin_invitations from './20260722_175750_community_admin_invitations';
import * as migration_20260724_044857_song_admin_bilingual_rights from './20260724_044857_song_admin_bilingual_rights';
import * as migration_20260724_050638_invitation_email_delivery from './20260724_050638_invitation_email_delivery';
import * as migration_20260724_235000_song_community_translation from './20260724_235000_song_community_translation';
import * as migration_20260725_160000_syncshow_song_library from './20260725_160000_syncshow_song_library';

export const migrations = [
  {
    up: migration_20260711_075027_initial_schema.up,
    down: migration_20260711_075027_initial_schema.down,
    name: '20260711_075027_initial_schema',
  },
  {
    up: migration_20260722_175750_community_admin_invitations.up,
    down: migration_20260722_175750_community_admin_invitations.down,
    name: '20260722_175750_community_admin_invitations',
  },
  {
    up: migration_20260724_044857_song_admin_bilingual_rights.up,
    down: migration_20260724_044857_song_admin_bilingual_rights.down,
    name: '20260724_044857_song_admin_bilingual_rights',
  },
  {
    up: migration_20260724_050638_invitation_email_delivery.up,
    down: migration_20260724_050638_invitation_email_delivery.down,
    name: '20260724_050638_invitation_email_delivery',
  },
  {
    up: migration_20260724_235000_song_community_translation.up,
    down: migration_20260724_235000_song_community_translation.down,
    name: '20260724_235000_song_community_translation',
  },
  {
    up: migration_20260725_160000_syncshow_song_library.up,
    down: migration_20260725_160000_syncshow_song_library.down,
    name: '20260725_160000_syncshow_song_library',
  },
];
