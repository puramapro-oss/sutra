-- Run only after backup/restore verification and the compatible SUTRA release.
-- Deliberately separate from schema preparation: older SUTRA uses public URLs.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'sutra-assets') THEN
    RAISE EXCEPTION 'SUTRA_MEDIA_BUCKET_MISSING';
  END IF;
END $$;
UPDATE storage.buckets SET public = false WHERE id = 'sutra-assets';
-- Intersects even accidentally broad existing permissive policies. It has no
-- effect on other buckets or the BYPASSRLS service role. No objects are deleted.
DROP POLICY IF EXISTS sutra_private_media_server_only ON storage.objects;
CREATE POLICY sutra_private_media_server_only ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id <> 'sutra-assets') WITH CHECK (bucket_id <> 'sutra-assets');
COMMIT;
