-- SUTRA only: atomic authorization facts, not a copy of provider credentials.
-- Requires the canonical public.social_accounts and T02 account permissions.
-- Apply as the trusted migration owner. No change to the shared table's ACL/RLS.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.social_accounts') IS NULL
    OR obj_description(to_regclass('public.social_accounts'), 'pg_class') IS DISTINCT FROM
      'OAuth-connected social media accounts via Zernio'
    OR to_regprocedure('sutra.account_is_active()') IS NULL THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_SCHEMA_REVIEW_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.social_accounts'::regclass
      AND attnum > 0 AND NOT attisdropped AND
      ((attname IN ('id','user_id') AND atttypid='uuid'::regtype)
        OR (attname IN ('platform','external_id','status') AND atttypid='text'::regtype)
        OR (attname='metadata' AND atttypid='jsonb'::regtype))) <> 6 THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_SCHEMA_REVIEW_REQUIRED';
  END IF;
  -- Refuse to repurpose an unrelated table with the same name.
  IF to_regclass('sutra.social_authorization_history') IS NOT NULL
    AND obj_description(to_regclass('sutra.social_authorization_history'), 'pg_class') IS DISTINCT FROM
      'SUTRA social authorization facts v1; no credentials or raw OAuth data' THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_SCHEMA_REVIEW_REQUIRED';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sutra.social_authorization_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No cascading foreign key: removing/reconnecting an account cannot erase facts.
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  external_account_id text,
  zernio_profile_id text NOT NULL CHECK (zernio_profile_id ~ '^[a-fA-F0-9]{24}$'),
  revision_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('authorization_observed', 'connection',
    'reconnection', 'revocation_requested', 'revocation_confirmed')),
  account_status text NOT NULL,
  requested_scopes text[] CHECK (requested_scopes IS NULL OR requested_scopes = ARRAY['posting']),
  granted_scopes text[] CHECK (granted_scopes IS NULL),
  grant_evidence text NOT NULL DEFAULT 'unknown' CHECK (grant_evidence = 'unknown'),
  profile_provenance text NOT NULL DEFAULT 'application_server_metadata'
    CHECK (profile_provenance = 'application_server_metadata'),
  remote_outcome text NOT NULL CHECK (remote_outcome IN ('unknown','confirmed_revoked')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(account_id, revision_id, event_type)
);
COMMENT ON TABLE sutra.social_authorization_history IS
  'SUTRA social authorization facts v1; no credentials or raw OAuth data';
COMMENT ON COLUMN sutra.social_authorization_history.requested_scopes IS
  'posting only for new SUTRA connection writes; historical observations have unknown requested scopes';
COMMENT ON COLUMN sutra.social_authorization_history.user_id IS
  'Account owner asserted by the trusted application writer; not an independently attested human action';
COMMENT ON COLUMN sutra.social_authorization_history.revision_id IS
  'Existing CAS revision; the same revision identifies requested and confirmed revocation';
CREATE INDEX IF NOT EXISTS social_authorization_history_owner_time
  ON sutra.social_authorization_history(user_id, recorded_at, id);

REVOKE ALL ON sutra.social_authorization_history FROM PUBLIC, anon, authenticated, service_role;
DO $$ DECLARE col record; BEGIN
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid='sutra.social_authorization_history'::regclass AND attnum>0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE ALL (%I) ON sutra.social_authorization_history FROM PUBLIC, anon, authenticated, service_role', col.attname);
  END LOOP;
END $$;
GRANT SELECT ON sutra.social_authorization_history TO authenticated, service_role;
ALTER TABLE sutra.social_authorization_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_authorization_history_read ON sutra.social_authorization_history;
CREATE POLICY social_authorization_history_read ON sutra.social_authorization_history
  FOR SELECT TO authenticated USING (user_id=auth.uid() AND sutra.account_is_active());
DROP POLICY IF EXISTS social_authorization_history_owner ON sutra.social_authorization_history;
CREATE POLICY social_authorization_history_owner ON sutra.social_authorization_history
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (user_id=auth.uid() AND sutra.account_is_active())
  WITH CHECK (user_id=auth.uid() AND sutra.account_is_active());

CREATE OR REPLACE FUNCTION sutra.reject_social_history_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_APPEND_ONLY';
END $$;
REVOKE ALL ON FUNCTION sutra.reject_social_history_mutation() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS sutra_social_history_immutable ON sutra.social_authorization_history;
CREATE TRIGGER sutra_social_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON sutra.social_authorization_history FOR EACH STATEMENT
  EXECUTE FUNCTION sutra.reject_social_history_mutation();

CREATE OR REPLACE FUNCTION sutra.capture_social_authorization_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  old_scoped boolean := false;
  new_scoped boolean;
  old_revision uuid;
  new_revision uuid;
  old_pending boolean := false;
  new_pending boolean;
  event_name text;
  writer_name text;
  uuid_pattern constant text := '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$';
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'social_accounts'
    OR TG_LEVEL <> 'ROW' OR TG_WHEN <> 'AFTER' OR TG_OP NOT IN ('INSERT','UPDATE') THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_TRIGGER_SCOPE';
  END IF;
  new_scoped := COALESCE(NEW.metadata->>'credential_owner'='zernio'
    AND NEW.metadata ? 'sutra_oauth_revision', false);
  IF TG_OP='UPDATE' THEN
    old_scoped := COALESCE(OLD.metadata->>'credential_owner'='zernio'
      AND OLD.metadata ? 'sutra_oauth_revision', false);
  END IF;
  IF NOT old_scoped AND NOT new_scoped THEN RETURN NEW; END IF;
  -- A browser writer of another application's rows must never gain this
  -- function owner's audit authority if shared-table ACLs later drift.
  writer_name := COALESCE(NULLIF(current_setting('role', true),'none'), session_user);
  IF writer_name <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=writer_name
      AND (r.rolsuper OR r.oid=(SELECT relowner FROM pg_catalog.pg_class
        WHERE oid='public.social_accounts'::regclass))
  ) THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_SERVER_WRITER_REQUIRED';
  END IF;
  -- Once marked, dropping markers must not bypass the authorization journal.
  IF NOT new_scoped THEN RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_SCOPE_REMOVAL'; END IF;
  IF NEW.user_id IS NULL OR NEW.id IS NULL
    OR NOT EXISTS (SELECT 1 FROM sutra.profiles WHERE id=NEW.user_id) THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_OWNER_INVALID';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.platform IS DISTINCT FROM OLD.platform) THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_OWNER_IMMUTABLE';
  END IF;
  IF (NEW.metadata->>'sutra_oauth_revision') IS NULL
    OR (NEW.metadata->>'sutra_oauth_revision') !~ uuid_pattern
    OR (NEW.metadata->>'zernio_profile_id') IS NULL
    OR (NEW.metadata->>'zernio_profile_id') !~ '^[a-fA-F0-9]{24}$'
    OR (NEW.metadata ? 'sutra_revocation_pending'
      AND jsonb_typeof(NEW.metadata->'sutra_revocation_pending') <> 'boolean') THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_PROVENANCE_INVALID';
  END IF;
  new_revision := (NEW.metadata->>'sutra_oauth_revision')::uuid;
  new_pending := COALESCE(NEW.metadata->'sutra_revocation_pending'='true'::jsonb, false);
  IF old_scoped THEN
    IF (OLD.metadata->>'sutra_oauth_revision') IS NULL
      OR (OLD.metadata->>'sutra_oauth_revision') !~ uuid_pattern
      OR (OLD.metadata->>'zernio_profile_id') IS NULL
      OR (OLD.metadata->>'zernio_profile_id') !~ '^[a-fA-F0-9]{24}$' THEN
      RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_PREVIOUS_PROVENANCE_INVALID';
    END IF;
    old_revision := (OLD.metadata->>'sutra_oauth_revision')::uuid;
    old_pending := COALESCE(OLD.metadata->'sutra_revocation_pending'='true'::jsonb, false);
    -- Capture only the old state that is actually available. No historical grant,
    -- connection date or requested scopes are inferred/backdated from metadata.
    IF NOT EXISTS (SELECT 1 FROM sutra.social_authorization_history
      WHERE account_id=OLD.id AND revision_id=old_revision) THEN
      INSERT INTO sutra.social_authorization_history(account_id,user_id,platform,external_account_id,
        zernio_profile_id,revision_id,event_type,account_status,requested_scopes,remote_outcome)
      VALUES (OLD.id,OLD.user_id,OLD.platform,
        CASE WHEN OLD.external_id ~ '^[a-fA-F0-9]{24}$' THEN OLD.external_id END,
        OLD.metadata->>'zernio_profile_id',old_revision,'authorization_observed',OLD.status,NULL,'unknown');
    END IF;
  END IF;

  IF NEW.status='connected' AND (NOT old_scoped OR new_revision IS DISTINCT FROM old_revision) THEN
    IF old_pending OR new_pending OR NEW.external_id IS NULL
      OR NEW.external_id !~ '^[a-fA-F0-9]{24}$'
      OR NOT EXISTS (SELECT 1 FROM sutra.profiles WHERE id=NEW.user_id
        AND access_revoked_at IS NULL AND subscription_status IS DISTINCT FROM 'banned') THEN
      RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_CONNECTION_INVALID';
    END IF;
    event_name := CASE WHEN TG_OP='INSERT' THEN 'connection' ELSE 'reconnection' END;
  ELSIF NEW.status='revoked' AND new_pending AND (NOT old_scoped OR new_revision IS DISTINCT FROM old_revision) THEN
    IF NOT old_scoped OR old_pending
      OR NEW.external_id IS DISTINCT FROM OLD.external_id
      OR NEW.metadata->>'zernio_profile_id' IS DISTINCT FROM OLD.metadata->>'zernio_profile_id' THEN
      RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_REVOCATION_INVALID';
    END IF;
    event_name := 'revocation_requested';
  ELSIF old_scoped AND OLD.status='revoked' AND old_pending AND NEW.status='revoked'
    AND NEW.metadata->'sutra_revocation_pending'='false'::jsonb
    AND new_revision=old_revision THEN
    IF NEW.external_id IS DISTINCT FROM OLD.external_id
      OR NEW.metadata->>'zernio_profile_id' IS DISTINCT FROM OLD.metadata->>'zernio_profile_id' THEN
      RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_REVOCATION_INVALID';
    END IF;
    event_name := 'revocation_confirmed';
  ELSE
    -- Normal display/credential cleanup writes do not claim new authorization.
    IF NOT old_scoped OR new_revision IS DISTINCT FROM old_revision
      OR new_pending IS DISTINCT FROM old_pending
      OR NEW.external_id IS DISTINCT FROM OLD.external_id
      OR NEW.metadata->>'zernio_profile_id' IS DISTINCT FROM OLD.metadata->>'zernio_profile_id'
      OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('connected','revoked')) THEN
      RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_TRANSITION_INVALID';
    END IF;
    RETURN NEW;
  END IF;
  IF new_revision IS DISTINCT FROM old_revision AND EXISTS (
    SELECT 1 FROM sutra.social_authorization_history WHERE account_id=NEW.id AND revision_id=new_revision
  ) THEN RAISE EXCEPTION 'SUTRA_SOCIAL_HISTORY_REVISION_REUSE'; END IF;

  INSERT INTO sutra.social_authorization_history(account_id,user_id,platform,external_account_id,
    zernio_profile_id,revision_id,event_type,account_status,requested_scopes,remote_outcome)
  VALUES (NEW.id,NEW.user_id,NEW.platform,
    CASE WHEN NEW.external_id ~ '^[a-fA-F0-9]{24}$' THEN NEW.external_id END,
    NEW.metadata->>'zernio_profile_id',new_revision,event_name,NEW.status,
    CASE WHEN event_name IN ('connection','reconnection') THEN ARRAY['posting'] ELSE NULL END,
    CASE WHEN event_name='revocation_confirmed' THEN 'confirmed_revoked' ELSE 'unknown' END);
  -- No EXCEPTION/ON CONFLICT swallowing: the account mutation fails with its audit.
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sutra.capture_social_authorization_history() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS sutra_capture_social_authorization_history ON public.social_accounts;
CREATE TRIGGER sutra_capture_social_authorization_history AFTER INSERT OR UPDATE
  ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION sutra.capture_social_authorization_history();
COMMIT;
