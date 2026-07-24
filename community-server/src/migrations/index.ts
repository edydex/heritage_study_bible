import * as migration_20260711_075027_initial_schema from './20260711_075027_initial_schema';
import * as migration_20260724_044857_song_admin_bilingual_rights from './20260724_044857_song_admin_bilingual_rights';
import * as migration_20260724_235000_song_community_translation from './20260724_235000_song_community_translation';

export const migrations = [
  {
    up: migration_20260711_075027_initial_schema.up,
    down: migration_20260711_075027_initial_schema.down,
    name: '20260711_075027_initial_schema'
  },
  {
    up: migration_20260724_044857_song_admin_bilingual_rights.up,
    down: migration_20260724_044857_song_admin_bilingual_rights.down,
    name: '20260724_044857_song_admin_bilingual_rights'
  },
  {
    up: migration_20260724_235000_song_community_translation.up,
    down: migration_20260724_235000_song_community_translation.down,
    name: '20260724_235000_song_community_translation'
  },
];
