-- Protect every saved revision, reusable slide, and attached read-along chapter.
-- to_jsonb keeps pre-migration backups compatible with older church/book rows.
WITH documents AS (
  SELECT community_id, document_source FROM public.service_documents
  UNION
  SELECT community_id, document_source FROM public.syncshow_service_document_changes
  UNION
  SELECT church.id, template ->> 'documentSource' FROM public.communities church
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(NULLIF(to_jsonb(church)->'presentation_slides','null'::jsonb),'[]'::jsonb)) template
), assets AS (
  SELECT community_id, asset.value AS asset FROM documents
  CROSS JOIN LATERAL jsonb_each(document_source::jsonb -> 'project' -> 'assets') AS asset
), media AS (
 SELECT encode(sha256(convert_to('heritage-sermon-media-community-v1', 'UTF8') || decode('00', 'hex') || convert_to(community_id::text, 'UTF8')), 'hex') AS namespace,
 (asset ->> 'size')::bigint AS size_bytes, asset ->> 'sha256' AS sha256 FROM assets
 UNION
 SELECT encode(sha256(convert_to('heritage-book-audio/v1:' || book.community_id::text || ':' || book.id::text,'UTF8')),'hex'),
 (chapter ->> 'audioSize')::bigint, chapter ->> 'audioSha256'
 FROM public.books book CROSS JOIN LATERAL jsonb_array_elements(COALESCE(to_jsonb(book)->'read_along'->'chapters','[]'::jsonb)) chapter
)
SELECT DISTINCT 'objects/' || namespace || '/sha256/' || substr(sha256,1,2) || '/' || sha256 AS storage_key,size_bytes,sha256
FROM media ORDER BY storage_key;
