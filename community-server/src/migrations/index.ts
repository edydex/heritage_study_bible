import * as migration_20260711_075027_initial_schema from './20260711_075027_initial_schema';
import * as migration_20260722_175750_community_admin_invitations from './20260722_175750_community_admin_invitations';
import * as migration_20260724_044857_song_admin_bilingual_rights from './20260724_044857_song_admin_bilingual_rights';
import * as migration_20260724_050638_invitation_email_delivery from './20260724_050638_invitation_email_delivery';
import * as migration_20260724_235000_song_community_translation from './20260724_235000_song_community_translation';
import * as migration_20260725_160000_syncshow_song_library from './20260725_160000_syncshow_song_library';
import * as migration_20260728_234856_syncshow_sermon_roundtrip from './20260728_234856_syncshow_sermon_roundtrip';
import * as migration_20260729_002359_syncshow_sermon_publications from './20260729_002359_syncshow_sermon_publications';
import * as migration_20260729_005039_service_plans from './20260729_005039_service_plans';
import * as migration_20260729_005827_sermon_passage_index from './20260729_005827_sermon_passage_index';
import * as migration_20260729_010500_syncshow_song_public_links from './20260729_010500_syncshow_song_public_links';
import * as migration_20260729_045710_syncshow_sermon_change_sources from './20260729_045710_syncshow_sermon_change_sources';
import * as migration_20260729_130000_service_plan_sermon_readings from './20260729_130000_service_plan_sermon_readings';
import * as migration_20260729_220000_canonical_sermon_preached_date_projection from './20260729_220000_canonical_sermon_preached_date_projection';
import * as migration_20260730_120000_song_member_sharing from './20260730_120000_song_member_sharing';
import * as migration_20260730_230000_sermon_media_staging from './20260730_230000_sermon_media_staging';
import * as migration_20260813_120000_service_documents from './20260813_120000_service_documents';

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
  {
    up: migration_20260728_234856_syncshow_sermon_roundtrip.up,
    down: migration_20260728_234856_syncshow_sermon_roundtrip.down,
    name: '20260728_234856_syncshow_sermon_roundtrip',
  },
  {
    up: migration_20260729_002359_syncshow_sermon_publications.up,
    down: migration_20260729_002359_syncshow_sermon_publications.down,
    name: '20260729_002359_syncshow_sermon_publications',
  },
  {
    up: migration_20260729_005039_service_plans.up,
    down: migration_20260729_005039_service_plans.down,
    name: '20260729_005039_service_plans',
  },
  {
    up: migration_20260729_005827_sermon_passage_index.up,
    down: migration_20260729_005827_sermon_passage_index.down,
    name: '20260729_005827_sermon_passage_index',
  },
  {
    up: migration_20260729_010500_syncshow_song_public_links.up,
    down: migration_20260729_010500_syncshow_song_public_links.down,
    name: '20260729_010500_syncshow_song_public_links',
  },
  {
    up: migration_20260729_045710_syncshow_sermon_change_sources.up,
    down: migration_20260729_045710_syncshow_sermon_change_sources.down,
    name: '20260729_045710_syncshow_sermon_change_sources'
  },
  {
    up: migration_20260729_130000_service_plan_sermon_readings.up,
    down: migration_20260729_130000_service_plan_sermon_readings.down,
    name: '20260729_130000_service_plan_sermon_readings',
  },
  {
    up: migration_20260729_220000_canonical_sermon_preached_date_projection.up,
    down: migration_20260729_220000_canonical_sermon_preached_date_projection.down,
    name: '20260729_220000_canonical_sermon_preached_date_projection',
  },
  {
    up: migration_20260730_120000_song_member_sharing.up,
    down: migration_20260730_120000_song_member_sharing.down,
    name: '20260730_120000_song_member_sharing',
  },
  {
    up: migration_20260730_230000_sermon_media_staging.up,
    down: migration_20260730_230000_sermon_media_staging.down,
    name: '20260730_230000_sermon_media_staging',
  },
  {
    up: migration_20260813_120000_service_documents.up,
    down: migration_20260813_120000_service_documents.down,
    name: '20260813_120000_service_documents',
  },
];
