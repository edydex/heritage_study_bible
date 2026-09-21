-- Keep media referenced by saved services AND their immutable revisions.
-- These files share the private object store with sermon recordings.
WITH documents AS (
  SELECT community_id, document_source FROM public.service_documents
  UNION
  SELECT community_id, document_source FROM public.syncshow_service_document_changes
), assets AS (
  SELECT community_id, asset.value AS asset
  FROM documents
  CROSS JOIN LATERAL jsonb_each(document_source::jsonb -> 'project' -> 'assets') AS asset
)
SELECT DISTINCT
  'objects/' || encode(sha256(
    convert_to('heritage-sermon-media-community-v1', 'UTF8') || decode('00', 'hex') || convert_to(community_id::text, 'UTF8')
  ), 'hex') || '/sha256/' || substr(asset ->> 'sha256', 1, 2) || '/' || (asset ->> 'sha256') AS storage_key,
  (asset ->> 'size')::bigint AS size_bytes,
  asset ->> 'sha256' AS sha256
FROM assets
ORDER BY storage_key;
