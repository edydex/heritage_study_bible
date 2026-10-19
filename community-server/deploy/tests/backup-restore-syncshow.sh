#!/usr/bin/env bash
set -Eeuo pipefail

# This is intentionally a destructive recovery regression. It may run only in
# GitHub Actions with the exact disposable marker, and it creates a second
# Compose project with unique database, uploaded-media, and private-sermon
# volumes before touching data.
DISPOSABLE_MARKER='heritage-community-syncshow-backup-restore-v1'
if [[ "${HERITAGE_DISPOSABLE_CI:-}" != "${DISPOSABLE_MARKER}" ]]; then
  printf 'ERROR: exact HERITAGE_DISPOSABLE_CI marker is required.\n' >&2
  exit 64
fi
if [[ "${CI:-}" != "true" || "${GITHUB_ACTIONS:-}" != "true" ]]; then
  printf 'ERROR: this destructive regression is restricted to GitHub Actions CI.\n' >&2
  exit 64
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEPLOY_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
SERVER_DIR="$(cd -- "${DEPLOY_DIR}/.." && pwd -P)"
# shellcheck source=../lib/common.sh
source "${DEPLOY_DIR}/lib/common.sh"
cd -- "${SERVER_DIR}" || heritage_die "Cannot enter the Community server directory."

BASE_ENV_FILE="${SERVER_DIR}/.env.production"
[[ -f "${BASE_ENV_FILE}" ]] || heritage_die "CI production environment is missing."

base_community_id="$(heritage_env_value COMMUNITY_ID "${BASE_ENV_FILE}")"
base_database="$(heritage_env_value POSTGRES_DB "${BASE_ENV_FILE}")"
base_database_user="$(heritage_env_value POSTGRES_USER "${BASE_ENV_FILE}")"
base_database_password="$(heritage_env_value POSTGRES_PASSWORD "${BASE_ENV_FILE}")"
base_database_url="$(heritage_env_value DATABASE_URL "${BASE_ENV_FILE}")"
base_public_url="$(heritage_env_value COMMUNITY_PUBLIC_URL "${BASE_ENV_FILE}")"
base_local_port="$(heritage_env_value COMMUNITY_LOCAL_PORT "${BASE_ENV_FILE}")"
base_tunnel_token="$(heritage_env_value TUNNEL_TOKEN "${BASE_ENV_FILE}")"
[[ "${base_community_id}" == "ci-church" ]] || \
  heritage_die "Disposable restore requires COMMUNITY_ID=ci-church."
[[ "${base_database}" == "heritage_community" ]] || \
  heritage_die "Disposable restore requires POSTGRES_DB=heritage_community."
[[ "${base_database_user}" == "heritage" ]] || \
  heritage_die "Disposable restore requires POSTGRES_USER=heritage."
[[ "${base_database_password}" == "ci-database-password" ]] || \
  heritage_die "Disposable restore requires the exact CI database password."
[[ "${base_database_url}" \
  == "postgresql://heritage:ci-database-password@postgres:5432/heritage_community" ]] || \
  heritage_die "Disposable restore requires the exact container-local CI DATABASE_URL."
[[ "${base_public_url}" == "http://127.0.0.1:3300" ]] || \
  heritage_die "Disposable restore requires the expected loopback public URL."
[[ "${base_local_port}" == "3300" ]] || \
  heritage_die "Disposable restore requires the expected loopback port."
[[ -z "${base_tunnel_token}" ]] || \
  heritage_die "Disposable restore refuses any configured tunnel token."
[[ -z "${DOCKER_HOST:-}" && -z "${DOCKER_CONTEXT:-}" ]] || \
  heritage_die "Disposable restore refuses a non-default Docker target."

heritage_require_command awk
heritage_require_command base64
heritage_require_command cmp
heritage_require_command curl
heritage_require_command find
heritage_require_command jq
heritage_require_command node
heritage_require_command sha256sum

umask 077
WORK_PARENT="${RUNNER_TEMP:-/tmp}"
[[ "${WORK_PARENT}" == /* && "${WORK_PARENT}" != "/" ]] || \
  heritage_die "RUNNER_TEMP must be a non-root absolute path."
[[ -d "${WORK_PARENT}" ]] || heritage_die "RUNNER_TEMP does not exist."
WORK_PARENT="$(cd -- "${WORK_PARENT}" && pwd -P)"
[[ "${WORK_PARENT}" != "/" ]] || heritage_die "RUNNER_TEMP resolved to root."
WORK_ROOT="$(mktemp -d "${WORK_PARENT%/}/heritage-community-syncshow-restore.XXXXXX")"
case "${WORK_ROOT}" in
  "${WORK_PARENT%/}"/heritage-community-syncshow-restore.*) ;;
  *) heritage_die "mktemp returned an unexpected disposable path." ;;
esac

work_basename="$(basename -- "${WORK_ROOT}")"
work_token="$(printf '%s' "${work_basename}" \
  | tr '[:upper:]' '[:lower:]' \
  | tr -cs 'a-z0-9_-' '-')"
project_name="ci-${work_token}"
postgres_volume="${project_name}-postgres"
media_volume="${project_name}-media"
sermon_media_volume="${project_name}-sermon-media"
test_port=3310
test_public_url="http://127.0.0.1:${test_port}"
test_env="${WORK_ROOT}/community.env"
backup_root="${WORK_ROOT}/backups"
manifest_path="${WORK_ROOT}/fixture.json"
expected_db="${WORK_ROOT}/database.expected"
after_db="${WORK_ROOT}/database.after"
expected_media="${WORK_ROOT}/media.expected"
after_media="${WORK_ROOT}/media.after"
expected_recording="${WORK_ROOT}/recording.expected"
after_recording="${WORK_ROOT}/recording.after"
expected_detail="${WORK_ROOT}/detail.expected"
expected_catalog="${WORK_ROOT}/catalog.expected"
expected_passage="${WORK_ROOT}/passage.expected"
compose_verified=0

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  set +e
  if (( compose_verified )); then
    if ! heritage_compose down --volumes --remove-orphans >/dev/null 2>&1; then
      heritage_warn "Could not remove the disposable Compose project and volumes."
      if (( status == 0 )); then
        status=1
      fi
    fi
  fi
  case "${WORK_ROOT:-}" in
    "${WORK_PARENT%/}"/heritage-community-syncshow-restore.*)
      rm -rf -- "${WORK_ROOT}"
      ;;
  esac
  exit "${status}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cp -- "${BASE_ENV_FILE}" "${test_env}"
chmod 600 "${test_env}"

set_env_value() {
  local key="$1"
  local value="$2"
  local next="${test_env}.next"
  awk -v wanted="${key}" -v replacement="${value}" '
    BEGIN { found = 0 }
    $0 ~ "^[[:space:]]*" wanted "[[:space:]]*=" {
      if (!found) print wanted "=" replacement
      found = 1
      next
    }
    { print }
    END {
      if (!found) print wanted "=" replacement
    }
  ' "${test_env}" >"${next}"
  chmod 600 "${next}"
  mv -- "${next}" "${test_env}"
}

set_env_value COMMUNITY_PUBLIC_URL "${test_public_url}"
set_env_value COMMUNITY_LOCAL_PORT "${test_port}"
set_env_value HERITAGE_POSTGRES_VOLUME "${postgres_volume}"
set_env_value HERITAGE_MEDIA_VOLUME "${media_volume}"
set_env_value HERITAGE_SERMON_MEDIA_VOLUME "${sermon_media_volume}"
set_env_value TUNNEL_TOKEN ""

export POSTGRES_DB=heritage_community
export POSTGRES_USER=heritage
export POSTGRES_PASSWORD=ci-database-password
export DATABASE_URL=postgresql://heritage:ci-database-password@postgres:5432/heritage_community
export COMMUNITY_ID=ci-church
export COMMUNITY_PUBLIC_URL="${test_public_url}"
export COMMUNITY_LOCAL_PORT="${test_port}"
export HERITAGE_POSTGRES_VOLUME="${postgres_volume}"
export HERITAGE_MEDIA_VOLUME="${media_volume}"
export HERITAGE_SERMON_MEDIA_VOLUME="${sermon_media_volume}"
export TUNNEL_TOKEN=""
export HERITAGE_INSTALL_DIR="${SERVER_DIR}"
export HERITAGE_COMPOSE_FILE="${SERVER_DIR}/docker-compose.production.yml"
export HERITAGE_ENV_FILE="${test_env}"
export HERITAGE_PROJECT_NAME="${project_name}"
export HERITAGE_BACKUP_DIR="${backup_root}"

heritage_init_context
heritage_init_docker

resolved_compose="${WORK_ROOT}/compose.json"
heritage_compose --profile operations config --format json >"${resolved_compose}"
jq -e \
  --arg postgres "${postgres_volume}" \
  --arg media "${media_volume}" \
  --arg sermon_media "${sermon_media_volume}" \
  --arg project "${project_name}" \
  '
    .name == $project
    and .volumes["postgres-data"].name == $postgres
    and .volumes.media.name == $media
    and .volumes["sermon-media"].name == $sermon_media
    and (.services.postgres.volumes | any(.source == "postgres-data"))
    and (.services.community.volumes | any(.source == "media"))
    and (.services.community.volumes | any(
      .source == "sermon-media"
      and .target == "/app/private/sermon-media"
      and .type == "volume"
    ))
    and .services.postgres.environment.POSTGRES_DB == "heritage_community"
    and .services.postgres.environment.POSTGRES_USER == "heritage"
    and .services.postgres.environment.POSTGRES_PASSWORD
      == "ci-database-password"
    and .services.community.environment.DATABASE_URL
      == "postgresql://heritage:ci-database-password@postgres:5432/heritage_community"
    and .services.migrate.environment.DATABASE_URL
      == "postgresql://heritage:ci-database-password@postgres:5432/heritage_community"
    and .services.community.environment.COMMUNITY_ID == "ci-church"
    and .services.migrate.environment.COMMUNITY_ID == "ci-church"
    and .services.community.environment.HERITAGE_SERMON_MEDIA_PATH
      == "/app/private/sermon-media"
    and .services.community.environment.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
      == "false"
    and .services.community.environment.HERITAGE_SERMON_MEDIA_MAX_ACTIVE_GLOBAL
      == "8"
    and .services.community.environment.HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_COMMUNITY
      == "4"
    and .services.community.environment.HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_CONNECTION
      == "2"
    and .services.community.environment.HERITAGE_SERMON_MEDIA_MAX_FINALIZING_GLOBAL
      == "1"
    and .services.community.environment.HERITAGE_SERMON_MEDIA_MAX_RETAINED_BYTES_PER_COMMUNITY
      == "53687091200"
    and .services.community.environment.HERITAGE_SERMON_MEDIA_MAX_RETAINED_OBJECTS_PER_COMMUNITY
      == "2000"
    and .services.community.environment.HERITAGE_SERMON_MEDIA_STORAGE_RESERVE_BYTES
      == "5368709120"
    and .services["sermon-media-maintenance"].environment.HERITAGE_SERMON_MEDIA_MAINTENANCE_QUIESCED
      == "false"
    and .services["sermon-media-maintenance"].environment.HERITAGE_SERMON_MEDIA_MAINTENANCE_REQUIRE_BACKUP_READY
      == "false"
    and (.services["sermon-media-maintenance"].volumes | any(
      .source == "sermon-media"
      and .target == "/app/private/sermon-media"
      and .type == "volume"
    ))
    and .services.community.environment.COMMUNITY_PUBLIC_URL
      == "http://127.0.0.1:3310"
    and .services.migrate.environment.COMMUNITY_PUBLIC_URL
      == "http://127.0.0.1:3310"
    and (.services.community.ports | any(
      .host_ip == "127.0.0.1"
      and (.published | tostring) == "3310"
      and (.target | tostring) == "3000"
    ))
  ' "${resolved_compose}" >/dev/null \
  || heritage_die "Resolved Compose storage is not the unique disposable project."
set_env_value HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED true
heritage_compose --profile operations config --format json \
  | jq -e '
      .services.community.environment.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
        == "true"
      and .services["sermon-media-maintenance"].environment.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
        == "true"
    ' >/dev/null \
  || heritage_die "Resolved Compose does not propagate explicit managed recording enablement."
set_env_value HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED false
[[ "${postgres_volume}" != "heritage-community-postgres" ]] || \
  heritage_die "Disposable PostgreSQL volume resolved to the production default."
[[ "${media_volume}" != "heritage-community-media" ]] || \
  heritage_die "Disposable media volume resolved to the production default."
[[ "${sermon_media_volume}" != "heritage-community-sermon-media" ]] || \
  heritage_die "Disposable private-sermon volume resolved to the production default."
[[ "${postgres_volume}" != "${media_volume}" \
  && "${postgres_volume}" != "${sermon_media_volume}" \
  && "${media_volume}" != "${sermon_media_volume}" ]] \
  || heritage_die "Disposable storage names are not isolated from each other."
if heritage_docker volume inspect "${postgres_volume}" >/dev/null 2>&1; then
  heritage_die "Refusing to reuse an existing disposable PostgreSQL volume."
fi
if heritage_docker volume inspect "${media_volume}" >/dev/null 2>&1; then
  heritage_die "Refusing to reuse an existing disposable media volume."
fi
if heritage_docker volume inspect "${sermon_media_volume}" >/dev/null 2>&1; then
  heritage_die "Refusing to reuse an existing disposable private-sermon volume."
fi
if [[ -n "$(heritage_compose ps --all --quiet 2>/dev/null)" ]]; then
  heritage_die "Refusing to reuse an existing disposable Compose project."
fi
compose_verified=1

heritage_info "Starting the isolated disposable production stack."
heritage_compose up -d postgres >/dev/null
heritage_wait_for_postgres 60 || heritage_die "Disposable PostgreSQL did not become ready."
heritage_compose --profile operations run --rm -T migrate
heritage_compose up -d community >/dev/null

for attempt in $(seq 1 60); do
  if curl -fsS --max-time 5 \
    "${test_public_url}/.well-known/heritage-community.json" >/dev/null; then
    break
  fi
  if [[ "${attempt}" == "60" ]]; then
    heritage_compose logs --tail 200 >&2
    heritage_die "Disposable Community app did not become ready."
  fi
  sleep 2
done

heritage_info "Proving online backup refuses explicit managed recording enablement even while empty."
set_env_value HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED true
if "${DEPLOY_DIR}/backup.sh" \
  --install-dir "${SERVER_DIR}" \
  --output-dir "${backup_root}" \
  --retention-days 0 \
  --label online-enabled-must-refuse \
  --online >/dev/null 2>&1; then
  heritage_die "Online backup accepted enabled managed recording upload."
fi
set_env_value HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED false
if find "${backup_root}" -mindepth 1 -maxdepth 1 \
  \( -type d -name 'backup-20*' -o -type d -name '.partial-*' \) \
  -print -quit | grep -q .; then
  heritage_die "Failed enabled online backup published or leaked a partial backup."
fi

FIXTURE_PATH="${SERVER_DIR}/../tests/fixtures/community-sermon-publication-conformance-v1.json" \
  node --import tsx --input-type=module >"${manifest_path}" <<'NODE'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  createSermonRevision,
  parseSermonDocument,
} from './src/lib/syncshow/SermonDocument.ts'
import {
  serializePublicSermonCatalogItem,
} from './src/lib/syncshow/PublicSermonPublication.ts'
import {
  COMMUNITY_SERVICE_PLAN_KIND,
  serializeCommunityServicePlan,
} from './src/lib/syncshow/CommunityServicePlan.ts'
import {
  buildSongPublicLinkSnapshot,
  hashSongPublicLinkIdempotencyKey,
  normalizeSongPublicLinkCreateRequest,
  songPublicLinkOperationHash,
  songPublicLinkReviewRevision,
} from './src/lib/syncshow/SongPublicLink.ts'

const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex')
const b64 = value => Buffer.from(value, 'utf8').toString('base64')
const fixture = JSON.parse(readFileSync(process.env.FIXTURE_PATH, 'utf8'))
const current = createSermonRevision(parseSermonDocument(fixture.documentSource))
if (
  current.sha256 !== fixture.publicationState.currentRevision
  || current.source !== fixture.documentSource
) {
  throw new Error('Published sermon conformance fixture is not canonical.')
}

const previousDocument = structuredClone(current.document)
previousDocument.titles.en = 'The Prayer That Transforms the Church — draft'
previousDocument.publication = {
  status: 'ready',
  visibility: 'private',
  publishedAt: null,
  canonicalUrl: null,
}
const previous = createSermonRevision(previousDocument)
if (previous.sha256 === current.sha256) {
  throw new Error('Historical sermon fixture did not produce a distinct revision.')
}

const catalogItemSource = serializePublicSermonCatalogItem(
  JSON.parse(fixture.catalogSource).items[0],
)
const plan = {
  schemaVersion: 1,
  kind: COMMUNITY_SERVICE_PLAN_KIND,
  id: 'backup-restore-service-plan',
  title: 'Disposable recovery service',
  serviceDate: '2026-08-02',
  startTime: '10:30',
  teamNotes: 'Exact recovery fixture.\nDo not use for a live service.',
  entries: [
    { id: 'opening', kind: 'section', title: 'Opening' },
    {
      id: 'song',
      kind: 'song',
      title: 'Recovery Song',
      syncId: 'backup-restore-song',
      expectedRevision: 'song:backup-restore-song:3',
      expectedSyncVersion: 3,
    },
    {
      id: 'reading',
      kind: 'scripture',
      title: 'Ephesians 3:14–21',
      range: {
        schemaVersion: 1,
        bookId: 'Eph',
        start: { chapter: 3, verse: 14 },
        end: { chapter: 3, verse: 21 },
      },
      translationId: 'BSB',
    },
    {
      id: 'sermon',
      kind: 'sermon',
      title: current.document.titles.en,
      syncId: current.document.id,
      expectedRevision: current.sha256,
      expectedSyncVersion: 8,
    },
  ],
}
const planSource = serializeCommunityServicePlan(plan)

const songSource = `---
id: backup-restore-song-document
title: Recovery Song
language: en
authors: ["CI Fixture"]
attribution: Direct permission recorded for this disposable fixture.
---

^1
Recovered words, exact and unchanged
`
const songDocument = {
  id: 'backup-restore-song-document',
  source: songSource,
  revision: sha256(songSource),
}
const snapshot = buildSongPublicLinkSnapshot({
  songSyncId: 'backup-restore-song',
  songSyncVersion: 3,
  documents: [songDocument],
})
const review = {
  scope: 'public-link',
  basis: 'direct-permission',
  evidence: 'Disposable CI fixture permission for anonymous display.',
  validUntil: null,
  validThrough: null,
  reviewedAt: '2026-07-28T19:00:00.000Z',
  familyRevision: snapshot.snapshot.familyRevision,
}
const request = normalizeSongPublicLinkCreateRequest({
  songSyncId: 'backup-restore-song',
  familyRevision: snapshot.snapshot.familyRevision,
  review,
  reviewRevision: songPublicLinkReviewRevision(review),
  label: 'Disposable recovery link',
  expiresAt: null,
}, { enforceCurrentTime: false })
const linkId = Buffer.alloc(32, 23).toString('base64url')
const issuedAt = '2026-07-28T20:00:00.000Z'
const revokedAt = '2026-07-28T20:05:00.000Z'
const connectionId = 1
const createKey = 'backup-restore-link-create'
const revokeKey = 'backup-restore-link-revoke'
const auditSource = JSON.stringify({
  schemaVersion: 1,
  events: [
    {
      type: 'created',
      at: issuedAt,
      source: 'syncshow',
      userId: 1,
      connectionId,
      songSyncVersion: 3,
      familyRevision: request.familyRevision,
      reviewRevision: request.reviewRevision,
    },
    {
      type: 'revoked',
      at: revokedAt,
      source: 'syncshow',
      userId: 1,
      connectionId,
    },
  ],
})
const mediaSource = 'heritage-syncshow-backup-restore-media-sentinel-v1\n'
const recordingSource = Buffer.from([
  0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x12, 0x48, 0x65, 0x72, 0x69, 0x74, 0x61,
  0x67, 0x65, 0x20, 0x72, 0x65, 0x63, 0x6f, 0x72,
  0x64, 0x69, 0x6e, 0x67, 0x0a,
])
const recordingChecksum = createHash('sha256')
  .update(recordingSource)
  .digest('hex')
const recordingCommunityNamespace = createHash('sha256')
  .update('heritage-sermon-media-community-v1\0', 'utf8')
  .update('1', 'ascii')
  .digest('hex')

process.stdout.write(JSON.stringify({
  currentSermonSourceB64: b64(current.source),
  currentSermonRevision: current.sha256,
  previousSermonSourceB64: b64(previous.source),
  previousSermonRevision: previous.sha256,
  sermonSyncId: current.document.id,
  songSyncId: 'backup-restore-song',
  planSyncId: plan.id,
  planEntryIdsB64: b64(JSON.stringify([
    'backup-restore-entry-opening',
    'backup-restore-entry-song',
    'backup-restore-entry-reading',
    'backup-restore-entry-sermon',
  ])),
  sermonSourcesB64: b64(JSON.stringify(current.document.sources)),
  publishedAt: fixture.publicationState.publishedAt,
  publicId: fixture.publicationState.publicId,
  selectedBodyEntryIdsB64: b64(JSON.stringify(
    fixture.publicationState.selectedBodyEntryIds,
  )),
  selectedMediaIdsB64: b64(JSON.stringify(
    fixture.publicationState.selectedMediaIds,
  )),
  detailChecksum: fixture.publicationState.detailChecksum,
  detailSourceB64: b64(fixture.detailSource),
  catalogItemChecksum: sha256(catalogItemSource),
  catalogItemSourceB64: b64(catalogItemSource),
  catalogChecksum: fixture.publicationState.catalogChecksum,
  catalogSourceB64: b64(fixture.catalogSource),
  passageIndexChecksum: fixture.publicationState.passageIndexChecksum,
  passageIndexSourceB64: b64(fixture.passageIndexSource),
  planRevision: sha256(planSource),
  planSourceB64: b64(planSource),
  planTitle: plan.title,
  planTeamNotesB64: b64(plan.teamNotes),
  songDocumentsB64: b64(JSON.stringify([songDocument])),
  songSnapshotChecksum: snapshot.checksum,
  songSnapshotSourceB64: b64(snapshot.source),
  songFamilyRevision: snapshot.snapshot.familyRevision,
  reviewRevision: request.reviewRevision,
  reviewSourceB64: b64(JSON.stringify(request.review)),
  auditSourceB64: b64(auditSource),
  linkId,
  createKeyHash: hashSongPublicLinkIdempotencyKey(createKey, {
    connectionId,
    operation: 'create',
  }),
  createRequestHash: songPublicLinkOperationHash({
    expectedSongVersion: 3,
    request,
  }),
  revokeKeyHash: hashSongPublicLinkIdempotencyKey(revokeKey, {
    connectionId,
    operation: 'revoke',
  }),
  revokeRequestHash: songPublicLinkOperationHash({
    linkId,
    expectedLinkVersion: 1,
  }),
  issuedAt,
  revokedAt,
  mediaFilename: 'syncshow-backup-restore-sentinel.txt',
  mediaSourceB64: Buffer.from(mediaSource, 'utf8').toString('base64'),
  mediaBytes: Buffer.byteLength(mediaSource, 'utf8'),
  mediaChecksum: sha256(mediaSource),
  recordingSourceB64: recordingSource.toString('base64'),
  recordingBytes: recordingSource.length,
  recordingChecksum,
  recordingCommunityNamespace,
  recordingRelativePath:
    `objects/${recordingCommunityNamespace}/sha256/${recordingChecksum.slice(0, 2)}/${recordingChecksum}`,
}))
NODE

jq -e '
  (.currentSermonRevision | test("^[a-f0-9]{64}$"))
  and (.previousSermonRevision | test("^[a-f0-9]{64}$"))
  and .currentSermonRevision != .previousSermonRevision
  and (.planRevision | test("^[a-f0-9]{64}$"))
  and (.mediaChecksum | test("^[a-f0-9]{64}$"))
  and (.recordingChecksum | test("^[a-f0-9]{64}$"))
  and (.recordingCommunityNamespace | test("^[a-f0-9]{64}$"))
  and (.recordingRelativePath
    == ("objects/" + .recordingCommunityNamespace + "/sha256/"
      + (.recordingChecksum[0:2]) + "/" + .recordingChecksum))
  and (.linkId | length >= 32)
' "${manifest_path}" >/dev/null \
  || heritage_die "Generated recovery fixture manifest is invalid."

manifest_value() {
  jq -er "$1" "${manifest_path}"
}

psql_cmd() {
  heritage_compose exec -T postgres sh -ec \
    'exec psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -v ON_ERROR_STOP=1 "$@"' \
    sh "$@"
}

heritage_info "Seeding canonical rows directly for backup semantics, not API semantics."
psql_cmd \
  -v current_sermon_b64="$(manifest_value '.currentSermonSourceB64')" \
  -v current_revision="$(manifest_value '.currentSermonRevision')" \
  -v previous_sermon_b64="$(manifest_value '.previousSermonSourceB64')" \
  -v previous_revision="$(manifest_value '.previousSermonRevision')" \
  -v sermon_sync_id="$(manifest_value '.sermonSyncId')" \
  -v sermon_sources_b64="$(manifest_value '.sermonSourcesB64')" \
  -v published_at="$(manifest_value '.publishedAt')" \
  -v public_id="$(manifest_value '.publicId')" \
  -v selected_body_b64="$(manifest_value '.selectedBodyEntryIdsB64')" \
  -v selected_media_b64="$(manifest_value '.selectedMediaIdsB64')" \
  -v detail_checksum="$(manifest_value '.detailChecksum')" \
  -v detail_source_b64="$(manifest_value '.detailSourceB64')" \
  -v catalog_item_checksum="$(manifest_value '.catalogItemChecksum')" \
  -v catalog_item_source_b64="$(manifest_value '.catalogItemSourceB64')" \
  -v catalog_checksum="$(manifest_value '.catalogChecksum')" \
  -v catalog_source_b64="$(manifest_value '.catalogSourceB64')" \
  -v passage_checksum="$(manifest_value '.passageIndexChecksum')" \
  -v passage_source_b64="$(manifest_value '.passageIndexSourceB64')" \
  -v plan_revision="$(manifest_value '.planRevision')" \
  -v plan_source_b64="$(manifest_value '.planSourceB64')" \
  -v plan_title="$(manifest_value '.planTitle')" \
  -v plan_notes_b64="$(manifest_value '.planTeamNotesB64')" \
  -v song_documents_b64="$(manifest_value '.songDocumentsB64')" \
  -v snapshot_checksum="$(manifest_value '.songSnapshotChecksum')" \
  -v snapshot_source_b64="$(manifest_value '.songSnapshotSourceB64')" \
  -v family_revision="$(manifest_value '.songFamilyRevision')" \
  -v review_revision="$(manifest_value '.reviewRevision')" \
  -v review_source_b64="$(manifest_value '.reviewSourceB64')" \
  -v audit_source_b64="$(manifest_value '.auditSourceB64')" \
  -v link_id="$(manifest_value '.linkId')" \
  -v create_key_hash="$(manifest_value '.createKeyHash')" \
  -v create_request_hash="$(manifest_value '.createRequestHash')" \
  -v revoke_key_hash="$(manifest_value '.revokeKeyHash')" \
  -v revoke_request_hash="$(manifest_value '.revokeRequestHash')" \
  -v issued_at="$(manifest_value '.issuedAt')" \
  -v revoked_at="$(manifest_value '.revokedAt')" \
  -v media_filename="$(manifest_value '.mediaFilename')" \
  -v media_bytes="$(manifest_value '.mediaBytes')" \
  -v recording_checksum="$(manifest_value '.recordingChecksum')" \
  -v recording_bytes="$(manifest_value '.recordingBytes')" \
  -v recording_namespace="$(manifest_value '.recordingCommunityNamespace')" \
  -v recording_relative_path="$(manifest_value '.recordingRelativePath')" <<'SQL'
BEGIN;
SELECT MIN("id") AS community_id
FROM "communities"
WHERE "slug" = 'ci-church'
HAVING COUNT(*) = 1
\gset

SELECT encode(sha256(
  convert_to('heritage-sermon-media-community-v1', 'UTF8')
  || decode('00', 'hex')
  || convert_to(:'community_id', 'UTF8')
), 'hex') = :'recording_namespace' AS recording_namespace_matches
\gset
\if :recording_namespace_matches
\else
  \echo 'disposable community relation ID did not match the recording namespace'
  \quit 3
\endif

SELECT (
  EXISTS (
    SELECT 1 FROM "songs" WHERE "sync_id" = 'backup-restore-song'
  ) OR EXISTS (
    SELECT 1 FROM "sermons" WHERE "sync_id" = :'sermon_sync_id'
  ) OR EXISTS (
    SELECT 1 FROM "service_plans"
    WHERE "sync_id" = 'backup-restore-service-plan'
  ) OR EXISTS (
    SELECT 1 FROM "syncshow_song_public_links" WHERE "link_id" = :'link_id'
  ) OR EXISTS (
    SELECT 1 FROM "media" WHERE "filename" = :'media_filename'
  )
) AS fixture_exists
\gset
\if :fixture_exists
  \echo 'disposable recovery fixture identities already exist'
  \quit 3
\endif

INSERT INTO "songs" (
  "community_id", "status", "title", "slug", "description", "lyrics",
  "rights_status", "sync_id", "visibility", "sync_version", "sync_documents"
) VALUES (
  :community_id, 'published', 'Recovery Song', 'backup-restore-song',
  'Disposable backup and restore fixture.',
  'Recovered words, exact and unchanged', 'permission-granted',
  'backup-restore-song', 'public', 3,
  convert_from(decode(:'song_documents_b64', 'base64'), 'UTF8')::jsonb
)
RETURNING "id" AS song_id
\gset

INSERT INTO "sermons" (
  "community_id", "status", "title", "slug", "description", "speaker",
  "preached_at", "transcript", "series", "sync_id", "sync_version",
  "sync_current_document_source", "sync_current_revision", "sync_archived",
  "sync_source_objects", "sync_changed_at", "sync_create_idempotency_key",
  "sync_create_idempotency_hash", "sync_publication_status", "sync_visibility"
) VALUES (
  :community_id, 'draft', 'The Prayer That Transforms the Church',
  'backup-restore-sermon', 'Disposable backup and restore fixture.',
  'Paul Lvutin', '2026-07-26T00:00:00.000Z',
  'The reviewed English sermon body.', 'From Pain to Unity',
  :'sermon_sync_id', 8,
  convert_from(decode(:'current_sermon_b64', 'base64'), 'UTF8'),
  :'current_revision', false,
  convert_from(decode(:'sermon_sources_b64', 'base64'), 'UTF8')::jsonb,
  '2026-07-28T20:00:00.000Z',
  'backup-restore-sermon-create',
  encode(sha256(convert_to('backup-restore-sermon-create', 'UTF8')), 'hex'),
  'published', 'public'
)
RETURNING "id" AS sermon_id
\gset

INSERT INTO "syncshow_sermon_changes" (
  "community_id", "sermon_id", "sync_id", "sync_version", "revision",
  "document_source", "archived", "changed_at"
) VALUES
  (
    :community_id, :sermon_id, :'sermon_sync_id', 7, :'previous_revision',
    convert_from(decode(:'previous_sermon_b64', 'base64'), 'UTF8'),
    false, '2026-07-28T19:30:00.000Z'
  ),
  (
    :community_id, :sermon_id, :'sermon_sync_id', 8, :'current_revision',
    convert_from(decode(:'current_sermon_b64', 'base64'), 'UTF8'),
    false, '2026-07-28T20:00:00.000Z'
  );

INSERT INTO "syncshow_sermon_publications" (
  "community_id", "sermon_id", "schema_version", "active", "visibility",
  "publication_version", "published_at", "withdrawn_at", "sync_id",
  "public_id", "public_revision", "published_document_source",
  "selected_body_entry_ids", "selected_media_ids", "detail_checksum",
  "detail_source", "catalog_item_checksum", "catalog_item_source"
) VALUES (
  :community_id, :sermon_id, 1, true, 'public', 1, :'published_at', NULL,
  :'sermon_sync_id', :'public_id', :'current_revision',
  convert_from(decode(:'current_sermon_b64', 'base64'), 'UTF8'),
  convert_from(decode(:'selected_body_b64', 'base64'), 'UTF8')::jsonb,
  convert_from(decode(:'selected_media_b64', 'base64'), 'UTF8')::jsonb,
  :'detail_checksum',
  convert_from(decode(:'detail_source_b64', 'base64'), 'UTF8'),
  :'catalog_item_checksum',
  convert_from(decode(:'catalog_item_source_b64', 'base64'), 'UTF8')
);

UPDATE "syncshow_sermon_publication_catalogs"
SET
  "schema_version" = 1,
  "generation" = 2,
  "changed_at" = :'published_at',
  "checksum" = :'catalog_checksum',
  "source" = convert_from(decode(:'catalog_source_b64', 'base64'), 'UTF8'),
  "passage_index_checksum" = :'passage_checksum',
  "passage_index_source" =
    convert_from(decode(:'passage_source_b64', 'base64'), 'UTF8')
WHERE "community_id" = :community_id
RETURNING "id" AS catalog_id
\gset

INSERT INTO "service_plans" (
  "community_id", "status", "service_date", "start_time", "title",
  "team_notes", "sync_id", "sync_version", "revision", "document_source",
  "changed_at"
) VALUES (
  :community_id, 'ready', '2026-08-02T00:00:00.000Z', '10:30',
  :'plan_title',
  convert_from(decode(:'plan_notes_b64', 'base64'), 'UTF8'),
  'backup-restore-service-plan', 9, :'plan_revision',
  convert_from(decode(:'plan_source_b64', 'base64'), 'UTF8'),
  '2026-07-28T20:00:00.000Z'
)
RETURNING "id" AS plan_id
\gset

INSERT INTO "service_plans_entries" (
  "_order", "_parent_id", "id", "entry_id", "kind", "title",
  "song_id", "sermon_id", "scripture_book_id", "scripture_start_chapter",
  "scripture_start_verse", "scripture_end_chapter", "scripture_end_verse",
  "scripture_translation_id", "resolved_sync_id", "resolved_sync_version",
  "resolved_revision"
) VALUES
  (
    0, :plan_id, 'backup-restore-entry-opening', 'opening', 'section',
    'Opening', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
  ),
  (
    1, :plan_id, 'backup-restore-entry-song', 'song', 'song',
    'Recovery Song', :song_id, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    'backup-restore-song', 3, 'song:backup-restore-song:3'
  ),
  (
    2, :plan_id, 'backup-restore-entry-reading', 'reading', 'scripture',
    'Ephesians 3:14–21', NULL, NULL, 'Eph', 3, 14, 3, 21, 'BSB',
    NULL, NULL, NULL
  ),
  (
    3, :plan_id, 'backup-restore-entry-sermon', 'sermon', 'sermon',
    'The Prayer That Transforms the Church', NULL, :sermon_id,
    NULL, NULL, NULL, NULL, NULL, NULL,
    :'sermon_sync_id', 8, :'current_revision'
  );

INSERT INTO "syncshow_song_public_links" (
  "community_id", "song_id", "schema_version", "link_id", "link_version",
  "song_sync_id", "song_sync_version", "family_revision", "review_revision",
  "label", "issued_at", "expires_at", "revoked_at", "snapshot_checksum",
  "snapshot_source", "review_source", "audit_source",
  "create_idempotency_key_hash", "create_request_hash",
  "revoke_idempotency_key_hash", "revoke_request_hash"
) VALUES (
  :community_id, :song_id, 1, :'link_id', 2, 'backup-restore-song', 3,
  :'family_revision', :'review_revision', 'Disposable recovery link',
  :'issued_at', NULL, :'revoked_at', :'snapshot_checksum',
  convert_from(decode(:'snapshot_source_b64', 'base64'), 'UTF8'),
  convert_from(decode(:'review_source_b64', 'base64'), 'UTF8'),
  convert_from(decode(:'audit_source_b64', 'base64'), 'UTF8'),
  :'create_key_hash', :'create_request_hash',
  :'revoke_key_hash', :'revoke_request_hash'
);

INSERT INTO "media" (
  "community_id", "status", "alt", "filename", "mime_type", "filesize"
) VALUES (
  :community_id, 'published', 'Disposable recovery sentinel',
  :'media_filename', 'text/plain', :'media_bytes'::numeric
);

INSERT INTO "syncshow_sermon_media_objects" (
  "community_id", "sha256", "size_bytes", "media_type", "storage_key",
  "verified_at"
) VALUES (
  :community_id, :'recording_checksum', :'recording_bytes'::bigint,
  'audio/mpeg', :'recording_relative_path', now()
);
COMMIT;
SQL

media_filename="$(manifest_value '.mediaFilename')"
manifest_value '.mediaSourceB64' | base64 --decode >"${expected_media}"
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'umask 077; exec dd of="/app/media/syncshow-backup-restore-sentinel.txt" status=none' \
  <"${expected_media}"

recording_relative_path="$(manifest_value '.recordingRelativePath')"
manifest_value '.recordingSourceB64' | base64 --decode >"${expected_recording}"
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
  relative="$1"
  base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
  target="${base}/${relative}"
  umask 077
  mkdir -p "$(dirname -- "${target}")" "${base}/staging"
  dd of="${target}" status=none
  chmod 0600 "${target}"
  [ "$(stat -c "%u:%g:%a" "${target}")" = "$(id -u):$(id -g):600" ]
' sh "${recording_relative_path}" <"${expected_recording}"

assert_database_invariants() {
  psql_cmd -At \
    -v current_revision="$(manifest_value '.currentSermonRevision')" \
    -v sermon_sync_id="$(manifest_value '.sermonSyncId')" \
    -v public_id="$(manifest_value '.publicId')" \
    -v detail_checksum="$(manifest_value '.detailChecksum')" \
    -v catalog_item_checksum="$(manifest_value '.catalogItemChecksum')" \
    -v catalog_checksum="$(manifest_value '.catalogChecksum')" \
    -v passage_checksum="$(manifest_value '.passageIndexChecksum')" \
    -v plan_revision="$(manifest_value '.planRevision')" \
    -v link_id="$(manifest_value '.linkId')" \
    -v snapshot_checksum="$(manifest_value '.songSnapshotChecksum')" \
    -v family_revision="$(manifest_value '.songFamilyRevision')" \
    -v review_revision="$(manifest_value '.reviewRevision')" \
    -v media_filename="${media_filename}" \
    -v media_bytes="$(manifest_value '.mediaBytes')" <<'SQL' >/dev/null
SELECT set_config(
  'heritage_fixture.current_revision',
  :'current_revision',
  false
);
SELECT set_config(
  'heritage_fixture.sermon_sync_id',
  :'sermon_sync_id',
  false
);
SELECT set_config('heritage_fixture.public_id', :'public_id', false);
SELECT set_config(
  'heritage_fixture.detail_checksum',
  :'detail_checksum',
  false
);
SELECT set_config(
  'heritage_fixture.catalog_item_checksum',
  :'catalog_item_checksum',
  false
);
SELECT set_config(
  'heritage_fixture.catalog_checksum',
  :'catalog_checksum',
  false
);
SELECT set_config(
  'heritage_fixture.passage_checksum',
  :'passage_checksum',
  false
);
SELECT set_config(
  'heritage_fixture.plan_revision',
  :'plan_revision',
  false
);
SELECT set_config('heritage_fixture.link_id', :'link_id', false);
SELECT set_config(
  'heritage_fixture.snapshot_checksum',
  :'snapshot_checksum',
  false
);
SELECT set_config(
  'heritage_fixture.family_revision',
  :'family_revision',
  false
);
SELECT set_config(
  'heritage_fixture.review_revision',
  :'review_revision',
  false
);
SELECT set_config(
  'heritage_fixture.media_filename',
  :'media_filename',
  false
);
SELECT set_config(
  'heritage_fixture.media_bytes',
  :'media_bytes',
  false
);
DO $assertions$
DECLARE
  community_id_value integer;
  sermon_id_value integer;
  song_id_value integer;
  plan_id_value integer;
BEGIN
  SELECT "id" INTO STRICT community_id_value
  FROM "communities" WHERE "slug" = 'ci-church';
  SELECT "id" INTO STRICT sermon_id_value
  FROM "sermons"
  WHERE "community_id" = community_id_value
    AND "sync_id" = current_setting('heritage_fixture.sermon_sync_id');
  SELECT "id" INTO STRICT song_id_value
  FROM "songs"
  WHERE "community_id" = community_id_value
    AND "sync_id" = 'backup-restore-song';
  SELECT "id" INTO STRICT plan_id_value
  FROM "service_plans"
  WHERE "community_id" = community_id_value
    AND "sync_id" = 'backup-restore-service-plan';

  IF (
    SELECT COUNT(*) FROM "syncshow_sermon_changes"
    WHERE "community_id" = community_id_value
      AND "sermon_id" = sermon_id_value
  ) <> 2 THEN
    RAISE EXCEPTION 'exact sermon history was not retained';
  END IF;
  IF (
    SELECT array_agg("sync_version"::integer ORDER BY "sync_version")
    FROM "syncshow_sermon_changes"
    WHERE "sermon_id" = sermon_id_value
  ) <> ARRAY[7, 8] THEN
    RAISE EXCEPTION 'sermon history versions are not exact';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "syncshow_sermon_changes"
    WHERE "sermon_id" = sermon_id_value
      AND encode(sha256(convert_to("document_source", 'UTF8')), 'hex')
        <> "revision"
  ) THEN
    RAISE EXCEPTION 'sermon history source/revision mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "sermons"
    WHERE "id" = sermon_id_value
      AND "sync_version" = 8
      AND "sync_current_revision" =
        current_setting('heritage_fixture.current_revision')
      AND encode(
        sha256(convert_to("sync_current_document_source", 'UTF8')),
        'hex'
      ) = "sync_current_revision"
  ) THEN
    RAISE EXCEPTION 'current canonical sermon authority is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "syncshow_sermon_publications"
    WHERE "community_id" = community_id_value
      AND "sermon_id" = sermon_id_value
      AND "active" = true
      AND "public_id" = current_setting('heritage_fixture.public_id')
      AND "public_revision" =
        current_setting('heritage_fixture.current_revision')
      AND encode(sha256(convert_to("detail_source", 'UTF8')), 'hex')
        = current_setting('heritage_fixture.detail_checksum')
      AND encode(sha256(convert_to("catalog_item_source", 'UTF8')), 'hex')
        = current_setting('heritage_fixture.catalog_item_checksum')
  ) THEN
    RAISE EXCEPTION 'sermon publication authority is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "syncshow_sermon_publication_catalogs"
    WHERE "community_id" = community_id_value
      AND encode(sha256(convert_to("source", 'UTF8')), 'hex')
        = current_setting('heritage_fixture.catalog_checksum')
      AND encode(sha256(convert_to("passage_index_source", 'UTF8')), 'hex')
        = current_setting('heritage_fixture.passage_checksum')
  ) THEN
    RAISE EXCEPTION 'sermon catalog authority is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "service_plans"
    WHERE "id" = plan_id_value
      AND "status" = 'ready'
      AND "revision" = current_setting('heritage_fixture.plan_revision')
      AND encode(sha256(convert_to("document_source", 'UTF8')), 'hex')
        = "revision"
  ) OR (
    SELECT COUNT(*) FROM "service_plans_entries"
    WHERE "_parent_id" = plan_id_value
  ) <> 4 OR NOT EXISTS (
    SELECT 1 FROM "service_plans_entries"
    WHERE "_parent_id" = plan_id_value
      AND "kind" = 'song'
      AND "song_id" = song_id_value
      AND "resolved_sync_version" = 3
      AND "resolved_revision" = 'song:backup-restore-song:3'
  ) OR NOT EXISTS (
    SELECT 1 FROM "service_plans_entries"
    WHERE "_parent_id" = plan_id_value
      AND "kind" = 'sermon'
      AND "sermon_id" = sermon_id_value
      AND "resolved_sync_version" = 8
      AND "resolved_revision" =
        current_setting('heritage_fixture.current_revision')
  ) THEN
    RAISE EXCEPTION 'service plan or exact resource pins are invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "syncshow_song_public_links"
    WHERE "community_id" = community_id_value
      AND "song_id" = song_id_value
      AND "link_id" = current_setting('heritage_fixture.link_id')
      AND "link_version" = 2
      AND "revoked_at" IS NOT NULL
      AND "family_revision" =
        current_setting('heritage_fixture.family_revision')
      AND "review_revision" =
        current_setting('heritage_fixture.review_revision')
      AND "revoke_idempotency_key_hash" IS NOT NULL
      AND "revoke_request_hash" IS NOT NULL
      AND encode(sha256(convert_to("snapshot_source", 'UTF8')), 'hex')
        = current_setting('heritage_fixture.snapshot_checksum')
      AND "snapshot_source"::jsonb ->> 'familyRevision'
        = "family_revision"
      AND "review_source"::jsonb ->> 'familyRevision'
        = "family_revision"
      AND jsonb_array_length("audit_source"::jsonb -> 'events') = 2
      AND "audit_source"::jsonb #>> '{events,0,type}' = 'created'
      AND "audit_source"::jsonb #>> '{events,1,type}' = 'revoked'
  ) THEN
    RAISE EXCEPTION 'revoked song public-link authority is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "media"
    WHERE "community_id" = community_id_value
      AND "filename" = current_setting('heritage_fixture.media_filename')
      AND "filesize" =
        current_setting('heritage_fixture.media_bytes')::numeric
  ) THEN
    RAISE EXCEPTION 'media sentinel database row is invalid';
  END IF;
  IF (SELECT COUNT(*) FROM "payload_migrations") <> 16 THEN
    RAISE EXCEPTION 'expected the complete 16-migration chain';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "payload_migrations"
    WHERE "name" = '20260730_230000_sermon_media_staging'
  ) THEN
    RAISE EXCEPTION 'managed sermon-media migration is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "pg_constraint"
    WHERE "conname" = 'syncshow_sermon_changes_document_revision_check'
      AND "convalidated" = true
  ) THEN
    RAISE EXCEPTION 'exact sermon history CHECK is missing or unvalidated';
  END IF;
END
$assertions$;
SQL
}

capture_database_evidence() {
  local destination="$1"
  psql_cmd -Atq \
    -v sermon_sync_id="$(manifest_value '.sermonSyncId')" \
    -v song_sync_id="$(manifest_value '.songSyncId')" \
    -v plan_sync_id="$(manifest_value '.planSyncId')" \
    -v link_id="$(manifest_value '.linkId')" \
    -v media_filename="$(manifest_value '.mediaFilename')" \
    -v recording_relative_path="$(manifest_value '.recordingRelativePath')" \
    <<'SQL' >"${destination}"
SET TIME ZONE 'UTC';
SELECT jsonb_build_object(
  'table', 'songs',
  'row', to_jsonb(song)
)::text
FROM "songs" AS song
WHERE "sync_id" = :'song_sync_id'
ORDER BY "id";

SELECT jsonb_build_object(
  'table', 'sermons',
  'row',
  to_jsonb(sermon)
    - 'sync_current_document_source'
    || jsonb_build_object(
      'sync_current_document_source_hex',
      encode(convert_to("sync_current_document_source", 'UTF8'), 'hex')
    )
)::text
FROM "sermons" AS sermon
WHERE "sync_id" = :'sermon_sync_id'
ORDER BY "id";

SELECT jsonb_build_object(
  'table', 'syncshow_sermon_changes',
  'row',
  to_jsonb(change)
    - 'document_source'
    || jsonb_build_object(
      'document_source_hex',
      encode(convert_to("document_source", 'UTF8'), 'hex')
    )
)::text
FROM "syncshow_sermon_changes" AS change
WHERE "sync_id" = :'sermon_sync_id'
ORDER BY "sync_version", "id";

SELECT jsonb_build_object(
  'table', 'syncshow_sermon_publications',
  'row',
  to_jsonb(publication)
    - ARRAY[
      'published_document_source',
      'detail_source',
      'catalog_item_source'
    ]
    || jsonb_build_object(
      'published_document_source_hex',
      encode(convert_to("published_document_source", 'UTF8'), 'hex'),
      'detail_source_hex',
      encode(convert_to("detail_source", 'UTF8'), 'hex'),
      'catalog_item_source_hex',
      encode(convert_to("catalog_item_source", 'UTF8'), 'hex')
    )
)::text
FROM "syncshow_sermon_publications" AS publication
WHERE "sync_id" = :'sermon_sync_id'
ORDER BY "id";

SELECT jsonb_build_object(
  'table', 'syncshow_sermon_publication_catalogs',
  'row',
  to_jsonb(catalog)
    - ARRAY['source', 'passage_index_source']
    || jsonb_build_object(
      'source_hex', encode(convert_to("source", 'UTF8'), 'hex'),
      'passage_index_source_hex',
      encode(convert_to("passage_index_source", 'UTF8'), 'hex')
    )
)::text
FROM "syncshow_sermon_publication_catalogs" AS catalog
JOIN "communities" AS community ON community."id" = catalog."community_id"
WHERE community."slug" = 'ci-church'
ORDER BY catalog."id";

SELECT jsonb_build_object(
  'table', 'service_plans',
  'row',
  to_jsonb(plan)
    - 'document_source'
    || jsonb_build_object(
      'document_source_hex',
      encode(convert_to("document_source", 'UTF8'), 'hex')
    )
)::text
FROM "service_plans" AS plan
WHERE "sync_id" = :'plan_sync_id'
ORDER BY "id";

SELECT jsonb_build_object(
  'table', 'service_plans_entries',
  'row', to_jsonb(entry)
)::text
FROM "service_plans_entries" AS entry
JOIN "service_plans" AS plan ON plan."id" = entry."_parent_id"
WHERE plan."sync_id" = :'plan_sync_id'
ORDER BY entry."_order", entry."id";

SELECT jsonb_build_object(
  'table', 'syncshow_song_public_links',
  'row',
  to_jsonb(link)
    - ARRAY['snapshot_source', 'review_source', 'audit_source']
    || jsonb_build_object(
      'snapshot_source_hex',
      encode(convert_to("snapshot_source", 'UTF8'), 'hex'),
      'review_source_hex',
      encode(convert_to("review_source", 'UTF8'), 'hex'),
      'audit_source_hex',
      encode(convert_to("audit_source", 'UTF8'), 'hex')
    )
)::text
FROM "syncshow_song_public_links" AS link
WHERE "link_id" = :'link_id'
ORDER BY "id";

SELECT jsonb_build_object(
  'table', 'media',
  'row', to_jsonb(media)
)::text
FROM "media" AS media
WHERE "filename" = :'media_filename'
ORDER BY "id";

SELECT jsonb_build_object(
  'table', 'syncshow_sermon_media_objects',
  'row', to_jsonb(object)
)::text
FROM "syncshow_sermon_media_objects" AS object
WHERE "storage_key" = :'recording_relative_path'
ORDER BY "id";

SELECT jsonb_build_object(
  'table', 'payload_migrations',
  'rows', jsonb_agg("name" ORDER BY "name")
)::text
FROM "payload_migrations";

SELECT jsonb_build_object(
  'table', 'pg_constraint',
  'name', "conname",
  'validated', "convalidated",
  'definition', pg_get_constraintdef("oid")
)::text
FROM "pg_constraint"
WHERE "conname" = 'syncshow_sermon_changes_document_revision_check';
SQL
}

assert_fixture_rows_absent() {
  local counts
  counts="$(psql_cmd -Atq \
    -v sermon_sync_id="$(manifest_value '.sermonSyncId')" \
    -v song_sync_id="$(manifest_value '.songSyncId')" \
    -v plan_sync_id="$(manifest_value '.planSyncId')" \
    -v plan_entry_ids_b64="$(manifest_value '.planEntryIdsB64')" \
    -v link_id="$(manifest_value '.linkId')" \
    -v media_filename="$(manifest_value '.mediaFilename')" \
    -v recording_relative_path="$(manifest_value '.recordingRelativePath')" \
    <<'SQL'
SELECT jsonb_build_object(
  'songs', (
    SELECT COUNT(*) FROM "songs" WHERE "sync_id" = :'song_sync_id'
  ),
  'sermons', (
    SELECT COUNT(*) FROM "sermons" WHERE "sync_id" = :'sermon_sync_id'
  ),
  'sermonHistory', (
    SELECT COUNT(*) FROM "syncshow_sermon_changes"
    WHERE "sync_id" = :'sermon_sync_id'
  ),
  'sermonPublications', (
    SELECT COUNT(*) FROM "syncshow_sermon_publications"
    WHERE "sync_id" = :'sermon_sync_id'
  ),
  'sermonCatalogs', (
    SELECT COUNT(*)
    FROM "syncshow_sermon_publication_catalogs" AS catalog
    JOIN "communities" AS community
      ON community."id" = catalog."community_id"
    WHERE community."slug" = 'ci-church'
  ),
  'servicePlans', (
    SELECT COUNT(*) FROM "service_plans" WHERE "sync_id" = :'plan_sync_id'
  ),
  'servicePlanEntries', (
    SELECT COUNT(*)
    FROM "service_plans_entries"
    WHERE "id" IN (
      SELECT jsonb_array_elements_text(
        convert_from(decode(:'plan_entry_ids_b64', 'base64'), 'UTF8')::jsonb
      )
    )
  ),
  'songPublicLinks', (
    SELECT COUNT(*) FROM "syncshow_song_public_links"
    WHERE "link_id" = :'link_id'
  ),
  'mediaRows', (
    SELECT COUNT(*) FROM "media" WHERE "filename" = :'media_filename'
  ),
  'sermonMediaObjects', (
    SELECT COUNT(*) FROM "syncshow_sermon_media_objects"
    WHERE "storage_key" = :'recording_relative_path'
  )
)::text;
SQL
)"
  jq -e '
    length == 10
    and all(.[]; . == 0)
  ' <<<"${counts}" >/dev/null \
    || heritage_die "Destructive mutation left one or more exact fixture rows."
}

assert_database_invariants
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'exec cat "/app/media/syncshow-backup-restore-sentinel.txt"' \
  >"${after_media}"
cmp -- "${expected_media}" "${after_media}" \
  || heritage_die "Seeded media sentinel bytes are not exact."
[[ "$(sha256sum "${after_media}" | cut -d' ' -f1)" \
  == "$(manifest_value '.mediaChecksum')" ]] || \
  heritage_die "Seeded media sentinel checksum is not exact."
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'exec cat "${HERITAGE_SERMON_MEDIA_PATH}/$1"' \
  sh "${recording_relative_path}" >"${after_recording}"
cmp -- "${expected_recording}" "${after_recording}" \
  || heritage_die "Seeded private recording object bytes are not exact."
[[ "$(sha256sum "${after_recording}" | cut -d' ' -f1)" \
  == "$(manifest_value '.recordingChecksum')" ]] || \
  heritage_die "Seeded private recording checksum is not exact."
recording_identity_and_mode="$(heritage_compose run --rm --no-deps -T \
  --entrypoint sh community -ec \
  'stat -c "%u:%g:%a" "${HERITAGE_SERMON_MEDIA_PATH}/$1"; printf "%s:%s\n" "$(id -u)" "$(id -g)"' \
  sh "${recording_relative_path}")"
[[ "${recording_identity_and_mode}" == $'1001:1001:600\n1001:1001' ]] \
  || heritage_die "Private recording object is not owned by the locked 1001:1001 service identity with mode 0600."

for isolated_volume in \
  "${postgres_volume}" \
  "${media_volume}" \
  "${sermon_media_volume}"; do
  heritage_docker volume inspect "${isolated_volume}" >/dev/null \
    || heritage_die "Expected disposable volume was not created: ${isolated_volume}"
done
postgres_mountpoint="$(heritage_docker volume inspect \
  --format '{{.Mountpoint}}' "${postgres_volume}")"
media_mountpoint="$(heritage_docker volume inspect \
  --format '{{.Mountpoint}}' "${media_volume}")"
sermon_mountpoint="$(heritage_docker volume inspect \
  --format '{{.Mountpoint}}' "${sermon_media_volume}")"
[[ -n "${postgres_mountpoint}" \
  && -n "${media_mountpoint}" \
  && -n "${sermon_mountpoint}" \
  && "${postgres_mountpoint}" != "${media_mountpoint}" \
  && "${postgres_mountpoint}" != "${sermon_mountpoint}" \
  && "${media_mountpoint}" != "${sermon_mountpoint}" ]] \
  || heritage_die "Disposable database, uploaded-media, and private-sermon mountpoints are not isolated."

capture_database_evidence "${expected_db}"
jq -s -e '
  reduce .[] as $row (
    {};
    .[$row.table] = ((.[$row.table] // 0) + 1)
  ) == {
    "songs": 1,
    "sermons": 1,
    "syncshow_sermon_changes": 2,
    "syncshow_sermon_publications": 1,
    "syncshow_sermon_publication_catalogs": 1,
    "service_plans": 1,
    "service_plans_entries": 4,
    "syncshow_song_public_links": 1,
    "media": 1,
    "syncshow_sermon_media_objects": 1,
    "payload_migrations": 1,
    "pg_constraint": 1
  }
' "${expected_db}" >/dev/null || \
  heritage_die "Database evidence did not cover every expected fixture row."

heritage_info "Proving supported maintenance cleans only old orphan staging and verified orphan objects."
orphan_upload_id='orphanedRecordingMaintenance000001'
orphan_payload='verified-old-orphan-object'
orphan_digest="$(printf '%s' "${orphan_payload}" | sha256sum | cut -d' ' -f1)"
orphan_relative_path="objects/$(manifest_value '.recordingCommunityNamespace')/sha256/${orphan_digest:0:2}/${orphan_digest}"
printf '%s' "${orphan_payload}" \
  | heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
      base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
      upload_id="$1"
      object_key="$2"
      umask 077
      mkdir -p "${base}/staging/${upload_id}/chunks" \
        "$(dirname -- "${base}/${object_key}")"
      printf "old orphan staging\n" \
        >"${base}/staging/${upload_id}/chunks/00000000.chunk"
      dd of="${base}/${object_key}" status=none
      chmod 0600 "${base}/${object_key}"
      touch -t 202001010000 "${base}/${object_key}" \
        "${base}/staging/${upload_id}" \
        "${base}/staging/${upload_id}/chunks" \
        "${base}/staging/${upload_id}/chunks/00000000.chunk"
    ' sh "${orphan_upload_id}" "${orphan_relative_path}"
maintenance_report="$("${DEPLOY_DIR}/heritage-community" \
  sermon-media-maintenance --grace-seconds 3600)"
jq -e '
  .schemaVersion == 1
  and .mode == "quiesced"
  and .cleanedOrphanStaging == 1
  and .removedOrphanObjects == 1
  and .retained.objects == 1
  and .stagingDirectories == 0
' <<<"${maintenance_report}" >/dev/null \
  || heritage_die "Supported maintenance did not report exact orphan cleanup."
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
  base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
  test ! -e "${base}/staging/$1"
  test ! -e "${base}/$2"
  test -f "${base}/$3"
' sh "${orphan_upload_id}" "${orphan_relative_path}" "${recording_relative_path}"

heritage_info "Proving prebackup content hashing rejects a corrupt retained object."
printf 'corrupt-object-bytes\n' \
  | heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
    'exec dd of="${HERITAGE_SERMON_MEDIA_PATH}/$1" status=none' \
    sh "${recording_relative_path}"
if "${DEPLOY_DIR}/backup.sh" \
  --install-dir "${SERVER_DIR}" \
  --output-dir "${backup_root}" \
  --retention-days 0 \
  --label corrupt-object-must-refuse \
  --quiesce >/dev/null 2>&1; then
  heritage_die "Quiesced backup accepted a corrupt retained recording object."
fi
manifest_value '.recordingSourceB64' | base64 --decode \
  | heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
    'exec dd of="${HERITAGE_SERMON_MEDIA_PATH}/$1" status=none' \
    sh "${recording_relative_path}"
heritage_compose start community >/dev/null
if find "${backup_root}" -mindepth 1 -maxdepth 1 \
  \( -type d -name 'backup-20*' -o -type d -name '.partial-*' \) \
  -print -quit | grep -q .; then
  heritage_die "Failed corrupt-object backup published or leaked a partial backup."
fi

heritage_info "Proving backup fails closed while private recording staging is nonempty."
active_staging_id='recentOrphanUploadForBackupTest01'
printf 'orphaned-upload-staging-bytes\n' \
  | heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
      base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
      upload_id="$1"
      umask 077
      mkdir -p "${base}/staging/${upload_id}/chunks"
      dd of="${base}/staging/${upload_id}/chunks/00000000.chunk" status=none
    ' sh "${active_staging_id}"
if "${DEPLOY_DIR}/backup.sh" \
  --install-dir "${SERVER_DIR}" \
  --output-dir "${backup_root}" \
  --retention-days 0 \
  --label staging-must-refuse \
  --quiesce >/dev/null 2>&1; then
  heritage_die "Quiesced backup accepted nonempty private recording staging."
fi
if find "${backup_root}" -mindepth 1 -maxdepth 1 \
  \( -type d -name 'backup-20*' -o -type d -name '.partial-*' \) \
  -print -quit | grep -q .; then
  heritage_die "Failed staging backup published or leaked a partial backup."
fi
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
  base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
  upload_id="$1"
  test -s "${base}/staging/${upload_id}/chunks/00000000.chunk"
  rm -rf -- "${base}/staging/${upload_id}"
  ! find "${base}/staging" -mindepth 1 -print -quit | grep -q .
' sh "${active_staging_id}"
heritage_compose start community >/dev/null

heritage_info "Proving online backup refuses finalized managed recording objects."
if "${DEPLOY_DIR}/backup.sh" \
  --install-dir "${SERVER_DIR}" \
  --output-dir "${backup_root}" \
  --retention-days 0 \
  --label online-must-refuse \
  --online >/dev/null 2>&1; then
  heritage_die "Online backup accepted finalized private recording objects."
fi
if find "${backup_root}" -mindepth 1 -maxdepth 1 \
  \( -type d -name 'backup-20*' -o -type d -name '.partial-*' \) \
  -print -quit | grep -q .; then
  heritage_die "Failed online backup published or leaked a partial backup."
fi

heritage_info "Proving backup rejects an unsafe uploaded-media archive before publication."
unsafe_public_link="/app/media/unsafe-backup-link"
public_referent_before="$(
  heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
    target="/app/media/syncshow-backup-restore-sentinel.txt"
    test -f "${target}" && test ! -L "${target}"
    stat -c "%u:%g:%a:%s" /app/media "${target}"
    sha256sum "${target}"
  '
)"
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
  link="$1"
  target="/app/media/syncshow-backup-restore-sentinel.txt"
  test ! -e "${link}" && test ! -L "${link}"
  ln -s "${target}" "${link}"
' sh "${unsafe_public_link}"
if "${DEPLOY_DIR}/backup.sh" \
  --install-dir "${SERVER_DIR}" \
  --output-dir "${backup_root}" \
  --retention-days 0 \
  --label unsafe-public-media-must-refuse \
  --quiesce >/dev/null 2>&1; then
  heritage_die "Quiesced backup published an uploaded-media archive containing a symlink."
fi
public_referent_after="$(
  heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
    link="$1"
    target="/app/media/syncshow-backup-restore-sentinel.txt"
    test -L "${link}"
    stat -c "%u:%g:%a:%s" /app/media "${target}"
    sha256sum "${target}"
    rm -- "${link}"
  ' sh "${unsafe_public_link}"
)"
[[ "${public_referent_after}" == "${public_referent_before}" ]] \
  || heritage_die "Rejected uploaded-media backup changed its symlink referent."
if find "${backup_root}" -mindepth 1 -maxdepth 1 \
  \( -type d -name 'backup-20*' -o -type d -name '.partial-*' \) \
  -print -quit | grep -q .; then
  heritage_die "Failed uploaded-media archive validation published or leaked a partial backup."
fi
heritage_compose start community >/dev/null

heritage_info "Creating an actual quiesced database and media backup."
fresh_orphan_payload='fresh-revoked-finalizer-orphan'
fresh_orphan_digest="$(
  printf '%s' "${fresh_orphan_payload}" | sha256sum | cut -d' ' -f1
)"
fresh_orphan_relative_path="objects/$(manifest_value '.recordingCommunityNamespace')/sha256/${fresh_orphan_digest:0:2}/${fresh_orphan_digest}"
printf '%s' "${fresh_orphan_payload}" \
  | heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
      base="${HERITAGE_SERMON_MEDIA_PATH:?HERITAGE_SERMON_MEDIA_PATH is required}"
      target="${base}/$1"
      umask 077
      mkdir -p "$(dirname -- "${target}")"
      dd of="${target}" status=none
      chmod 0600 "${target}"
    ' sh "${fresh_orphan_relative_path}"
"${DEPLOY_DIR}/backup.sh" \
  --install-dir "${SERVER_DIR}" \
  --output-dir "${backup_root}" \
  --retention-days 0 \
  --label syncshow-restore \
  --quiesce
backup_path="$(heritage_latest_backup)"
[[ -n "${backup_path}" && -d "${backup_path}" ]] || \
  heritage_die "Quiesced backup was not published."
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
  test ! -e "${HERITAGE_SERMON_MEDIA_PATH:?}/$1"
' sh "${fresh_orphan_relative_path}" \
  || heritage_die "Backup-ready maintenance retained a fresh unreferenced recording object."
grep -qx 'QUIESCED=1' "${backup_path}/manifest.env" || \
  heritage_die "Recovery regression did not create a quiesced backup."
grep -qx 'HERITAGE_BACKUP_FORMAT=2' "${backup_path}/manifest.env" || \
  heritage_die "Private recording volume did not produce backup format 2."
grep -qx 'SERMON_MEDIA_FILE=sermon-media.tar.gz' "${backup_path}/manifest.env" || \
  heritage_die "Format 2 manifest omitted the private recording archive."
grep -qx 'SERMON_MEDIA_LAYOUT=tenant-objects-sha256-v1' "${backup_path}/manifest.env" || \
  heritage_die "Format 2 manifest omitted the locked private recording layout."
grep -qx 'SERMON_MEDIA_INVENTORY_FILE=sermon-media.inventory' \
  "${backup_path}/manifest.env" \
  || heritage_die "Format 2 manifest omitted the canonical object inventory."
grep -Fqx \
  "${recording_relative_path}"$'\t'"$(manifest_value '.recordingBytes')"$'\t'"$(manifest_value '.recordingChecksum')" \
  "${backup_path}/sermon-media.inventory" \
  || heritage_die "Format 2 canonical inventory omitted the exact managed object."
if grep -Fq "${fresh_orphan_relative_path}" \
  "${backup_path}/sermon-media.inventory"; then
  heritage_die "Format 2 inventory retained a fresh unreferenced recording object."
fi
heritage_verify_backup "${backup_path}"
heritage_validate_tar_archive "${backup_path}/sermon-media.tar.gz" sermon-media \
  || heritage_die "Published private recording archive failed structural validation."
if tar -tzf "${backup_path}/sermon-media.tar.gz" | grep -Fq 'staging'; then
  heritage_die "Published private recording archive included staging data."
fi
tar -xOzf "${backup_path}/sermon-media.tar.gz" \
  "${recording_relative_path}" >"${after_recording}"
cmp -- "${expected_recording}" "${after_recording}" \
  || heritage_die "Format 2 archive did not preserve exact private recording bytes."
[[ "$(sha256sum "${after_recording}" | cut -d' ' -f1)" \
  == "$(manifest_value '.recordingChecksum')" ]] || \
  heritage_die "Format 2 archive private recording checksum is not exact."

status_output="${WORK_ROOT}/status-format2.out"
"${DEPLOY_DIR}/status.sh" \
  --install-dir "${SERVER_DIR}" \
  --backup-dir "${backup_root}" \
  --verify-backup \
  --quiet >"${status_output}"
grep -Fq "Finalized private recording bytes: $(manifest_value '.recordingBytes')" \
  "${status_output}" \
  || heritage_die "Status did not report exact finalized private recording bytes."
grep -Fq 'Private recording staging bytes: 0' "${status_output}" \
  || heritage_die "Status did not report empty private recording staging."
grep -Fq 'Private recording filesystem headroom:' "${status_output}" \
  || heritage_die "Status did not report private recording filesystem headroom."
grep -Fq 'Latest format 2 backup inventory exactly covers 1 finalized private recording object(s)' \
  "${status_output}" \
  || heritage_die "Status did not report format 2 private recording coverage."

for partial_mode in --database-only --media-only; do
  if "${DEPLOY_DIR}/restore.sh" \
    --install-dir "${SERVER_DIR}" \
    --backup-dir "${backup_root}" \
    "${partial_mode}" \
    --skip-safety-backup \
    --yes \
    "${backup_path}" >/dev/null 2>&1; then
    heritage_die "Format 2 restore accepted forbidden partial mode ${partial_mode}."
  fi
done

legacy_backup="${WORK_ROOT}/legacy-format1"
cp -R -- "${backup_path}" "${legacy_backup}"
rm -f -- "${legacy_backup}/sermon-media.tar.gz" \
  "${legacy_backup}/sermon-media.inventory"
awk '
  /^HERITAGE_BACKUP_FORMAT=/ { print "HERITAGE_BACKUP_FORMAT=1"; next }
  /^SERMON_MEDIA_FILE=/ { next }
  /^SERMON_MEDIA_LAYOUT=/ { next }
  /^SERMON_MEDIA_INVENTORY_FILE=/ { next }
  /^SERMON_MEDIA_INVENTORY_SHA256=/ { next }
  /^SERMON_MEDIA_OBJECT_COUNT=/ { next }
  /^SERMON_MEDIA_OBJECT_BYTES=/ { next }
  { print }
' "${legacy_backup}/manifest.env" >"${legacy_backup}/manifest.env.next"
mv -- "${legacy_backup}/manifest.env.next" "${legacy_backup}/manifest.env"
(
  cd -- "${legacy_backup}"
  sha256sum database.dump media.tar.gz recovery.tar.gz manifest.env >SHA256SUMS
)
heritage_verify_backup "${legacy_backup}"

traversal_backup="${WORK_ROOT}/traversal-format2"
cp -R -- "${backup_path}" "${traversal_backup}"
MALICIOUS_ARCHIVE_PATH="${traversal_backup}/sermon-media.tar.gz" \
  node --input-type=module <<'NODE'
import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const payload = Buffer.from('must-never-extract\n', 'utf8')
const header = Buffer.alloc(512)
const writeString = (value, offset, length) => {
  Buffer.from(value, 'ascii').copy(header, offset, 0, length)
}
const writeOctal = (value, offset, length) => {
  const encoded = value.toString(8).padStart(length - 1, '0') + '\0'
  writeString(encoded, offset, length)
}
writeString('../traversal-object', 0, 100)
writeOctal(0o600, 100, 8)
writeOctal(1001, 108, 8)
writeOctal(1001, 116, 8)
writeOctal(payload.length, 124, 12)
writeOctal(0, 136, 12)
header.fill(0x20, 148, 156)
header[156] = '0'.charCodeAt(0)
writeString('ustar\0', 257, 6)
writeString('00', 263, 2)
const checksum = header.reduce((total, byte) => total + byte, 0)
writeString(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8)
const padding = Buffer.alloc((512 - (payload.length % 512)) % 512)
const archive = Buffer.concat([
  header,
  payload,
  padding,
  Buffer.alloc(1024),
])
writeFileSync(process.env.MALICIOUS_ARCHIVE_PATH, gzipSync(archive))
NODE
(
  cd -- "${traversal_backup}"
  sha256sum database.dump media.tar.gz recovery.tar.gz sermon-media.tar.gz \
    sermon-media.inventory manifest.env >SHA256SUMS
)
heritage_verify_backup "${traversal_backup}"
if "${DEPLOY_DIR}/restore.sh" \
  --install-dir "${SERVER_DIR}" \
  --backup-dir "${backup_root}" \
  --media-only \
  --skip-safety-backup \
  --yes \
  "${traversal_backup}" >/dev/null 2>&1; then
  heritage_die "Restore accepted a checksummed traversal member in private sermon media."
fi
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
  test ! -e /app/private/traversal-object
  test ! -e /app/private/sermon-media/traversal-object
  test -f "${HERITAGE_SERMON_MEDIA_PATH}/$1"
' sh "${recording_relative_path}" \
  || heritage_die "Traversal rejection changed live private recording data."

# Stop the app before the deliberate database/media damage so no bootstrap or
# request can race the exact expected snapshot.
heritage_compose stop --timeout 60 community >/dev/null
capture_database_evidence "${after_db}"
cmp -- "${expected_db}" "${after_db}" \
  || heritage_die "Fixture rows changed while the quiesced backup completed."

heritage_info "Removing only exact fixture rows and the exact sentinel file."
psql_cmd \
  -v sermon_sync_id="$(manifest_value '.sermonSyncId')" \
  -v song_sync_id="$(manifest_value '.songSyncId')" \
  -v plan_sync_id="$(manifest_value '.planSyncId')" \
  -v link_id="$(manifest_value '.linkId')" \
  -v media_filename="$(manifest_value '.mediaFilename')" \
  -v recording_relative_path="${recording_relative_path}" \
  <<'SQL'
BEGIN;
DELETE FROM "syncshow_song_public_links"
WHERE "link_id" = :'link_id';
DELETE FROM "service_plans_entries"
WHERE "_parent_id" IN (
  SELECT "id" FROM "service_plans"
  WHERE "sync_id" = :'plan_sync_id'
);
DELETE FROM "service_plans"
WHERE "sync_id" = :'plan_sync_id';
DELETE FROM "syncshow_sermon_publications"
WHERE "sync_id" = :'sermon_sync_id';
DELETE FROM "syncshow_sermon_changes"
WHERE "sync_id" = :'sermon_sync_id';
DELETE FROM "sermons"
WHERE "sync_id" = :'sermon_sync_id';
DELETE FROM "songs"
WHERE "sync_id" = :'song_sync_id';
DELETE FROM "media"
WHERE "filename" = :'media_filename';
DELETE FROM "syncshow_sermon_media_objects"
WHERE "storage_key" = :'recording_relative_path';
DELETE FROM "syncshow_sermon_publication_catalogs"
WHERE "community_id" IN (
  SELECT "id" FROM "communities" WHERE "slug" = 'ci-church'
);
COMMIT;
SQL
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'rm -f -- "/app/media/syncshow-backup-restore-sentinel.txt" \
    "${HERITAGE_SERMON_MEDIA_PATH}/$1"' \
  sh "${recording_relative_path}"

assert_fixture_rows_absent
capture_database_evidence "${after_db}"
if cmp -- "${expected_db}" "${after_db}" >/dev/null; then
  heritage_die "Destructive mutation did not change captured database evidence."
fi
jq -s -e '
  length == 2
  and (map(.table) | sort) == ["payload_migrations", "pg_constraint"]
' "${after_db}" >/dev/null || \
  heritage_die "Destructive mutation did not remove every exact fixture row."
if heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'test -e "/app/media/syncshow-backup-restore-sentinel.txt"'; then
  heritage_die "Destructive mutation did not remove the media sentinel."
fi
if heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'test -e "${HERITAGE_SERMON_MEDIA_PATH}/$1"' \
  sh "${recording_relative_path}"; then
  heritage_die "Destructive mutation did not remove the private recording object."
fi

touch -t 202001010000 "${backup_path}"
find "${backup_path}" -maxdepth 0 -mtime +30 -print -quit | grep -q . \
  || heritage_die "Retention regression could not age the selected restore source."
heritage_info "Restoring the actual backup with the default safety snapshot."
"${DEPLOY_DIR}/restore.sh" \
  --install-dir "${SERVER_DIR}" \
  --backup-dir "${backup_root}" \
  --yes \
  "${backup_path}"

[[ "$(find "${backup_root}" -mindepth 1 -maxdepth 1 \
  -type d -name 'backup-20*' | wc -l | tr -d ' ')" == "2" ]] || \
  heritage_die "Restore did not create exactly one default safety backup."
[[ -d "${backup_path}" ]] \
  || heritage_die "Pre-restore safety backup pruned the selected aged restore source."
latest_after_restore="$(heritage_latest_backup)"
[[ "${latest_after_restore}" != "${backup_path}" ]] \
  || heritage_die "Default safety backup did not become latest."
grep -qx 'SERMON_MEDIA_OBJECT_COUNT=0' \
  "${latest_after_restore}/manifest.env" \
  || heritage_die "Default safety backup did not capture the deliberately empty current store."
assert_database_invariants
capture_database_evidence "${after_db}"
cmp -- "${expected_db}" "${after_db}" \
  || heritage_die "Restored database rows differ from the exact backup evidence."
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'exec cat "/app/media/syncshow-backup-restore-sentinel.txt"' \
  >"${after_media}"
cmp -- "${expected_media}" "${after_media}" \
  || heritage_die "Restored media bytes differ from the exact sentinel."
[[ "$(sha256sum "${after_media}" | cut -d' ' -f1)" \
  == "$(manifest_value '.mediaChecksum')" ]] || \
  heritage_die "Restored media checksum differs from the exact sentinel."
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'exec cat "${HERITAGE_SERMON_MEDIA_PATH}/$1"' \
  sh "${recording_relative_path}" >"${after_recording}"
cmp -- "${expected_recording}" "${after_recording}" \
  || heritage_die "Restored private recording bytes differ from the exact object."
[[ "$(sha256sum "${after_recording}" | cut -d' ' -f1)" \
  == "$(manifest_value '.recordingChecksum')" ]] || \
  heritage_die "Restored private recording checksum differs from the exact object."
restored_recording_mode="$(heritage_compose run --rm --no-deps -T \
  --entrypoint sh community -ec \
  'stat -c "%u:%g:%a" "${HERITAGE_SERMON_MEDIA_PATH}/$1"' \
  sh "${recording_relative_path}")"
[[ "${restored_recording_mode}" == "1001:1001:600" ]] \
  || heritage_die "Restored private recording ownership or mode is unsafe."

heritage_info "Proving a legacy format 1 media restore represents no private recordings."
if "${DEPLOY_DIR}/restore.sh" \
  --install-dir "${SERVER_DIR}" \
  --backup-dir "${backup_root}" \
  --media-only \
  --skip-safety-backup \
  --yes \
  "${legacy_backup}" >/dev/null 2>&1; then
  heritage_die "Legacy format 1 partial restore accepted nonempty current managed recordings."
fi
heritage_compose stop --timeout 60 community >/dev/null
psql_cmd -v recording_relative_path="${recording_relative_path}" <<'SQL'
DELETE FROM "syncshow_sermon_media_objects"
WHERE "storage_key" = :'recording_relative_path';
SQL
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'rm -f -- "${HERITAGE_SERMON_MEDIA_PATH}/$1"' \
  sh "${recording_relative_path}"
"${DEPLOY_DIR}/restore.sh" \
  --install-dir "${SERVER_DIR}" \
  --backup-dir "${backup_root}" \
  --media-only \
  --skip-safety-backup \
  --yes \
  "${legacy_backup}"
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec '
  test -d "${HERITAGE_SERMON_MEDIA_PATH}/objects"
  ! find "${HERITAGE_SERMON_MEDIA_PATH}/objects" -type f -print -quit \
    | grep -q .
' || heritage_die "Legacy format 1 restore retained private recording objects."

heritage_info "Restoring the atomic format 2 set again after the legacy compatibility proof."
"${DEPLOY_DIR}/restore.sh" \
  --install-dir "${SERVER_DIR}" \
  --backup-dir "${backup_root}" \
  --skip-safety-backup \
  --yes \
  "${backup_path}"
heritage_compose run --rm --no-deps -T --entrypoint sh community -ec \
  'exec cat "${HERITAGE_SERMON_MEDIA_PATH}/$1"' \
  sh "${recording_relative_path}" >"${after_recording}"
cmp -- "${expected_recording}" "${after_recording}" \
  || heritage_die "Full format 2 restore did not recover exact private recording bytes."

detail_response="${WORK_ROOT}/detail.response"
catalog_response="${WORK_ROOT}/catalog.response"
passage_response="${WORK_ROOT}/passage.response"
manifest_value '.detailSourceB64' | base64 --decode >"${expected_detail}"
manifest_value '.catalogSourceB64' | base64 --decode >"${expected_catalog}"
manifest_value '.passageIndexSourceB64' | base64 --decode >"${expected_passage}"
curl -fsS --max-time 10 \
  "${test_public_url}/content/sermons/$(manifest_value '.publicId')" \
  >"${detail_response}"
curl -fsS --max-time 10 \
  "${test_public_url}/publications/sermons/catalog.json" \
  >"${catalog_response}"
curl -fsS --max-time 10 \
  "${test_public_url}/indexes/sermon-passages" \
  >"${passage_response}"
cmp -- "${expected_detail}" "${detail_response}" \
  || heritage_die "Restored public sermon detail bytes are not exact."
cmp -- "${expected_catalog}" "${catalog_response}" \
  || heritage_die "Restored public sermon catalog bytes are not exact."
cmp -- "${expected_passage}" "${passage_response}" \
  || heritage_die "Restored public sermon passage-index bytes are not exact."
[[ "$(sha256sum "${detail_response}" | cut -d' ' -f1)" \
  == "$(manifest_value '.detailChecksum')" ]] || \
  heritage_die "Restored public sermon detail bytes are not exact."
[[ "$(sha256sum "${catalog_response}" | cut -d' ' -f1)" \
  == "$(manifest_value '.catalogChecksum')" ]] || \
  heritage_die "Restored public sermon catalog bytes are not exact."
[[ "$(sha256sum "${passage_response}" | cut -d' ' -f1)" \
  == "$(manifest_value '.passageIndexChecksum')" ]] || \
  heritage_die "Restored public sermon passage-index bytes are not exact."

revoked_status="$(curl -sS --max-time 10 -o "${WORK_ROOT}/revoked.response" \
  -w '%{http_code}' \
  "${test_public_url}/community/songs/shared/$(manifest_value '.linkId')")"
[[ "${revoked_status}" == "404" ]] || \
  heritage_die "Restored revoked song public link became available."
grep -Fq 'This link is unavailable.' "${WORK_ROOT}/revoked.response" || \
  heritage_die "Restored revoked link did not use the generic unavailable response."
curl -fsS --max-time 10 \
  "${test_public_url}/.well-known/heritage-community.json" >/dev/null

heritage_info "Disposable SyncShow database, uploaded-media, and private-recording backup and restore regression passed."
