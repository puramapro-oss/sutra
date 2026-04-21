-- V7.1 — Bucket Supabase Storage "video-proofs" pour les .ots OpenTimestamps.
-- Chaque vidéo générée → .ots bytes uploadé ici → path public lisible par /api/verify/[videoId].
-- Source of truth : STRIPE_CONNECT_KARMA_V4.md §36.2 + plan Bloc A.
-- Idempotent : safe à ré-exécuter.

-- ═══════════════════════════════════════════════════════════════
-- 1. Bucket : public read, 5 MB max/fichier, mime octet-stream
-- ═══════════════════════════════════════════════════════════════
-- Les .ots typiques font 300 bytes (pending) à ~2 KB (upgraded Bitcoin).
-- Cap à 5 MB = confortable pour futures évolutions (proofs batchés, multi-ancres).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-proofs',
  'video-proofs',
  TRUE,
  5242880,
  ARRAY['application/octet-stream', 'application/x-opentimestamps']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ═══════════════════════════════════════════════════════════════
-- 2. Policies storage.objects pour le bucket video-proofs
-- ═══════════════════════════════════════════════════════════════

-- SELECT public (anon + authenticated + service_role)
-- → /api/verify/[videoId] peut télécharger la preuve sans auth.
DROP POLICY IF EXISTS "video_proofs_public_read" ON storage.objects;
CREATE POLICY "video_proofs_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'video-proofs');

-- INSERT : service_role uniquement
-- → seul le backend SUTRA (pipeline /api/create, CRON upgrade) peut uploader.
DROP POLICY IF EXISTS "video_proofs_service_insert" ON storage.objects;
CREATE POLICY "video_proofs_service_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'video-proofs'
    AND auth.jwt()->>'role' = 'service_role'
  );

-- UPDATE : service_role uniquement (pour upgrade CRON qui remplace le .ots)
DROP POLICY IF EXISTS "video_proofs_service_update" ON storage.objects;
CREATE POLICY "video_proofs_service_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'video-proofs'
    AND auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    bucket_id = 'video-proofs'
    AND auth.jwt()->>'role' = 'service_role'
  );

-- DELETE : service_role uniquement (cleanup / RGPD)
DROP POLICY IF EXISTS "video_proofs_service_delete" ON storage.objects;
CREATE POLICY "video_proofs_service_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'video-proofs'
    AND auth.jwt()->>'role' = 'service_role'
  );

-- Fin migration V7.1 storage
